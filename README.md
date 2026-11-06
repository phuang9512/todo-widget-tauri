# 待办清单 · Tauri 桌面版

把原来的「HTML + Edge 应用窗口」版本封装成 Windows / macOS 原生桌面应用。界面、数据结构和交互保持一致，新增了原生剪贴板通道，复制任务不再依赖浏览器权限。

## 当前状态

工程、图标、双平台构建脚本和 GitHub Actions 已就绪。**仓库不包含编译好的 `.exe` / `.app`**，因为 Tauri 的 macOS 与 Windows 产物需要分别在对应系统上编译；当前开发机没有 Rust 工具链，也无法访问 crates.io / GitHub。

不想在本机装 Rust，可以直接看 [GITHUB_BUILD_GUIDE.md](GITHUB_BUILD_GUIDE.md)：从建仓库、上传文件到在 Actions 里点击构建、下载 `.exe` / `.dmg`，有完整的分步说明。

## 目录

```
todo-widget-tauri/
├─ app/                     # 复用的前端（HTML/CSS/JS）
├─ src-tauri/
│  ├─ src/lib.rs            # Tauri 入口 + 原生剪贴板命令
│  ├─ src/main.rs
│  ├─ icons/                # 猫猫图标（ico / icns / png）
│  ├─ capabilities/         # Tauri 2 权限
│  ├─ Cargo.toml
│  └─ tauri.conf.json       # 窗口 484×701、标题、图标、打包配置
├─ scripts/
│  ├─ build-windows.ps1     # 生成便携 exe + NSIS 安装包
│  ├─ build-macos.sh        # 生成 universal .app + dmg
│  └─ make-icons.py         # 从猫照片重新生成图标
├─ GITHUB_BUILD_GUIDE.md    # 不装 Rust，用 GitHub Actions 打包的分步教程
├─ .github/workflows/build-desktop.yml
└─ package.json
```

## 构建要求

### Windows

- Windows 10/11
- [Rust](https://rustup.rs) stable，默认 `x86_64-pc-windows-msvc` 工具链
- Visual Studio 2022 Build Tools，勾选「使用 C++ 的桌面开发」
- Node.js 20+
- WebView2 Runtime（Win10/11 通常已自带）

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1
```

产物：

- 便携启动器：`dist\windows\待办清单.exe`
- 安装包：`src-tauri\target\release\bundle\nsis\`

未签名时 Windows SmartScreen 可能提示「Windows 已保护你的电脑」，点「更多信息 → 仍要运行」即可。正式分发建议配置代码签名证书。

### macOS

- macOS 10.15+
- Xcode Command Line Tools：`xcode-select --install`
- [Rust](https://rustup.rs) stable
- Node.js 20+

```bash
bash scripts/build-macos.sh
```

脚本会添加 Apple Silicon 与 Intel 两个 target，生成 universal 应用：

- `dist/macos/待办清单.app`
- `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`

未签名的应用首次打开时，macOS 可能提示「无法验证开发者」。可在「系统设置 → 隐私与安全性」里选择仍要打开；正式分发需要 Apple Developer 证书并配置签名/公证。

## GitHub Actions

把工程推到 GitHub 后，在 Actions 里手动运行 **Build desktop launchers**，或推送 `v*` 标签。两个 job 会分别产出：

- `desk-todo-windows`：NSIS 安装包 + `dist/windows/待办清单.exe` 便携启动器
- `desk-todo-macos`：`.app` 与 `.dmg`

## 与浏览器版的差异

- 复制走 Rust `arboard` 系统剪贴板，不依赖 `navigator.clipboard` 或 `file://` 权限。
- 数据保存在 Tauri WebView 自己的 localStorage 中，与旧版 Edge `.profile` **不是同一份数据**。旧版里的任务不会自动迁移；需要的话可以后续加 JSON 导入/导出。
- 窗口默认 484×701，居中；可缩放，最小 420×560。
- 应用不联网；没有自动更新。

## 开发

只改界面时，直接编辑 `app/` 下的文件；Tauri 构建时会把整个 `app/` 作为前端资源打包。本工程使用静态前端，不需要前端构建步骤。
