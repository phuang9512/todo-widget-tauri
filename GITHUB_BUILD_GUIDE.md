# 用 GitHub 打包 Windows `.exe` 和 macOS `.app`

这份指南按「没有装 Git，只用浏览器」的方式写。全程不需要在本机装 Rust；GitHub 会分别在 Windows 和 macOS 的机器上编译。

---

## 0. 先理解：为什么不是一个包

Tauri 不是把网页塞进一个通用容器，而是用各平台的原生 WebView 编译：

- **Windows**：WebView2 + MSVC，产物是 `.exe` 和 NSIS 安装包。
- **macOS**：WKWebView + Xcode，产物是 `.app` 和 `.dmg`。

所以同一份代码要在两个系统上各编译一次。GitHub Actions 的「矩阵」就是同时开一台 Windows 和一台 macOS 帮你编译。

---

## 1. 解压源码，确认目录结构

1. 解压 `todo-widget-tauri-source.zip`。
2. 打开解压后的 `todo-widget-tauri` 文件夹。
3. 确认里面**直接**有这些内容：

```text
.github/
app/
scripts/
src-tauri/
.gitattributes
.gitignore
package.json
README.md
```

注意：不要再套一层 `todo-widget-tauri/todo-widget-tauri/`。GitHub 仓库的根目录必须直接是上面这些文件，Actions 才能找到 `.github/workflows/build-desktop.yml`。

### 显示隐藏文件

`.github` 以点开头，有些系统默认不显示：

- **Windows 11**：文件资源管理器 →「查看」→「显示」→ 勾选「隐藏的项目」。
- **macOS**：在 Finder 里按 `Cmd + Shift + .`。

---

## 2. 建一个 GitHub 仓库

1. 登录 GitHub。
2. 右上角 `+` → **New repository**。
3. 填写：
   - **Repository name**：`todo-widget-tauri`
   - **Description**：可留空
   - **Private** 或 **Public**：都可以。Private 也能用 Actions，免费额度足够一次构建。
4. **不要**勾选「Add a README file」「Add .gitignore」「Choose a license」，保持空仓库。
5. 点 **Create repository**。

---

## 3. 上传文件（关键步骤）

1. 在新建的空仓库页面，点 **uploading an existing file**。
2. 打开第 1 步的 `todo-widget-tauri` 文件夹。
3. 全选里面的**内容**（`Ctrl + A` / `Cmd + A`），拖进 GitHub 的上传框。

   **不要**把 `todo-widget-tauri` 文件夹本身拖进去，否则仓库里会多一层目录，Actions 不会运行。

4. 等上传完成，确认文件列表里能看到：

```text
.github/workflows/build-desktop.yml
package.json
src-tauri/tauri.conf.json
...
```

5. 下方 Commit changes 里写一句 `Add Tauri todo app`，点 **Commit changes**。

### 如果 `.github` 没上传成功

GitHub 网页有时候会漏掉点开头的文件夹。可以手动补：

1. 仓库页 → **Add file** → **Create new file**。
2. 文件名填：

```text
.github/workflows/build-desktop.yml
```

3. 用记事本/文本编辑器打开本地的 `.github/workflows/build-desktop.yml`，全选复制，粘贴进去。
4. Commit。

只要这个文件在默认分支的根目录下，Actions 就能识别。

---

## 4. 运行 Actions

1. 点仓库顶部的 **Actions**。
2. 左侧应出现 **Build desktop launchers**。
3. 点进去，右上角有 **Run workflow**：
   - Branch 选 `main`
   - 点绿色 **Run workflow**
4. 刷新页面，会出现一次新的运行记录。
5. 点进去，左侧有两个 job：
   - `windows`
   - `macos`

第一次构建通常要 10–20 分钟；macOS universal 编译会慢一些。两个 job 都变成绿色勾，就成功了。

> 如果 Actions 页面没有这个 workflow：先检查 `.github/workflows/build-desktop.yml` 是否真的在仓库根目录；再检查 Settings → Actions → General 是否允许 Actions。

---

## 5. 下载产物

打开成功的运行记录，拉到页面底部 **Artifacts**：

- `desk-todo-windows`
- `desk-todo-macos`

分别下载，得到两个 `.zip`。解压后：

### Windows

找到：

```text
dist/windows/待办清单.exe
```

这是便携版，双击就能用。安装包在：

```text
src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/
```

文件名类似 `待办清单_0.1.0_x64-setup.exe`。

首次运行可能遇到：

