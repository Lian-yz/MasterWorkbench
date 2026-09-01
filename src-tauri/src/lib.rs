// Tauri 主进程入口（lib 形式，便于移动端复用）
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            open_external,
            open_with_app,
            default_data_dir,
            check_for_update,
            download_update,
            install_update,
            set_github_token,
            minimize_window,
            maximize_window,
            close_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 用系统默认程序打开文件路径或 URL
/// - PDF 文件 → 系统默认 PDF 阅读器
/// - http(s) URL → 系统默认浏览器
/// - 其他文件 → 系统默认关联程序
/// 返回默认数据目录（用户数据目录下「硕士工作台数据」），供桌面版自动初始化存储
/// 路径形如：C:\Users\xxx\AppData\Roaming\com.mastersworkbench.app\硕士工作台数据
#[tauri::command]
fn default_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("硕士工作台数据");
    // 确保目录存在，桌面版开箱即用
    if let Err(e) = std::fs::create_dir_all(&dir) {
        return Err(e.to_string());
    }
    Ok(dir.to_string_lossy().to_string())
}

// ==================== 窗口控制（无边框窗口自定义标题栏） ====================

/// 最小化窗口
#[tauri::command]
fn minimize_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.minimize();
    }
}

/// 最大化/还原窗口
#[tauri::command]
fn maximize_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = if window.is_maximized().unwrap_or(false) {
            window.unmaximize()
        } else {
            window.maximize()
        };
    }
}

/// 关闭窗口
#[tauri::command]
fn close_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.close();
    }
}

#[tauri::command]
#[cfg(windows)]
fn open_external(path: String) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("cmd")
        .args(["/C", "start", "", &path])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW，避免弹出黑色控制台窗口
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 用指定软件打开文件（自定义 PDF 阅读器）
/// app_path: 软件完整路径（如 C:\Program Files\SumatraPDF\SumatraPDF.exe）
/// file_path: 要打开的文件路径
#[tauri::command]
#[cfg(windows)]
fn open_with_app(app_path: String, file_path: String) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    // 直接启动软件并传入文件路径作为参数
    std::process::Command::new(&app_path)
        .arg(&file_path)
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .spawn()
        .map_err(|e| format!("无法启动软件 {}：{}", app_path, e))?;
    Ok(())
}

