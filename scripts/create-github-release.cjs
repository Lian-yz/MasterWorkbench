#!/usr/bin/env node
/*
 * MasterWorkbench 一键发版脚本（自动构建 + 自动上传安装包）
 * --------------------------------------------------------------------------
 * 完整流程：
 *   1. 计算新版本号（默认 patch +1，可 --bump / --version / --no-bump）
 *   2. 把新版本号同步到 5 个文件（tauri.conf.json / Cargo.toml / Cargo.lock
 *      / src/stores/index.js / package.json），并在 CHANGELOG.md 写入占位条目
 *   3. 运行 `tauri build` 构建 Windows 安装包
 *   4. 自动定位构建产物 MasterWorkbench_<version>_x64-setup.exe
 *   5. 提交版本变更、打 tag、推送到 origin（可用 --no-git 跳过）
 *   6. 在 GitHub 创建（或复用）Release，并把安装包上传为附件
 *
 * 版本号约定（与 src-tauri/src/lib.rs 的 extract_version 保持一致）：
 *   安装包文件名前缀必须是 MasterWorkbench_，更新检测据此解析版本号。
 *
 * 用法：
 *   node scripts/create-github-release.cjs                 # patch 自增并完整发版
 *   node scripts/create-github-release.cjs --bump minor   # minor 自增
 *   node scripts/create-github-release.cjs --version 5.1.0# 指定版本
 *   node scripts/create-github-release.cjs --no-bump      # 不发新版本，仅构建并上传当前版本
 *   node scripts/create-github-release.cjs --no-build     # 跳过构建，上传已存在的安装包
 *   node scripts/create-github-release.cjs --no-git       # 跳过 git 提交/推送
 *   node scripts/create-github-release.cjs --dry-run      # 仅预览，不改动任何东西
 *
 * Token 获取优先级：--token > 环境变量 GITHUB_TOKEN/GH_TOKEN > git remote 内嵌 PAT
 * 仓库若为私有，请确保 PAT 拥有 repo 权限；公开仓库则无需 token 即可被应用检测更新。
 * --------------------------------------------------------------------------
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const { execSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const packageJsonPath = path.join(root, 'package.json')
const tauriConfPath = path.join(root, 'src-tauri', 'tauri.conf.json')
const cargoTomlPath = path.join(root, 'src-tauri', 'Cargo.toml')
const cargoLockPath = path.join(root, 'src-tauri', 'Cargo.lock')
const storesJsPath = path.join(root, 'src', 'stores', 'index.js')
const changelogPath = path.join(root, 'CHANGELOG.md')

// ============================= 参数解析 =============================
function parseArgs(argv) {
  const a = {
    bump: 'patch',
    noBump: false,
    noBuild: false,
    noGit: false,
    dryRun: false,
    token: '',
    version: '',
  }
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i]
    if (x === '--no-bump') a.noBump = true
    else if (x === '--no-build') a.noBuild = true
    else if (x === '--no-git') a.noGit = true
    else if (x === '--dry-run') a.dryRun = true
    else if (x === '--bump') a.bump = (argv[++i] || 'patch').toLowerCase()
    else if (x === '--version') a.version = argv[++i] || ''
    else if (x === '--token') a.token = argv[++i] || ''
    else if (x.startsWith('--bump=')) a.bump = x.split('=')[1].toLowerCase()
    else if (x.startsWith('--version=')) a.version = x.split('=')[1]
    else if (x.startsWith('--token=')) a.token = x.split('=')[1]
  }
  if (a.version) a.noBump = true // 显式指定版本时不自动自增
  return a
}

// ============================= 版本号工具 =============================
function readTauriVersion() {
  const text = fs.readFileSync(tauriConfPath, 'utf8')
  const m = text.match(/"version"\s*:\s*"([\d.]+)"/)
  if (!m) throw new Error('无法从 tauri.conf.json 读取 version')
  return m[1]
}

function parseVersion(v) {
  return v.split('.').map((n) => parseInt(n, 10) || 0)
}

function bumpVersion(v, type) {
  const [maj, min, pat] = parseVersion(v)
  if (type === 'major') return `${maj + 1}.0.0`
  if (type === 'minor') return `${maj}.${min + 1}.0`
  return `${maj}.${min}.${pat + 1}` // patch（默认）
}

// ============================= GitHub 仓库信息 =============================
function getOwnerRepo() {
  try {
    const url = execSync('git remote get-url origin', { cwd: root, encoding: 'utf8' }).trim()
    const m = url.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/)
    if (m) return { owner: m[1], repo: m[2] }
  } catch (e) {
    /* ignore */
  }
  return { owner: 'Lian-yz', repo: 'MasterWorkbench' }
}

