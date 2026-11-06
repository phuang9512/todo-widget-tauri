# Build the Windows launcher/installer.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

foreach ($cmd in @("cargo", "npm")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "Missing '$cmd'. Install Rust (https://rustup.rs) with the MSVC toolchain, plus Node.js 20+."
    }
}

Write-Host "Installing frontend tooling..."
npm install

Write-Host "Building Tauri app and NSIS installer..."
npm run tauri build -- --bundles nsis

$exe = Join-Path $root "src-tauri\target\release\desk-todo.exe"
$dist = Join-Path $root "dist\windows"
if (-not (Test-Path -LiteralPath $exe)) {
    throw "Build finished but '$exe' was not found."
}
New-Item -ItemType Directory -Force -Path $dist | Out-Null
Copy-Item -LiteralPath $exe -Destination (Join-Path $dist "待办清单.exe") -Force

Write-Host ""
Write-Host "Portable launcher: $dist\待办清单.exe"
Write-Host "Installer:          $root\src-tauri\target\release\bundle\nsis"
Write-Host "Note: Windows 10/11 needs the WebView2 Runtime (already present on most systems)."