- **SmartScreen**：点「更多信息」→「仍要运行」。
- **缺少 WebView2**：Windows 10/11 一般自带；如果没有，安装 Microsoft Edge WebView2 Runtime。

### macOS

找到：

```text
src-tauri/target/universal-apple-darwin/release/bundle/dmg/
```

里面的 `.dmg` 文件名类似 `待办清单_0.1.0_universal.dmg`，以实际文件为准。

双击 `.dmg`，把「待办清单」拖进「应用程序」。

**优先用 `.dmg`，不要直接用 artifact 里的裸 `.app`。** GitHub 的 artifact zip 不保证保留 macOS 的可执行权限和符号链接；`.dmg` 里的 app bundle 是完整的。

首次打开可能提示「无法验证开发者」：

- 右键 app → **打开** → 再点「打开」；
- 或到「系统设置 → 隐私与安全性」里点「仍要打开」。

如果提示「应用已损坏」，通常是直接解压了裸 `.app`。改用 `.dmg` 里的版本。

---

## 6. 做成 Release（可选）

Actions 的 artifact 默认保留 90 天。想长期分享，可以发 Release：

1. 仓库首页右侧 **Releases** → **Draft a new release**。
2. Tag 填 `v0.1.0`，标题写 `待办清单 v0.1.0`。
3. 把 Windows 的 `.exe` / 安装包和 macOS 的 `.dmg` 拖进附件区。
4. **Publish release**。

这样别人打开 Releases 就能直接下载，不受 artifact 过期影响。

---

## 7. 以后改了代码怎么重新打包

1. 在 GitHub 上直接编辑文件，或重新上传修改后的文件。
2. Commit。
3. 回到 Actions → **Build desktop launchers** → **Run workflow**。
4. 重新下载 artifact。

工作流也配置了推送 `v*` 标签时自动运行；但手动 `Run workflow` 最直观。

---

## 8. 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| Actions 里没有 workflow | `.github/workflows/build-desktop.yml` 不在仓库根目录；或仓库多套了一层文件夹 |
| 点 Run workflow 没反应 | 确认 workflow 在默认分支 `main` 上；确认你有仓库写权限 |
| `npm install` 失败 | 检查 Node 版本（工作流用 20）；重跑一次；看日志里的具体包名 |
| Rust 编译失败 | 看失败 job 的日志；Windows 需要 MSVC，macOS 需要 Xcode；GitHub 的 runner 已预装 |
| 构建成功但 artifact 为空 | 看 `Stage Windows portable exe` / `Stage macOS app` 步骤是否报路径不存在；检查 Tauri 输出目录 |
| Windows 打不开 | 先装 WebView2；SmartScreen 选「仍要运行」 |
| macOS 提示未验证/已损坏 | 用 `.dmg` 而不是裸 `.app`；右键打开；未签名应用需要手动放行 |
| 想改应用名/图标 | 改 `src-tauri/tauri.conf.json` 的 `productName`，图标在 `src-tauri/icons/`，然后重新构建 |

---

## 9. 如果想在本机编译（可选）

### Windows 本机

安装：

- Rust stable（rustup，默认 MSVC 工具链）
- Visual Studio 2022 Build Tools，勾选「使用 C++ 的桌面开发」
- Node.js 20+
- WebView2 Runtime

然后：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1
```

### macOS 本机

安装：

- Xcode Command Line Tools：`xcode-select --install`
- Rust stable（rustup）
- Node.js 20+

然后：

```bash
bash scripts/build-macos.sh
```

macOS 的 `.app` 必须在 macOS 上编译；Windows 不能直接交叉编译出可用的 `.app`，所以用 GitHub 的 macOS runner 最省事。

---

## 10. 数据提醒

Tauri 版的数据在 WebView 自己的 localStorage 里，和旧版 Edge 的 `D:\dsh\todo-widget\.profile` **不是同一份**。旧版里的任务不会自动出现在 Tauri 版。

旧版桌面快捷方式仍然可用，数据也没有被删除。需要把旧任务带过去，可以后续加一个 JSON 导入/导出功能。

---

## 最短路径总结

1. 解压 zip，确认根目录有 `.github`、`src-tauri`、`package.json`。
2. GitHub 新建空仓库。
3. 上传这些**内容**（不要多套一层文件夹）。
4. Actions → Build desktop launchers → Run workflow。
5. 下载 `desk-todo-windows` 和 `desk-todo-macos`。
6. Windows 用 `待办清单.exe`；macOS 用 `.dmg`。
