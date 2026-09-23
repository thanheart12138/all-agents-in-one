# Roadmap

## 当前阶段

v0.2.0 已发布（2026-09-23）：Git 分支徽标、顶部 CLI 状态栏（Model/ctx/Total/Cost）、5h/7d 额度直读（kimi 云端 /usages + codex 本地 session 文件）、iTerm2 主题同步、GUI 环境中文 UTF-8 修复。待实际使用反馈与签名发布准备。

## 已完成

- 明确 MVP 范围与 Electron 技术方案。
- 建立 Electron、React、TypeScript 项目骨架。
- 实现项目树、项目目录选择和配置持久化。
- 实现真实 PTY 的创建、输入、输出、缩放、重启与关闭。
- 实现同一项目内多个终端及跨项目终端切换。
- 完成基础视觉界面与空状态。
- 补充本地运行和使用说明。
- 新建终端后直接进入 Shell，并自动聚焦。
- 根据用户输入的首条命令自动命名终端。
- 增加 `Ready` 与 `Running` 活动状态，并根据终端输入输出自动切换。
- 按参考界面增强项目与会话的树状层级。
- 在会话项中持久化并展示最近一次用户输入。
- 修复 ANSI／OSC 终端响应被误记为用户消息的问题，并自动清理已有脏数据。
- 将活动状态改为输入驱动，避免 Kimi 空闲刷新导致 `Ready`／`Running` 抖动。
- 为 Kimi、Codex、Claude、Grok、Gemini 和普通 Shell 增加命令图标。
- 增加应用内弹窗、右键菜单、快捷键和错误提示。
- 增加目录校验、Finder 定位与启动失败状态。
- 增加原生应用菜单和终端快捷操作。
- 完成品牌应用图标。
- 配置 macOS `.app`、DMG 和 ZIP 打包。
- 接入 tmux 持久会话层：独立 server（`-L all-agents-in-one`）与专用配置，应用退出仅 detach、重启自动重连恢复进程与画面。
- 内嵌终端（xterm.js + node-pty）连接 tmux 会话，另提供「在 iTerm 中打开」入口接管同一会话。
- 内嵌终端主题自动同步 iTerm2 默认 Profile：字体、字号、16 个 ANSI 色、背景/前景/光标/选区色（iTerm 亮/暗双配色时取暗色变体）；修复 GUI 启动（无 LANG 环境）时 tmux 判定客户端不支持 UTF-8、把中文渲染为下划线的问题（node-pty 环境显式补 UTF-8 locale）。
- 项目树在 Git 仓库目录旁显示分支徽标（直读 `.git/HEAD`，支持 worktree 与 detached HEAD，启动时解析、每 30 秒轮询、窗口聚焦时刷新）。
- 顶部 CLI 状态栏：`[项目名](分支) | CLI | Total | Cost | 5h | 7d | Model | ctx | tmux 会话 | 最近输入 | Ready/Running 状态`。其中 Model/ctx/Total/Cost 由 tmux capture-pane 只读抓取终端屏幕解析（支持 Kimi Code 新旧状态行与 Codex 状态行，识别不出自动隐藏，不耦合 CLI 内部协议）；5h/7d 额度由主进程直读（借鉴 token-tracker）：Kimi 走云端 `GET <base_url>/usages`（OAuth 凭证 `~/.kimi/credentials/kimi-code.json`，120 秒缓存、15 分钟失效），Codex 扫 `~/.codex/sessions/` 最近 5 个 jsonl 的 `token_count` 事件限额快照（纯本地、30 秒刷新），均为「已用百分比」，失败自动隐藏分段。

## 进行中

- 无。

## 待办

- 根据实际使用反馈继续打磨视觉与交互。
- 配置 Apple Developer ID 签名和 notarization。

## 阻塞

- 无。

## 最近验证

