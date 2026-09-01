<div align="center">

# MasterWorkbench

### 研究生全维度成长工作台

输入 → 执行 → 复盘 → 激励，四维闭环的个人成长管理系统

[![Version](https://img.shields.io/badge/version-5.0.265-blue)](https://github.com/Lian-yz/MasterWorkbench/releases)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-orange)](https://tauri.app)
[![Vue](https://img.shields.io/badge/Vue-3-brightgreen)](https://vuejs.org)

Windows 桌面应用 · 数据全本地存储 · 零后端零云端

</div>

---

## 软件简介

**研究生工作台**是一款面向研究生（及科研工作者）的全维度个人成长管理工作台。它围绕「输入 → 执行 → 复盘 → 激励」四维闭环设计，将科研、学习、规划、生活管理整合到一个桌面应用中。

核心理念：

- **本地优先，隐私可控** — 所有数据存储在本机，不上传云端，断网可用
- **桌面端体验** — 基于 Tauri 2.x 构建 Windows 原生桌面应用，无边框窗口 + 毛玻璃效果
- **配置驱动** — 计划状态、优先级、文献字段、导航站点等均可自定义
- **渐进兼容** — 任何数据结构变更都做向后兼容，升级不丢老数据

---

## 功能模块一览

| 模块 | 路由 | 说明 |
|------|------|------|
| 主页信息预览 | `/` | 今日待办、周计划速览、专注计时、闪念笔记 |
| 科研中心 | `/research` | 组会纪要、实验记录、灵感墙、里程碑、研究助手 |
| 仿真中心 | `/simulation` | 仿真总览、仿真库管理、多记录追踪、结果图片存储 |
| 论文中心 | `/papers` | 文献库管理、PDF 内嵌阅读、笔记与公式渲染（KaTeX） |
| 计划中心 | `/plan` | 日/周/月/季计划、子任务拆分、复盘、每日打卡 |
| 科研导航 | `/navigation` | 常用学术站点分类导航书签 |
| 积分激励 | `/points` | 积分获取/消费、任务赌注、成就系统 |
| 财务中心 | `/finance` | 个人财务管理 |
| 日历视图 | `/calendar` | 月/年/周/双周多视图日历 |
| 个人信息 | `/profile` | 个人资料、头像、学业进度追踪 |
| 平台设置 | `/settings` | 数据资产管理、备份导入导出、外观配置、平台文档 |

---

## 截图预览


### 主界面

![](./screenshots/dashboard.png)<img width="2560" height="1380" alt="image" src="https://github.com/user-attachments/assets/f93b7f94-0192-41d6-8212-ed661243ac30" />

*主页信息预览 — 今日待办、周计划、专注计时、闪念笔记*

### 论文中心

![](./screenshots/papers.png)<img width="2560" height="1380" alt="image" src="https://github.com/user-attachments/assets/fdda6e87-8653-496a-9c20-918151893708" />

*文献库 + PDF 阅读 + 笔记编辑 + 公式渲染*

### 计划中心

![](./screenshots/plan.png)<img width="2560" height="1380" alt="image" src="https://github.com/user-attachments/assets/727f8f15-82b2-4d7e-ac64-5bca37c33d11" />

*日/周/月/季计划管理 + 每日打卡 + 复盘*

### 仿真中心

![](./screenshots/simulation.png)<img width="2560" height="1380" alt="image" src="https://github.com/user-attachments/assets/15e24989-a34a-4297-be26-4c6c9710133a" />

*仿真库管理 + 多记录追踪 + 结果图片*

### 科研中心

![](./screenshots/research.png)<img width="2560" height="1380" alt="image" src="https://github.com/user-attachments/assets/8175440e-efea-4cc1-93ec-83a78e7d5d74" />

*组会纪要 + 实验记录 + 灵感墙 + 里程碑*

### 登录页

![](./screenshots/login.png)<img width="2560" height="1380" alt="image" src="https://github.com/user-attachments/assets/aaf04310-b7af-4fc2-85c3-5993a23526e8" />

*毛玻璃透明登录页，可透出自定义背景图*

---

## 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| [Vue 3](https://vuejs.org) | ^3.4 | 前端框架（`<script setup>` 组合式 API） |
| [Vite 5](https://vitejs.dev) | ^5.4 | 构建工具与开发服务器 |
| [Pinia 2](https://pinia.vuejs.org) | ^2.1 | 状态管理（18 个 Store） |
| [Vue Router 4](https://router.vuejs.org) | ^4.3 | 路由（hash 模式） |
| [ECharts 5](https://echarts.apache.org) | ^5.5 | 数据可视化与图表 |
| [dayjs](https://day.js) | ^1.11 | 日期处理 |
| [KaTeX](https://katex.org) | ^0.18 | LaTeX 公式渲染 |
| [SheetJS (xlsx)](https://sheetjs.com) | ^0.18 | Excel 导入导出 |
| [lucide-vue-next](https://lucide.dev) | ^1.0 | SVG 图标库 |

### 桌面端

| 技术 | 版本 | 用途 |
|------|------|------|
| [Tauri 2](https://tauri.app) | 2.x | 桌面应用框架（Rust 后端） |
| [tauri-plugin-fs](https://tauri.app/plugin/file-system/) | 2 | 本地文件系统读写 |
| [tauri-plugin-dialog](https://tauri.app/plugin/dialog/) | 2 | 原生文件选择对话框 |
| [tauri-plugin-shell](https://tauri.app/plugin/shell/) | 2 | 调用系统命令 |
| [Rust](https://www.rust-lang.org) | edition 2021 | 后端逻辑（自动更新、窗口控制） |

### 开发工具

| 工具 | 用途 |
|------|------|
| [@tauri-apps/cli](https://tauri.app) | Tauri 构建与开发命令 |
| [@vitejs/plugin-vue](https://vitejs.dev) | Vite Vue 插件 |
| [Electron](https://www.electronjs.org) | 旧版浏览器端打包（已迁移至 Tauri） |
| [Sharp](https://sharp.pixelplumbing.com) | 图标尺寸处理 |

---

## 项目结构

```
MasterWorkbench/
├── src/                          # 前端源码
│   ├── main.js                   # 应用入口
│   ├── App.vue                   # 根组件（侧边栏、平台文档、版本播种）
│   ├── router/index.js           # 路由表（11 条路由）
│   ├── stores/index.js           # 全部 Pinia Store（18 个）
│   ├── styles/global.css         # 全局样式与 CSS 变量
│   ├── views/                    # 页面组件（13 个）
│   │   ├── Login.vue             #   登录页
│   │   ├── Dashboard.vue         #   主页信息预览
│   │   ├── Research.vue          #   科研中心
│   │   ├── Simulation.vue        #   仿真中心
│   │   ├── PaperCenter.vue       #   论文中心
│   │   ├── Plan.vue              #   计划中心
│   │   ├── Finance.vue           #   财务中心
│   │   ├── CalendarView.vue      #   日历视图
│   │   ├── Navigation.vue       #   科研导航
│   │   ├── PointsCenter.vue      #   积分激励
│   │   ├── Profile.vue           #   个人信息
│   │   ├── Settings.vue          #   平台设置
│   │   └── SubscriptionCenter.vue  # 订阅中心
│   ├── components/               # 共用组件
│   │   ├── AppIcon.vue           #   动态图标
│   │   ├── common/               #   通用组件
│   │   ├── layout/               #   布局组件
│   │   ├── pdf/                  #   PDF 阅读器
│   │   └── plan/                 #   计划日历
│   ├── composables/              # 组合式函数
│   ├── utils/                    # 工具函数
│   │   ├── storage.js            #   localStorage 封装
│   │   ├── fileStorage.js        #   File System Access API
│   │   ├── tauriFs.js            #   Tauri 桌面端文件读写
│   │   ├── desktopBridge.js      #   桌面端桥接
│   │   ├── indexedDb.js          #   IndexedDB 封装
│   │   ├── paperPdfStorage.js    #   论文 PDF 存储
│   │   ├── simImageStorage.js    #   仿真图片存储
│   │   ├── localBridge.js        #   浏览器端本地桥接
│   │   ├── electronFileStorage.js  # Electron 文件存储（兼容）
│   │   └── autoExport.js         #   自动导出中间件
│   └── icons.js                 # SVG 图标注册
├── src-tauri/                    # Tauri 桌面端（Rust）
│   ├── src/
│   │   ├── lib.rs                # Rust 后端逻辑
│   │   └── main.rs               # 入口
│   ├── nsis/                     # NSIS 安装脚本与资源
│   ├── gen/schemas/              # Tauri 生成的权限 schema
│   ├── capabilities/             # 权限配置
│   ├── icons/                    # 应用图标（多平台多尺寸）
│   ├── Cargo.toml                # Rust 依赖
│   ├── Cargo.lock                # Rust 依赖锁定
│   ├── tauri.conf.json           # Tauri 配置
│   ├── WebView2Loader.dll        # WebView2 加载器
│   └── build.rs                  # 构建脚本
├── public/                       # 静态资源
│   ├── tools/local-bridge/       # 浏览器端本地桥接服务
│   └── icons/                    # PWA 图标
├── electron/                     # Electron 兼容代码
├── scripts/                      # 构建辅助脚本
├── index.html                    # SPA 入口
├── package.json                  # 依赖与脚本
├── vite.config.js                # Vite 构建配置
└── CHANGELOG.md                  # 更新日志
```

---

## 数据存储

软件采用双通道本地存储架构，根据运行环境自动选择：

| 运行环境 | 文件存储 | 结构化数据 | 媒体内容 |
|----------|----------|------------|----------|
| **桌面端**（Tauri） | 本地数据目录（`plugin-fs`） | 本地 JSON 文件 | 本地磁盘文件 |
| **浏览器端**（PWA） | File System Access API | localStorage | IndexedDB |

特性：

- **自动备份** — 每 30 秒自动备份到本地文件夹，保留最近 20 份
- **JSON 导入导出** — 设置中可手动导入导出全部数据
- **CSV/Excel 导出** — 表格数据支持导出为 Excel
- **零云端依赖** — 所有数据在本机闭环，无需联网即可使用

---

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org) 18+
- [Rust](https://www.rust-lang.org/tools/install)（桌面端构建需要）
- Windows 10/11 + WebView2（运行时需要）

### 安装依赖

```bash
git clone https://github.com/Lian-yz/MasterWorkbench.git
cd MasterWorkbench
npm install
```

### 开发模式

```bash
# 浏览器端开发
npm run dev

# Tauri 桌面端开发
npx tauri dev
```

### 构建生产版本

```bash
# 浏览器端构建（输出到 dist/）
npm run build

# Tauri 桌面端构建（输出 NSIS 安装包）
npx tauri build
```

### 下载安装

前往 [Releases 页面](https://github.com/Lian-yz/MasterWorkbench/releases) 下载最新版安装包：

- `MasterWorkbench_5.0.X_x64-setup.exe` — Windows 安装包
- `source-5.0.X.zip` — 完整源码包

---

## 版本号规则

- 版本号格式：`5.0.X`，小版本（第三位）递增
- 版本号同步更新于 4 处：`tauri.conf.json`、`Cargo.toml`、`Cargo.lock`、`src/stores/index.js`
- 每次发版在 `App.vue` 中播种更新日志，`CHANGELOG.md` 同步追加

---

## 致谢

本项目在开发过程中使用并参考了以下开源项目与资源，在此一并致谢：

### 核心框架

- **[Tauri](https://tauri.app)** — 轻量级跨平台桌面应用框架，让 Rust + Web 技术构建原生应用成为可能
- **[Vue.js](https://vuejs.org)** — 渐进式 JavaScript 框架，组合式 API 让状态管理清晰高效
- **[Vite](https://vitejs.dev)** — 下一代前端构建工具，闪电般的开发服务器启动
- **[Pinia](https://pinia.vuejs.org)** — Vue 官方状态管理库，TypeScript 友好

### UI 与可视化

- **[ECharts](https://echarts.apache.org)** — Apache 旗下开源数据可视化图表库
- **[lucide](https://lucide.dev)** — 美观、一致的开源 SVG 图标库
- **[KaTeX](https://katex.org)** — 最快的 Web 数学公式渲染库，支持 LaTeX 语法

### 数据处理

- **[SheetJS (xlsx)](https://sheetjs.com)** — 前端 Excel 读写处理库
- **[day.js](https://day.js)** — 轻量级日期处理库，moment.js 的现代替代

### 桌面端

- **[tauri-plugin-fs](https://tauri.app/plugin/file-system/)** — Tauri 文件系统插件
- **[tauri-plugin-dialog](https://tauri.app/plugin/dialog/)** — Tauri 对话框插件
- **[tauri-plugin-shell](https://tauri.app/plugin/shell/)** — Tauri 系统命令插件
- **[WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)** — Microsoft Edge WebView2 运行时

### 开发工具

- **[Rust](https://www.rust-lang.org)** — 内存安全、高性能的系统编程语言
- **[Sharp](https://sharp.pixelplumbing.com)** — 高性能 Node.js 图像处理库

---

## 开源来源声明

本项目的构建依赖以下开源生态，虽非直接依赖但亦受益匪浅：

- **[NSIS](https://nsis.sourceforge.io)** — Nullsoft Scriptable Install System，Windows 安装包制作
- **[PowerShell](https://github.com/PowerShell/PowerShell)** — Windows 自动化脚本
- **[Git](https://git-scm.com)** — 分布式版本控制系统
- **[npm](https://www.npmjs.com)** — Node 包管理器

本项目不包含任何第三方闭源 SDK 或商业组件。所有功能均基于上述开源技术实现。

---

## 关于

Copyright &copy; 2026 牛马科技. All Rights Reserved.

本项目为个人学习与科研用途开发，源代码仅供学习参考。

如需二次开发，请前往 [Releases](https://github.com/Lian-yz/MasterWorkbench/releases) 下载源码包，解压后执行：

```bash
npm install
npm run dev          # 浏览器端开发
npx tauri dev       # 桌面端开发
npx tauri build     # 桌面端构建
```
