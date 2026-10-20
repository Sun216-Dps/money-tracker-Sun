# build-apk-offline.ps1 — 不依赖 Gradle 的离线 APK 打包脚本
# 直接用 Android SDK 的 aapt2 / javac / d8 / zipalign / apksigner 产出 debug APK
# 用法： .\build-apk-offline.ps1

$ErrorActionPreference = 'Stop'

# ---------- 环境定位 ----------
$root = $PSScriptRoot
$jbr = 'D:\Android studio 2\jbr'
if (-not (Test-Path "$jbr\bin\javac.exe")) {
    Write-Host "❌ 未找到 Android Studio 自带 JDK：$jbr" -ForegroundColor Red
    exit 1
}

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { "$env:LOCALAPPDATA\Android\Sdk" }
$btDir = Get-ChildItem "$sdk\build-tools" -Directory | Sort-Object Name -Descending | Select-Object -First 1
$platformDir = Get-ChildItem "$sdk\platforms" -Directory | Sort-Object Name -Descending | Select-Object -First 1
if (-not $btDir -or -not $platformDir) {
    Write-Host "❌ 未找到 build-tools 或 platforms（SDK: $sdk）" -ForegroundColor Red
    exit 1
}

$platformJar = Join-Path $platformDir.FullName 'android.jar'
$appDir = Join-Path $root 'android\app'
$assetsDir = Join-Path $appDir 'src\main\assets'
$resDir = Join-Path $appDir 'src\main\res'
$javaSrc = Join-Path $appDir 'src\main\java\com\example\jizhang\MainActivity.java'
$manifestSrc = Join-Path $appDir 'src\main\AndroidManifest.xml'

$build = Join-Path $root 'build'
$classesDir = Join-Path $build 'classes'
$dexDir = Join-Path $build 'dex'
$resZip = Join-Path $build 'res.zip'
$baseApk = Join-Path $build 'base.apk'
$alignedApk = Join-Path $build 'aligned.apk'
$signedApk = Join-Path $build 'app-debug.apk'
$tmpManifest = Join-Path $build 'AndroidManifest.xml'
$keystore = Join-Path $build 'debug.keystore'

Write-Host "==> JDK      : $jbr" -ForegroundColor Cyan
Write-Host "==> SDK      : $sdk" -ForegroundColor Cyan
Write-Host "==> build-tools: $($btDir.Name)" -ForegroundColor Cyan
Write-Host "==> platform : $($platformDir.Name)" -ForegroundColor Cyan

function Run-Step($name, [scriptblock]$cmd) {
    Write-Host "==> $name" -ForegroundColor Cyan
    & $cmd
    if ($LASTEXITCODE -ne 0) { throw "步骤失败：$name (exit $LASTEXITCODE)" }
}

# ---------- 0. 准备目录 ----------
if (Test-Path $build) { Remove-Item $build -Recurse -Force }
New-Item -ItemType Directory -Force -Path $build, $classesDir, $dexDir | Out-Null

# ---------- 1. 同步网页资源到 assets ----------
$www = Join-Path $assetsDir 'www'
New-Item -ItemType Directory -Force -Path $www | Out-Null
@('index.html', 'style.css', 'app.js', 'xlsx-lite.js') | ForEach-Object {
    Copy-Item (Join-Path $root $_) (Join-Path $www $_) -Force
}
Write-Host "==> 已同步网页资源到 assets/www" -ForegroundColor Cyan

# ---------- 2. 生成带 package 属性的临时清单（aapt2 需要） ----------
$manifestText = Get-Content $manifestSrc -Raw -Encoding UTF8
if ($manifestText -notmatch 'package="') {
    $manifestText = $manifestText -replace 'xmlns:android="http://schemas.android.com/apk/res/android"',
        'xmlns:android="http://schemas.android.com/apk/res/android" package="com.example.jizhang"'
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tmpManifest, $manifestText, $utf8NoBom)
Write-Host "==> 生成清单：$tmpManifest" -ForegroundColor Cyan

# ---------- 3. 编译资源 ----------
Run-Step 'aapt2 compile 资源' {
    & (Join-Path $btDir.FullName 'aapt2.exe') compile --dir $resDir -o $resZip
}

# ---------- 4. 链接资源 + 清单 + assets ----------
Run-Step 'aapt2 link 生成 base.apk' {
    & (Join-Path $btDir.FullName 'aapt2.exe') link `
        -o $baseApk `
        -I $platformJar `
        --manifest $tmpManifest `
        --min-sdk-version 21 `
        --target-sdk-version 34 `
        --version-code 1 `
        --version-name 1.0.0 `
        -A $assetsDir `
        $resZip
}

# ---------- 5. 编译 Java ----------
Run-Step 'javac 编译 MainActivity' {
    # 明确输出 Java 17 字节码（class file 61），避免 d8 拒绝过高版本
    & "$jbr\bin\javac.exe" -encoding UTF-8 -source 17 -target 17 -nowarn -cp $platformJar -d $classesDir $javaSrc
}

# ---------- 6. d8 转 dex ----------
$classFiles = Get-ChildItem $classesDir -Recurse -Filter *.class | ForEach-Object { $_.FullName }
Run-Step 'd8 生成 classes.dex' {
    $env:JAVA_HOME = $jbr
    & (Join-Path $btDir.FullName 'd8.bat') --release --min-api 21 --output $dexDir @classFiles
}

# ---------- 7. 把 classes.dex 打进 APK ----------
Write-Host "==> 将 classes.dex 写入 APK" -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
$dexFile = Join-Path $dexDir 'classes.dex'
if (-not (Test-Path $dexFile)) { throw '未生成 classes.dex' }
[System.IO.Compression.ZipFile]::Open($baseApk, 'Update').Dispose()
$zip = [System.IO.Compression.ZipFile]::Open($baseApk, 'Update')
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $dexFile, 'classes.dex') | Out-Null
$zip.Dispose()

# ---------- 8. 对齐 ----------
Run-Step 'zipalign 对齐' {
    & (Join-Path $btDir.FullName 'zipalign.exe') -f -p 4 $baseApk $alignedApk
}

# ---------- 9. debug 签名 ----------
if (-not (Test-Path $keystore)) {
    Run-Step '生成 debug 签名证书' {
        & "$jbr\bin\keytool.exe" -genkeypair -v `
            -keystore $keystore -storepass android -keypass android `
            -alias androiddebugkey -dname "CN=Android Debug,O=Android,C=US" `
            -keyalg RSA -keysize 2048 -validity 10000
    }
}

Run-Step 'apksigner 签名' {
    $env:JAVA_HOME = $jbr
    & (Join-Path $btDir.FullName 'apksigner.bat') sign `
        --ks $keystore --ks-pass pass:android --key-pass pass:android `
        --out $signedApk $alignedApk
}

Run-Step 'apksigner 验证签名' {
    & (Join-Path $btDir.FullName 'apksigner.bat') verify --verbose $signedApk
}

# ---------- 10. 输出 ----------
$finalApk = Join-Path $root 'jizhang-v1.0.0.apk'
Copy-Item $signedApk $finalApk -Force
Write-Host ""
Write-Host "✅ 打包成功：$finalApk" -ForegroundColor Green
Write-Host ("   大小：{0:N1} MB" -f ((Get-Item $finalApk).Length / 1MB)) -ForegroundColor Green
Write-Host "   传手机安装：允许「安装未知应用」即可。" -ForegroundColor Yellow