#[tauri::command]
#[cfg(not(windows))]
fn open_with_app(app_path: String, file_path: String) -> Result<(), String> {
    std::process::Command::new(&app_path)
        .arg(&file_path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[cfg(not(windows))]
fn open_external(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ==================== 自动更新（全部重写） ====================
//
// 架构：
//   check_for_update  →  查询 GitHub Releases API，找到版本号最高的安装包
//   download_update   →  流式下载安装包到临时目录，实时推送进度事件
//   install_update    →  生成 bat 脚本，等待应用退出后弹出可见 NSIS 安装向导，完成后重启
//
// 设计要点：
//   - 私有仓库需 Bearer Token 认证，否则 GitHub API 返回 404
//   - 下载使用 asset API 端点 + Accept: application/octet-stream（而非 browser_download_url）
//   - 安装向导不使用 /S 静默参数，让用户可见安装进度

use std::sync::Mutex;

/// GitHub 仓库信息
const GITHUB_OWNER: &str = "Lian-yz";
const GITHUB_REPO: &str = "MasterWorkbench";

/// 默认 GitHub Token（编译时硬编码，前端可通过 set_github_token 动态覆盖）
const DEFAULT_TOKEN: &str = "github_pat_PLACEHOLDER_REPLACED_DO_NOT_USE";

/// 动态 Token（运行时由前端注入，优先级高于 DEFAULT_TOKEN）
static DYNAMIC_TOKEN: Mutex<String> = Mutex::new(String::new());

/// 获取当前生效的 GitHub Token
fn token() -> String {
    match DYNAMIC_TOKEN.lock() {
        Ok(guard) if !guard.is_empty() => guard.clone(),
        _ => DEFAULT_TOKEN.to_string(),
    }
}

/// 前端动态设置 GitHub Token
#[tauri::command]
fn set_github_token(token: String) -> Result<(), String> {
    let mut guard = DYNAMIC_TOKEN.lock().map_err(|e| e.to_string())?;
    *guard = token;
    Ok(())
}

// -------------------- 版本号解析与比较 --------------------

/// 将版本字符串解析为 (主版本段, build 序号)
/// "5.0.232"        → ([5, 0, 232], 0)
/// "5.0.199+build2" → ([5, 0, 199], 2)
fn parse_version(s: &str) -> (Vec<u32>, u32) {
    let s = s.trim();
    // 以 '+' 分离主版本和 build 后缀
    let (main, rest) = match s.split_once('+') {
        Some((m, b)) => (m, b),
        None => (s, ""),
    };
    let nums: Vec<u32> = main
        .split('.')
        .map(|p| p.trim().parse::<u32>().unwrap_or(0))
        .collect();
    // build 后缀形如 "build2"、"build"；无后缀视为 build 0
    let build = rest
        .trim_start_matches("build")
        .trim_start_matches("BUILD")
        .parse::<u32>()
        .unwrap_or(if rest.is_empty() { 0 } else { 1 });
    (nums, build)
}

/// 比较版本号：-1 (a < b), 0 (相等), 1 (a > b)
fn compare_versions(a: &str, b: &str) -> i32 {
    let (pa, ba) = parse_version(a);
    let (pb, bb) = parse_version(b);
    for i in 0..pa.len().max(pb.len()) {
        let va = pa.get(i).copied().unwrap_or(0);
        let vb = pb.get(i).copied().unwrap_or(0);
        if va != vb {
            return if va < vb { -1 } else { 1 };
        }
    }
    if ba != bb {
        return if ba < bb { -1 } else { 1 };
    }
    0
}

/// 从安装包文件名提取版本号
/// 当前前缀 "MasterWorkbench_"（无空格无版本后缀），兼容历史旧前缀：
/// "MasterWorkbench 5_"（旧版带空格）、"MasterWorkbench.5_"（GitHub API 空格转点）、"MasterWorkbench5_"（上传去空格）
/// "MasterWorkbench_5.0.232_x64-setup.exe"  → "5.0.232"
/// "MasterWorkbench5_5.0.229_x64-setup.exe"  → "5.0.229"
/// "MasterWorkbench.5_5.0.273_x64-setup.exe" → "5.0.273"
fn extract_version(filename: &str) -> Option<String> {
    let after_prefix = filename
        .strip_prefix("MasterWorkbench_")
        .or_else(|| filename.strip_prefix("MasterWorkbench 5_"))
        .or_else(|| filename.strip_prefix("MasterWorkbench.5_"))
        .or_else(|| filename.strip_prefix("MasterWorkbench5_"))?;
    let version_str = after_prefix.strip_suffix("_x64-setup.exe")?;
    // 校验：至少三段数字 x.y.z
    let parts: Vec<&str> = version_str.split('.').collect();
    if parts.len() >= 3 && parts.iter().all(|p| !p.is_empty() && p.parse::<u32>().is_ok()) {
        Some(version_str.to_string())
    } else {
        None
    }
}

// -------------------- Tauri 命令 --------------------

/// 检查 GitHub 是否有新版本
/// 遍历所有 Release（跳过 prerelease），找到含安装包且版本号最高的
/// 返回 Option<{ version, downloadUrl, releaseNotes }>
#[tauri::command]
fn check_for_update(current_version: String) -> Result<Option<serde_json::Value>, String> {
    let url = format!(
        "https://api.github.com/repos/{}/{}/releases?per_page=100",
        GITHUB_OWNER, GITHUB_REPO
    );

    let response = ureq::get(&url)
        .set("Accept", "application/vnd.github+json")
        .set("User-Agent", "masters-workbench-updater")
        .set("Authorization", &format!("Bearer {}", token()))
        .call()
        .map_err(|e| format!("GitHub API 请求失败: {}", e))?;

    let releases: serde_json::Value = response
        .into_json()
        .map_err(|e| format!("GitHub 响应解析失败: {}", e))?;

    let mut best_version = String::new();
    let mut best_url = String::new();
    let mut best_notes = String::new();

    if let Some(arr) = releases.as_array() {
        for release in arr {
            // 跳过预发布版本
            if release["prerelease"].as_bool().unwrap_or(false) {
                continue;
            }
            if let Some(assets) = release["assets"].as_array() {
                for asset in assets {
                    if let Some(name) = asset["name"].as_str() {
                        if name.ends_with("_x64-setup.exe") {
                            if let Some(v) = extract_version(name) {
                                if best_version.is_empty()
                                    || compare_versions(&v, &best_version) > 0
                                {
                                    best_version = v;
                                    // 使用 asset API 端点下载（私有仓库需认证）
                                    best_url = asset["url"]
                                        .as_str()
                                        .unwrap_or("")
                                        .to_string();
                                    best_notes = release["body"]
                                        .as_str()
                                        .unwrap_or("")
                                        .to_string();
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 无可用版本或版本不高于当前版本
    if best_version.is_empty() || compare_versions(&best_version, &current_version) <= 0 {
        return Ok(None);
    }

    Ok(Some(serde_json::json!({
        "version": best_version,
        "downloadUrl": best_url,
        "releaseNotes": best_notes
    })))
}

/// 下载安装包到临时目录，通过事件 `download-progress` 推送进度（0-100）
/// 完成后返回安装包路径，前端可决定何时调用 install_update
#[tauri::command]
async fn download_update(
    download_url: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    use std::io::Read;

    let temp_dir = std::env::temp_dir();
    let filename = if download_url.contains("/releases/assets/") {
        "MasterWorkbench_update.exe"
    } else {
        download_url.rsplit('/').next().unwrap_or("update.exe")
    };
    let save_path = temp_dir.join(filename);

    // 在独立线程中下载，通过 channel 传回结果
    let app_clone = app.clone();
    let path_clone = save_path.clone();
    let url_clone = download_url.clone();
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();

    std::thread::spawn(move || {
        let result = (|| -> Result<(), String> {
            let mut req = ureq::get(&url_clone)
                .set("User-Agent", "masters-workbench-updater")
                .set("Authorization", &format!("Bearer {}", token()));
            // asset API 端点需要 Accept: application/octet-stream 才返回文件流
            if url_clone.contains("/releases/assets/") {
                req = req.set("Accept", "application/octet-stream");
            }
            let response = req.call().map_err(|e| format!("下载请求失败: {}", e))?;

            let total: u64 = response
                .header("Content-Length")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0);

            let mut reader = response.into_reader();
            let mut file = std::fs::File::create(&path_clone)
                .map_err(|e| format!("创建临时文件失败: {}", e))?;

            let mut downloaded: u64 = 0;
            let mut buf = [0u8; 65536];
            let mut last_pct: u64 = 0;

            loop {
                let n = reader
                    .read(&mut buf)
                    .map_err(|e| format!("读取下载数据失败: {}", e))?;
                if n == 0 {
                    break;
                }
                std::io::Write::write_all(&mut file, &buf[..n])
                    .map_err(|e| format!("写入安装包失败: {}", e))?;
                downloaded += n as u64;

                if total > 0 {
                    let pct = downloaded * 100 / total;
                    if pct >= last_pct + 2 || pct == 100 {
                        last_pct = pct;
                        let _ = app_clone.emit("download-progress", pct);
                    }
                }
            }
            drop(file);

            if total > 0 && downloaded != total {
                return Err(format!(
                    "下载不完整: 期望 {} 字节, 实际 {} 字节",
                    total, downloaded
                ));
            }
            Ok(())
        })();
        let _ = tx.send(result);
    });

    // 等待下载线程完成
    rx.recv()
        .map_err(|e| format!("下载线程异常: {}", e))??;

    // 确保进度到 100%
    let _ = app.emit("download-progress", 100u64);
    Ok(save_path.to_string_lossy().to_string())
}

/// 启动已下载的安装包（弹出可见的 NSIS 安装向导 GUI），然后退出应用
/// 流程：生成 bat 脚本 → 等待应用退出 → 启动安装向导 → 安装后重启应用 → bat 自删
#[tauri::command]
async fn install_update(
    installer_path: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let setup_path = std::path::PathBuf::from(&installer_path);
    if !setup_path.exists() {
        return Err(format!("安装包不存在: {}", installer_path));
    }

    #[cfg(windows)]
    {
        let temp_dir = std::env::temp_dir();

        // 当前 exe 名称（用于 bat 脚本中 tasklist/taskkill 定位进程）
        let current_exe = std::env::current_exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let exe_name = std::path::Path::new(&current_exe)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "masters-workbench.exe".to_string());

        let setup_str = setup_path.to_string_lossy().replace('\\', "\\");

        // bat 脚本：等待应用退出 → 弹出可见 NSIS 安装向导 → 等待安装完成 → 自删
        // 不再自动重启旧 exe，由 NSIS 安装向导的 Finish 页面负责启动新版本
        let bat_content = format!(
            r#"@echo off
set LOG=%TEMP%\mw_update.log
echo [1] update script started at %date% %time% > "%LOG%"

:: Wait for current app to fully exit (max 20 seconds)
echo [2] waiting for app exit: {exe_name} >> "%LOG%"
for /l %%i in (1,1,20) do (
  tasklist /FI "IMAGENAME eq {exe_name}" 2>nul | findstr /I "{exe_name}" >nul
  if errorlevel 1 goto app_exited
  ping -n 2 127.0.0.1 >nul
)

echo [3] force killing app >> "%LOG%"
taskkill /F /T /IM {exe_name} >nul 2>nul
ping -n 3 127.0.0.1 >nul

:app_exited
echo [4] starting installer: "{setup}" >> "%LOG%"
:: Launch NSIS installer wizard with /WAIT (blocks until installer finishes)
start /WAIT "" "{setup}"
set RC=%ERRORLEVEL%
echo [5] installer finished with exit code %RC% >> "%LOG%"

:: Self-delete
(goto) 2>nul & del "%~f0"
echo [7] update script finished >> "%LOG%"
"#,
            setup = setup_str,
            exe_name = exe_name,
        );

        let bat_path = temp_dir.join("mw_update.bat");
        std::fs::write(&bat_path, bat_content.as_bytes())
            .map_err(|e| format!("写入更新脚本失败: {}", e))?;

        // 以 CREATE_NO_WINDOW 启动 bat，隐藏 cmd 控制台窗口
        // bat 中 start "" "{setup}" 会弹出 NSIS 安装向导 GUI 窗口（用户可见）
        use std::os::windows::process::CommandExt;
        std::process::Command::new("cmd")
            .args(["/C", bat_path.to_string_lossy().as_ref()])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .spawn()
            .map_err(|e| format!("启动更新脚本失败: {}", e))?;
    }

    #[cfg(not(windows))]
    {
        std::process::Command::new(&setup_path)
            .spawn()
            .map_err(|e| format!("启动安装程序失败: {}", e))?;
    }

    // 等待 bat 进程启动后退出应用
    std::thread::sleep(std::time::Duration::from_millis(800));
    app.exit(0);

    Ok(())
}
