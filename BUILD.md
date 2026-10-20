# 记账本 V1.0 — 打包 Android APK 指南

网页版在项目根目录（`index.html` 等 4 个文件），Android 壳工程在 `android/`。
壳工程是**原生 Java + WebView**，无第三方依赖，内置：
- 全屏网页容器（加载 `assets/www/index.html`）
- 文件选择器（导入 Excel / 导入 JSON 备份可用）
- JS 桥 `AndroidBridge.saveFile()`（导出 Excel/备份时保存到手机「下载」目录）

> ⚠️ 本机目前**没有** JDK / Android SDK / Gradle。以下两种方式任选其一。

---

## 方式一：Android Studio（推荐，最省事）

1. 下载安装 **Android Studio**：https://developer.android.com/studio
   （自带 JDK 17、SDK、Gradle，安装向导会引导下载 SDK）
2. 首次启动跟随向导下载 SDK（至少勾选 **Android 14 (API 34) Platform** 与 Build-Tools）
3. 打开 `android/` 目录：`File → Open → 选择 D:\AI\Harness\money-tracker\android`
4. 等待 Gradle 同步完成（会自动下载 Gradle 与 AGP 依赖，需联网）
5. 点 **Build → Build Bundle(s) / APK(s) → Build APK(s)**
6. 完成后点通知里的 **locate**，得到
   `android\app\build\outputs\apk\debug\app-debug.apk`
7. 把 APK 发到手机安装（需允许「安装未知应用」）

---

## 方式二：命令行（需要已装好 JDK + Android SDK + Gradle）

1. 确认环境变量：
   ```powershell
   echo $env:ANDROID_HOME      # 例：C:\Users\你\AppData\Local\Android\Sdk
   java -version               # 需 17+
   gradle -v                   # 需 8.x
   ```
2. 在项目根目录执行：
   ```powershell
   .\build-apk.ps1
   ```
   脚本会先把网页资源同步进 `assets/www`，再执行 `gradle assembleDebug`。

---

## 方式三：手机先体验（无需 APK）

把本目录 4 个网页文件放到任意静态托管（如 GitHub Pages），手机浏览器打开后
「添加到主屏幕」，即可像 App 一样使用，数据存在手机浏览器本地。

---

## 常见问题

| 问题 | 处理 |
| --- | --- |
| Gradle 下载很慢/失败 | 给 Gradle 配国内镜像，或配置代理后重试 |
| `SDK location not found` | 用 Android Studio 打开一次，会自动生成 `local.properties` |
| 构建提示找不到 `assets/www` | 先运行 `build-apk.ps1`（会同步），或直接构建（Gradle 任务 `syncWebAssets` 会自动同步） |
| 手机上导出无反应 | 确认装的是本工程打的 APK（含 `AndroidBridge` 桥），导出会保存到「下载」目录 |
| 导入 Excel 提示不支持解压 | 系统 WebView 版本过低，升级 Android System WebView 即可 |