function getToken(args) {
  if (args.token) return args.token
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN
  try {
    const url = execSync('git remote get-url origin', { cwd: root, encoding: 'utf8' }).trim()
    const m = url.match(/https:\/\/[^:@]+:([^@]+)@github\.com/)
    if (m) return m[1]
  } catch (e) {
    /* ignore */
  }
  return ''
}

// ============================= 版本文件同步 =============================
// 每个条目：文件路径 + 用于替换版本号的正则（3 个捕获组：前缀 / 版本 / 后缀）
// 正则只匹配「整段含版本号的字段」，替换时再在匹配串内替换版本数字，
// 避免「引号 + 括号」捕获组在某些 Node 版本下解析异常。
const versionFiles = [
  { path: tauriConfPath, re: /"version":\s*"[\d.]+"/ },
  { path: cargoTomlPath, re: /^version = "[\d.]+"$/m },
  {
    path: cargoLockPath,
    re: /name = "masters-workbench"\r?\n\s*version = "[\d.]+"/,
  },
  { path: storesJsPath, re: /appVersion:\s*load\('appVersion',\s*'[\d.]+'\)/ },
  { path: packageJsonPath, re: /"version":\s*"[\d.]+"/ },
]

function applyVersion(file, re, newVersion) {
  const text = fs.readFileSync(file, 'utf8')
  const out = text.replace(re, (whole) => whole.replace(/[\d.]+/, newVersion))
  fs.writeFileSync(file, out, 'utf8') // 仅替换子串，保留原换行符（CRLF）
}

// ============================= CHANGELOG =============================
function detectEOL(text) {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

function getChangelogBody(version) {
  if (!fs.existsSync(changelogPath)) return ''
  const changelog = fs.readFileSync(changelogPath, 'utf8')
  const tag = `v${version}`
  const regex = new RegExp(
    `## ${tag}\\s*\\([^\\)]*\\)([\\s\\S]*?)(?=\\n## v\\d|\\s*$)`
  )
  const m = changelog.match(regex)
  return m && m[1] ? m[1].trim() : ''
}

// 若 CHANGELOG 中缺少当前版本的条目，则自动插入占位条目（便于 Release 有正文）
function ensureChangelogEntry(version) {
  if (!fs.existsSync(changelogPath)) return false
  if (getChangelogBody(version)) return false
  const changelog = fs.readFileSync(changelogPath, 'utf8')
  const eol = detectEOL(changelog)
  const date = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const stub = `## v${version} (${date})${eol}${eol}- 自动发布版本 ${version}${eol}`
  const lines = changelog.split(eol)
  let insertAt = lines.findIndex((l) => /^#\s/.test(l))
  insertAt = insertAt >= 0 ? insertAt + 1 : 0
  lines.splice(insertAt, 0, '', stub.trimEnd())
  fs.writeFileSync(changelogPath, lines.join(eol), 'utf8')
  return true
}

// ============================= 构建 =============================
function runBuild() {
  const cmd = process.env.TAURI_CMD || 'npx tauri build'
  console.log(`[BUILD] 执行: ${cmd}`)
  execSync(cmd, { cwd: root, stdio: 'inherit' })
}

function findInstaller(version) {
  const base = path.join(root, 'src-tauri', 'target')
  if (!fs.existsSync(base)) return null
  const candidates = []
  ;(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('_x64-setup.exe')) candidates.push(p)
    }
  })(base)
  const exact = candidates.find((c) => c.includes(`MasterWorkbench_${version}_`))
  if (exact) return exact
  if (candidates.length) {
    return candidates
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]
  }
  return null
}

// ============================= Git 收尾 =============================
function git(args, allowFail = true) {
  try {
    execSync(`git ${args}`, { cwd: root, stdio: 'inherit' })
    return true
  } catch (e) {
    if (!allowFail) throw e
    return false
  }
}

