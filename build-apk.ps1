# 记账本 APK 一键打包脚本
# 用法：
#   .\build-apk.ps1            构建 debug 版（可直接安装测试）
#   .\build-apk.ps1 -Release   构建 release 版（未签名，需自己配置签名）
#
# 前置条件（缺一不可）：
#   1. 安装 JDK 17+（Android Studio 自带）
#   2. 安装 Android SDK（ANDROID_HOME 或 ANDROID_SDK_ROOT 指向 SDK 目录）
#   3. 安装 Gradle，或使用 Android Studio 打开 android/ 目录构建

param(
    [switch]$Release
)

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$androidDir = Join-Path $root 'android'
$wwwDir = Join-Path $androidDir 'app/src/main/assets/www'

Write-Host "==> 同步网页资源到 assets/www" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $wwwDir | Out-Null
@('index.html', 'style.css', 'app.js', 'xlsx-lite.js') | ForEach-Object {
    Copy-Item (Join-Path $root $_) (Join-Path $wwwDir $_) -Force
}
Write-Host "   完成：$wwwDir"

Write-Host "==> 检查 Android 工具链" -ForegroundColor Cyan
$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }

if (-not $sdk -or -not (Test-Path $sdk)) {
    Write-Host "❌ 未找到 Android SDK（ANDROID_HOME / ANDROID_SDK_ROOT 均未设置或路径不存在）" -ForegroundColor Red
    Write-Host "   请安装 Android Studio（自带 SDK 与 JDK），或安装 SDK Command-line Tools 后设置环境变量，" -ForegroundColor Yellow
    Write-Host "   详见 BUILD.md。" -ForegroundColor Yellow
    exit 1
}
Write-Host "   ANDROID_HOME = $sdk"

$gradlew = Join-Path $androidDir 'gradlew.bat'
$gradleCmd = Get-Command gradle -ErrorAction SilentlyContinue

if (Test-Path $gradlew) {
    $builder = $gradlew
} elseif ($gradleCmd) {
    $builder = 'gradle'
} else {
    Write-Host "❌ 未找到 gradle（也没有 gradlew）。" -ForegroundColor Red
    Write-Host "   用 Android Studio 打开 android/ 目录构建，或安装 Gradle 后重试。" -ForegroundColor Yellow
    exit 1
}
Write-Host "   构建器：$builder"

$task = if ($Release) { 'assembleRelease' } else { 'assembleDebug' }

Write-Host "==> 开始构建（$task）" -ForegroundColor Cyan
Push-Location $androidDir
try {
    & $builder $task
    if ($LASTEXITCODE -ne 0) { throw "构建失败（exit code $LASTEXITCODE）" }
}
finally {
    Pop-Location
}

$apk = Get-ChildItem -Path (Join-Path $androidDir 'app/build/outputs/apk') -Recurse -Filter *.apk -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($apk) {
    Write-Host ""
    Write-Host "✅ 构建成功：$($apk.FullName)" -ForegroundColor Green
    Write-Host ("   APK 大小：{0:N1} MB" -f ($apk.Length / 1MB))
    Write-Host "   传到手机安装时，需在系统设置里允许「安装未知应用」。" -ForegroundColor Yellow
}
else {
    Write-Host "⚠ 构建结束但未找到 APK 输出，请检查上方日志。" -ForegroundColor Yellow
}
