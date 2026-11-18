# 古筝小伴侣 (Guzheng Buddy)

面向 5 岁零基础儿童的横屏古筝启蒙游戏化 App（Capacitor + Preact + TypeScript + Web Audio + Pitchy）。

## 技术栈

- **跨端容器**：Capacitor 8（优先 Android，兼顾 iOS，目标极小安装包体积）
- **前端框架**：Vite + Preact + TypeScript + Tailwind CSS
- **实时听音**：Web Audio API + `pitchy`（MPM 时域基频检测，0 模型体积）
- **数据校验与测试**：Zod + Vitest

## 文档与原型

- MVP 设计与分步开发计划：[docs/mvp-plan.md](./docs/mvp-plan.md)
- 横屏交互式 HTML 原型：[docs/prototype.html](./docs/prototype.html)

## 常用命令

```bash
npm install
npm run dev        # 本地浏览器调试
npm run typecheck  # TypeScript 类型检查
npm test           # 运行 Vitest 单元测试
npm run build      # 生产构建（输出到 dist/）
```
