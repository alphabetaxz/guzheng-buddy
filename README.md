# 古筝小伴侣 (Guzheng Buddy)

面向 5 岁零基础儿童的横屏古筝启蒙游戏化 App（Capacitor + Preact + TypeScript + Web Audio + Pitchy）。

## 技术栈

- **跨端容器**：Capacitor 8（Android 横屏 `sensorLandscape` + `arm64-v8a` + R8 极小体积裁剪）
- **前端框架**：Vite + Preact + TypeScript + Tailwind CSS
- **实时听音**：Web Audio API + `pitchy`（MPM 时域基频检测，0 模型体积）
- **音频合成**：Karplus-Strong 21 弦拨弦合成 + Web Audio 奖励音效 + Web Speech 中文语音
- **数据校验与测试**：Zod + Vitest

## 文档与原型

- MVP 设计与分步开发计划：[docs/mvp-plan.md](./docs/mvp-plan.md)
- 横屏交互式 HTML 原型：[docs/prototype.html](./docs/prototype.html)

## 常用命令

```bash
npm install
npm run dev           # 本地浏览器调试（推荐横屏手机视图 844x390）
npm run typecheck     # TypeScript 类型检查
npm test              # 运行 Vitest 单元测试
npm run test:coverage # 运行测试并输出覆盖率报告
npm run build         # 生产构建（输出到 dist/）
npm run cap:sync      # 构建并同步 Web 产物到 Android 工程
```

## Android APK 打包（本地需配置 Android SDK）

```bash
npm run cap:sync
cd android
./gradlew assembleRelease
```

产物位于 `android/app/build/outputs/apk/release/`，已配置单 `arm64-v8a` ABI 过滤与 `minifyEnabled` + `shrinkResources` R8 裁剪。