function gitFinish(newVersion, changedFiles) {
  const rel = changedFiles.map((f) => JSON.stringify(path.relative(root, f))).join(' ')
  git(`add ${rel}`)
  git(`commit -m "chore(release): v${newVersion}"`)
  git(`tag -a v${newVersion} -m "Release v${newVersion}"`)
  const okMain = git('push origin main')
  const okTag = git(`push origin v${newVersion}`)
  if (!okMain || !okTag) {
    console.log(
      '[WARN] git push 失败，请手动执行：\n' +
        `       git push origin main && git push origin v${newVersion}`
    )
  }
}

// ============================= GitHub API =============================
function reqJson(method, host, apiPath, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'MasterWorkbench-Release-Script',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (data) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(data)
    }
    const r = https.request(
      { hostname: host, path: apiPath, method, headers },
      (res) => {
        let buf = ''
        res.on('data', (c) => (buf += c))
        res.on('end', () => {
          let json = null
          try {
            json = buf ? JSON.parse(buf) : null
          } catch (e) {
            /* ignore */
          }
          resolve({ status: res.statusCode, data: json, raw: buf })
        })
      }
    )
    r.on('error', reject)
    if (data) r.write(data)
    r.end()
  })
}

function uploadAsset(releaseId, filePath, token) {
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(filePath)
    const fileName = path.basename(filePath)
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'MasterWorkbench-Release-Script',
      'Content-Type': 'application/octet-stream',
      'Content-Length': stat.size,
    }
    const r = https.request(
      {
        hostname: 'uploads.github.com',
        path: `/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(
          fileName
        )}`,
        method: 'POST',
        headers,
      },
      (res) => {
        let buf = ''
        res.on('data', (c) => (buf += c))
        res.on('end', () => {
          let json = null
          try {
            json = JSON.parse(buf)
          } catch (e) {
            /* ignore */
          }
          resolve({ status: res.statusCode, data: json })
        })
      }
    )
    r.on('error', reject)
    fs.createReadStream(filePath).pipe(r)
  })
}

async function ensureRelease(token, tag, name, body) {
  let res = await reqJson('POST', 'api.github.com', `/repos/${owner}/${repo}/releases`, {
    token,
    body: {
      tag_name: tag,
      name,
      body,
      draft: false,
      prerelease: false,
      generate_release_notes: false,
    },
  })
  if (res.status >= 200 && res.status < 300) {
    console.log(`[OK] Release 创建成功: ${res.data.html_url}`)
    return res.data
  }
  if (res.status === 422 || res.status === 404) {
    const get = await reqJson(
      'GET',
      'api.github.com',
      `/repos/${owner}/${repo}/releases/tags/${tag}`,
      { token }
    )
    if (get.status >= 200 && get.status < 300) {
      console.log(`[OK] Release 已存在，复用: ${get.data.html_url}`)
      return get.data
    }
  }
  throw new Error(`创建 Release 失败 (${res.status}): ${res.raw}`)
}

async function uploadInstaller(token, release, installerPath) {
  const fileName = path.basename(installerPath)
  // 删除同名旧附件，保证重复运行幂等
  if (Array.isArray(release.assets)) {
    for (const a of release.assets) {
      if (a.name === fileName) {
        await reqJson(
          'DELETE',
          'api.github.com',
          `/repos/${owner}/${repo}/releases/assets/${a.id}`,
          { token }
        )
        console.log(`[OK] 已删除旧附件: ${fileName}`)
      }
    }
  }
  const up = await uploadAsset(release.id, installerPath, token)
  if (up.status >= 200 && up.status < 300) {
    console.log(`[OK] 安装包已上传: ${up.data.browser_download_url}`)
  } else {
    throw new Error(`上传安装包失败 (${up.status}): ${JSON.stringify(up.data)}`)
  }
}

