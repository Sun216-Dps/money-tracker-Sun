# 记账本 V1.1 — 打包 Android APK 指南

网页版在项目根目录（`index.html` 等 4 个文件），Android 壳工程在 `android/`。
壳工程是**原生 Java + WebView**，无第三方依赖，内置：
- 全屏网页容器（加载 `assets/www/index.html`）
- 文件选择器（导入 Excel / 导入 JSON 备份可用）
- JS 桥 `AndroidBridge.saveFile()`（导出 Excel/备份时保存到手机「下载」目录）

> 前置条件：JDK 17+、Android SDK（build-tools + 任一 platform）。以下方式任选其一。

---

## 方式一：Android Studio（推荐，最省事）

1. 下载安装 **Android Studio**：https://developer.android.com/studio
   （自带 JDK 17、SDK、Gradle，安装向导会引导下载 SDK）
2. 首次启动跟随向导下载 SDK（至少勾选 **Android 14 (API 34) Platform** 与 Build-Tools）
3. 打开本项目下的 `android/` 目录：`File → Open → 选择 <项目目录>\android`
4. 等待 Gradle 同步完成（会自动下载 Gradle 与 AGP 依赖，需联网）
5. 点 **Build → Build Bundle(s) / APK(s) → Build APK(s)**
6. 完成后点通知里的 **locate**，得到
   `android\app\build\outputs\apk\debug\app-debug.apk`
7. 把 APK 发到手机安装（需允许「安装未知应用」）

---

## 方式二：命令行

### 2A. 离线打包（推荐，不需要 Gradle）

1. 确认 `ANDROID_HOME`（或 `ANDROID_SDK_ROOT`）指向 Android SDK：
   ```powershell
   echo $env:ANDROID_HOME      # 例：C:\Users\你\AppData\Local\Android\Sdk
   ```
2. 在项目根目录执行：
   ```powershell
   .\build-apk-offline.ps1
   ```
   脚本直接用 SDK 的 aapt2 / javac / d8 / zipalign / apksigner 出包，
   产物为 `jizhang-<版本>.apk`（项目根目录）。
   JDK 会自动查找（`JAVA_HOME` → PATH → Android Studio 自带），找不到时可用
   `-JdkPath` 指定：
   ```powershell
   .\build-apk-offline.ps1 -JdkPath "C:\Program Files\Android\Android Studio\jbr"
   ```

### 2B. Gradle 打包（需要 JDK + Android SDK + Gradle）

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
| 构建提示找不到 `assets/www` | 运行 `build-apk-offline.ps1`（会先同步），或用 Gradle/Android Studio 构建（任务 `syncWebAssets` 会自动同步） |
| 找不到 JDK（离线脚本报错） | 设置 `JAVA_HOME`，或运行时传 `-JdkPath '<JDK目录>'` |
| 手机上导出无反应 | 确认装的是本工程打的 APK（含 `AndroidBridge` 桥），导出会保存到「下载」目录 |
| 导入 Excel 提示不支持解压 | 系统 WebView 版本过低，升级 Android System WebView 即可 |
