# All Agents in One 项目规范

## 目标

构建一个本地桌面终端工作台，以“项目 → 多个终端会话”的方式组织 CLI Agent。

## 技术约定

- 使用 Electron、React、TypeScript、xterm.js、node-pty 和 tmux。
- 每个终端会话是一个独立的 tmux session（独立 server：`-L all-agents-in-one`），应用内通过 xterm.js 内嵌显示；也可通过 AppleScript 在 iTerm2 窗口中 attach 同一会话。
- Electron 主进程独占 PTY（node-pty 连接 tmux）与文件系统操作，渲染进程仅通过 preload 暴露的类型化 API 通信。
- 应用退出只断开显示连接，不 kill tmux session，重启后可恢复。
- 保持 `contextIsolation: true`、`nodeIntegration: false`。
- 使用 JSON 保存项目和终端定义，不引入数据库。
- 不解析或耦合 Codex、Claude 等具体 CLI 的输出协议。

## 目录约定

- `src/main/`：Electron 主进程、PTY 与 tmux 管理（`tmux.ts`）、iTerm 集成（`iterm.ts`）、输入过滤（`input-parser.ts`）与持久化。
- `src/preload/`：安全 IPC 桥。
- `src/renderer/`：React 用户界面（项目树 + 内嵌终端）。
- `src/shared/`：跨进程共享类型。

## 验证要求

- 每次功能改动至少执行 `npm run typecheck` 和 `npm run build`。
- PTY 生命周期变更必须验证：创建、输入、缩放、切换和关闭。
- 已验证事项才可写入 `ROADMAP.md` 的“已完成”。