- 2026-09-22：`npm run typecheck` 通过。
- 2026-09-22：`npm run build` 通过。
- 2026-09-22：Electron 开发窗口成功启动并完成视觉检查。
- 2026-09-22：在 Electron 运行时内通过 node-pty 启动 `/bin/zsh`，收到 `PTY_OK` 并以状态码 0 退出。
- 2026-09-22：`npm run dist` 通过，生成 arm64 DMG 和 ZIP。
- 2026-09-22：打包后的 `.app` 成功启动，主进程未出现运行时错误。
- 2026-09-22：终端输入过滤回归通过，覆盖光标响应、颜色响应、普通中文输入、括号粘贴和旧脏数据识别。
- 2026-09-22：活动输出判断回归通过，覆盖光标、颜色、清行、普通文本和带样式文本。
- 2026-09-22：iTerm2 显示层改造后 `npm run typecheck` 与 `npm run build` 通过。
- 2026-09-22：修复窗口销毁后 PTY 数据推送导致的 `Object has been destroyed` 异常（窗口 closed 后置空 mainWindow 引用），typecheck 与 build 通过。
- 2026-09-22：tmux 持久会话生命周期回归通过（Electron 运行时 + node-pty + tmux 3.7b），覆盖创建、输入、缩放、退出 detach 后会话存活、重启重连恢复进程状态、kill-session 彻底关闭。
- 2026-09-22：`npm run typecheck` 与 `npm run dist` 通过，重新生成 arm64 DMG 和 ZIP（v0.1.0）。
- 2026-09-22：iTerm2 主显示层改造后 typecheck 与 build 通过；tmux 探测全生命周期实测（zsh→Ready、sleep→Running、exit→pane_dead、会话删除→null，修复 display-message 对不存在会话静默返回空输出的陷阱）；开发窗口视觉检查通过（kimi 会话正确显示 Running、codex 显示 Ready）。
- 2026-09-23：回退 iTerm 窗口管理方案，恢复内嵌 xterm 为主显示层；iTerm 主题解析器实测通过（含自闭合 `<dict/>`、亮/暗双配色取暗色变体）；打包后经 `open` 启动（GUI 无 LANG 环境）截图验证：中文正常渲染、Catppuccin 配色与 JetBrainsMonoNF 字体生效。typecheck 与 build 通过。
- 2026-09-23：分支徽标与 CLI 状态栏在 iTerm 主题版基础上重新合入，typecheck 与 build 通过；打包后截图验证：`wechat-gold-sentence`（git 仓库）正确显示 `main` 徽标，状态栏 `[项目名](main) | CLI | tmux | 最近输入 | Ready` 渲染正常，终端中文与配色保持正常。
- 2026-09-23：CLI 状态抓取解析器用 kimi/codex 真实画面实测通过（K3 + ctx 13.2%、gpt-5.6-sol + Context 0% used + weekly 0% left、普通 shell 与空屏均返回 null）；打包后截图确认状态栏显示 `Model: K3 | ctx: 0.0% (0/262.1k)`。
- 2026-09-23：5h/7d 额度直读上线（quota.ts）：Kimi `/usages` 接口实测返回 5h=25%、7d=68%（与 CLI 内 `/usage` 的 75%/32% left 互为补数，一致）；Codex 本地 session 文件实测解析出 weekly=100%；富状态行解析器单测通过（Total: 405k / Cost: $0.46 / 5h: 3% / 7d: 34% / Model: kimi-code/k3/high/auto）。typecheck、build、pack 通过；打包后截图确认状态栏显示 `[wechat-gold-sentence](main) | CLI: kimi | 5h: 25% | 7d: 68% | Model: K3 | ctx: 0.0% (0/262.1k) | …`。注意：`open` 可能激活 /Applications 下的旧安装包，验证时须用 `ps` 确认运行的是 release 目录新构建。
- 2026-09-23：v0.2.1 修复长输出无法向上回看——根因是 tmux.conf `mouse off`，终端架构（node-pty attach tmux）下滚动历史由 tmux 持有。改为 `mouse on` 并给 copy-mode/copy-mode-vi 的 MouseDragEnd1Pane 挂 copy-pipe-and-cancel pbcopy（拖选直接进 macOS 剪贴板）。启动时 source-file 热加载已验证：运行中 server `show -g mouse` = on、root 表 WheelUpPane 默认绑定在（kimi 等非 alt-screen 窗格滚轮向上即进入 copy-mode -e 翻历史，滚到底自动退出；alt-screen 应用则转发鼠标事件给应用）。typecheck、build、dist 通过；/Applications 已装 0.2.1，截图确认会话与状态栏正常。
- 2026-09-23：v0.2.2 修复拼音输入遮挡感——复现验证（合成 CompositionEvent + 真实 DOM 坐标比对）xterm 6.0 组合框定位精确到光标（x=172px=cursorX×cellWidth、y=460px=cursorY×cellHeight），问题是默认样式为不透明纯黑块；改为跟随终端主题底色 + 虚线下划线（`.composition-view` 用 `--terminal-bg/--terminal-fg` CSS 变量，TerminalView 按 iTerm 主题注入），视觉等同 iTerm 内联标记文本。另实测「选中复制」链路：node-pty 注入 SGR 鼠标拖选字节 → tmux copy-mode 选择 → 松开触发 copy-pipe-and-cancel → pbpaste 拿到选中内容，端到端通过（松开高亮消失是 and-cancel 预期行为，内容已进剪贴板，直接 Cmd+V）。git 仓库已建（github.com:thanheart12138/all-agents-in-one），v0.2.2 已提交推送。