// ============================= 主流程 =============================
;(async () => {
  const args = parseArgs(process.argv.slice(2))
  const { owner, repo } = getOwnerRepo()

  const currentVersion = readTauriVersion()
  let newVersion
  if (args.version) newVersion = args.version
  else if (args.noBump) newVersion = currentVersion
  else newVersion = bumpVersion(currentVersion, args.bump)

  const tag = `v${newVersion}`
  const expectedInstaller = path.join(
    root,
    'src-tauri',
    'target',
    'release',
    'bundle',
    'nsis',
    `MasterWorkbench_${newVersion}_x64-setup.exe`
  )

  // ---- 预览模式 ----
  if (args.dryRun) {
    console.log('================ 发版预览（dry-run）================')
    console.log(`仓库:            ${owner}/${repo}`)
    console.log(`当前版本:        ${currentVersion}`)
    console.log(`发版版本:        ${newVersion}`)
    console.log(`Tag:             ${tag}`)
    console.log(`版本自增:        ${args.noBump ? '否（使用当前版本）' : args.bump}`)
    console.log(`将同步版本号到: ${versionFiles.map((f) => path.basename(f.path)).join(', ')}`)
    console.log(`CHANGELOG:       ${fs.existsSync(changelogPath) ? '自动补条目(若缺失)' : '文件不存在，跳过'}`)
    console.log(`构建命令:        ${process.env.TAURI_CMD || 'npx tauri build'}`)
    console.log(`预期安装包:      ${expectedInstaller}`)
    console.log(`Git 收尾:        ${args.noGit ? '跳过' : '提交 + 打 tag + 推送'}`)
    console.log('=====================================================')
    console.log('（dry-run 未执行任何实际操作）')
    return
  }

  console.log(`[INFO] 发版版本: ${newVersion}  (当前 ${currentVersion})`)

  // ---- 写入版本号 + CHANGELOG ----
  const changedFiles = []
  const backups = []
  if (!args.noBump || args.version) {
    for (const f of versionFiles) {
      backups.push({ path: f.path, text: fs.readFileSync(f.path, 'utf8') })
      applyVersion(f.path, f.re, newVersion)
      changedFiles.push(f.path)
      console.log(`[OK] 已更新版本号: ${path.basename(f.path)}`)
    }
    if (ensureChangelogEntry(newVersion)) {
      changedFiles.push(changelogPath)
      console.log('[OK] 已在 CHANGELOG.md 插入版本占位条目')
    }
  } else {
    console.log('[INFO] --no-bump：保持当前版本号，不修改版本文件')
  }

  // 备份用于构建失败时回滚
  const rollback = () => {
    for (const b of backups) fs.writeFileSync(b.path, b.text, 'utf8')
    console.log('[ROLLBACK] 已还原版本文件（构建失败）')
  }

  try {
    // ---- 构建 ----
    if (args.noBuild) {
      console.log('[INFO] --no-build：跳过构建，使用已存在的安装包')
    } else {
      runBuild()
    }

    // ---- 定位安装包 ----
    const installer = findInstaller(newVersion)
    if (!installer) {
      throw new Error(
        `未找到安装包 MasterWorkbench_${newVersion}_x64-setup.exe\n` +
          `预期路径: ${expectedInstaller}\n` +
          `请先确认 tauri build 成功，或改用 --no-build 指定已构建的安装包。`
      )
    }
    console.log(`[OK] 找到安装包: ${installer}`)

    // ---- Git 收尾（可选）----
    if (!args.noGit && changedFiles.length) {
      gitFinish(newVersion, changedFiles)
    } else if (args.noGit) {
      console.log('[INFO] --no-git：跳过 git 提交/推送（版本文件改动仍在本地，可手动提交）')
    }

    // ---- Token 校验 ----
    const token = getToken(args)
    if (!token) {
      throw new Error(
        '未获取到 GitHub Token。请任选其一：\n' +
          '  1) 设置环境变量 GITHUB_TOKEN\n' +
          '  2) 运行脚本时加 --token <PAT>\n' +
          '  3) 在 git remote URL 中嵌入 PAT（https://<token>@github.com/...）\n' +
          '注意：PAT 需拥有 repo 权限；若仓库为公开，应用检测更新本身无需 token。'
      )
    }

    // ---- 创建/复用 Release ----
    let body = getChangelogBody(newVersion)
    if (!body) {
      body = `自动发布版本 ${newVersion}`
      console.log('[WARN] 未在 CHANGELOG.md 找到该版本正文，使用默认说明。')
    }
    const release = await ensureRelease(token, tag, `MasterWorkbench ${newVersion}`, body)

    // ---- 上传安装包 ----
    await uploadInstaller(token, release, installer)

    console.log('=====================================================')
    console.log(`[DONE] 发版完成: ${release.html_url}`)
    console.log('       用户在应用内点击左上角版本号即可检测到新版本。')
    console.log('=====================================================')
  } catch (err) {
    console.error(`[ERR] 发版失败: ${err.message || err}`)
    if (backups.length) rollback()
    process.exit(1)
  }
})()
