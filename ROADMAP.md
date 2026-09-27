# Roadmap

## 当前阶段

当前代码版本 v0.2.8（2026-09-27 本地打包）：针对中文长行右侧裁切，在 xterm 容器禁用 Chromium 的全角标点压缩。arm64 DMG 已输出到 `release/0.2.8/` 并校验；`/Applications` 中为 v0.2.7，尚未替换。当前安装包未签名、未公证。

2026-09-27：源码修复 tmux 回看模式单击空白处无法退出的问题，已在当前运行中的 tmux 服务临时加载；修复已打入 v0.2.7 及后续本地安装包。

2026-09-27：源码修复点击「重启」后键盘焦点留在按钮的问题；已打入 v0.2.7 本地 DMG，当前安装版为 v0.2.7。

## 已完成

- 实现终端多文件拖入：项目内文件引用原路径，外部文件复制到 `.aao/attachments/` 的独立批次目录并加入 Git 忽略；路径经转义后通过 xterm 粘贴，不自动提交。显示导入结果与错误，拒绝文件夹和含控制字符的路径，保留原文件及附件副本。
- 实现 Finder 文件 ⌘C／终端 ⌘V 导入，复用拖入附件的处理与提示；通过 preload 识别磁盘 File，普通文本及无磁盘路径的截图保留原有粘贴流程。
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
- 修复侧栏项目列表过长时无法滚动：限制侧栏及列表的最小高度，使列表在可用高度内独立滚动，底部终端计数保持可见；滚动条改为适配深色侧栏的细灰蓝滑块，鼠标移入时显示。
- 修复全屏时终端内容从右侧和底部溢出：将终端间距放到 xterm 自身，使 FitAddon 计算行列数时扣除间距；终端外框与滚动区域同步 iTerm 主题底色，避免露出黑边。
- 修复长行右侧内容显示不全：终端右侧增加留白并让 FitAddon 按可见宽度提前换行；拖选松开后保留选区，按 ⌘C 再复制到系统剪贴板。
- v0.2.6 撤销拼音组合文字与输入法定位点的固定左上角坐标，恢复 xterm 按当前光标定位，保留主题背景和下划线。
- 回看模式中单击松开退出并恢复输入，拖动选区和 ⌘C 复制继续可用；绑定写入应用生成的 tmux 配置。
- 内嵌终端支持 ⌘+／⌘− 调整字号、⌘0 恢复主题默认字号；字号变化后立即重新计算行列并同步 tmux，限制字号范围为 8–40 点。
- 隐藏会盖住行尾文字的 xterm 滑动块，保留 tmux 的滚轮回看；在终端区域用触控板双指捏合调整字号，普通滚动仍按原有终端行为处理。
- 侧栏将项目分为「当前项目」和「历史项目」，支持拖动项目排序及跨组移动，并提供右键菜单移动入口；分组与顺序保存在工作区 JSON。旧项目首次载入归入历史项目，新添加项目归入当前项目。
- 后台终端从 Running 转为 Ready 后，若用户尚未查看，在侧栏显示低干扰的「待查看」标记；打开会话后清除，未查看状态随工作区保存。
- 使用 Node 内置测试运行器覆盖终端输入过滤、Kimi/Codex 状态解析、项目分组移动和 Ready 待查看判断；通过 `npm test` 运行，不增加依赖。
- 项目树在 Git 仓库目录旁显示分支徽标（直读 `.git/HEAD`，支持 worktree 与 detached HEAD，启动时解析、每 30 秒轮询、窗口聚焦时刷新）。
- 顶部 CLI 状态栏：`[项目名](分支) | CLI | Total | Cost | 5h | 7d | Model | ctx | tmux 会话 | 最近输入 | Ready/Running 状态`。其中 Model/ctx/Total/Cost 由 tmux capture-pane 只读抓取终端屏幕解析（支持 Kimi Code 新旧状态行与 Codex 状态行，识别不出自动隐藏，不耦合 CLI 内部协议）；5h/7d 额度由主进程直读（借鉴 token-tracker）：Kimi 走云端 `GET <base_url>/usages`（OAuth 凭证 `~/.kimi/credentials/kimi-code.json`，120 秒缓存、15 分钟失效），Codex 扫 `~/.codex/sessions/` 最近 5 个 jsonl 的 `token_count` 事件限额快照（纯本地、30 秒刷新），均为「已用百分比」，失败自动隐藏分段。

## 进行中

- 中文长行右侧裁切修复已通过 typecheck、构建和打包，待在实际窗口验证；重启后的终端焦点修复也待实际窗口验证。

## 待办

- 持续收集文件导入和终端交互反馈，并实测 v0.2.6 的 macOS 原生拼音候选窗。
- 后续版本安装包需包含单击退出回看修复；尚未实现键盘输入时自动退出回看。
- 隔离开发版与正式版的 tmux 服务及工作区数据，避免开发版热加载配置影响正式版。
- 根据实际使用反馈继续打磨视觉与交互。
- 配置 Apple Developer ID 签名和 notarization。

## 阻塞

- 无。

## 最近验证

- 2026-09-27：上游 xterm.js 6 问题 #6058 记录 DOM 渲染器因 Chromium 的 `text-spacing-trim` 导致中文标点行宽测量漂移，右侧字符被裁切；本项目使用 xterm.js 6 的 DOM 渲染器，当前会话只有一个 tmux 客户端，因而先按上游已验证的 `.xterm { text-spacing-trim: space-all; }` 修复。v0.2.8 本地 arm64 DMG 已生成，`npm run typecheck`、`npm test`（22 项）、`npm run dist`、`hdiutil verify`、包内版本及 asar CSS 内容核对通过；SHA-256 为 `9c9437a0d29489b4f535d76ddb9f4cafe2da2c973a3039b30b30ef17ebb622b8`。实际窗口长行显示尚待复测。
- 2026-09-27：v0.2.7 本地 arm64 DMG 生成于 `release/0.2.7/`。`npm run typecheck`、`npm test`（22 项）、`npm run dist`、`hdiutil verify`、包内版本号 0.2.7 和 `git diff --check` 均通过；SHA-256 为 `cd9169c3ff8c8b0a5a050ee0157f2a3b4f55b541b64346d50c2921dedf3c8ce4`。现已安装，重启后输入仍待正式窗口验证。
- 2026-09-27：用户截图显示重启按钮仍有键盘焦点框，Shell 提示符已经出现；当前安装版 v0.2.5。源码在重启 IPC 返回后主动聚焦仍处于活动状态的 xterm。`npm run typecheck`、`npm run build`、`npm test`（22 项）通过；尚未在实际窗口复测，因此未列入已完成。
- 2026-09-27：隔离 tmux 3.7b + node-pty 验证 `MouseUp1Pane` 绑定：普通单击退出回看，拖动保留选区，已选中后再单击可退出；隔离测试进程清理阶段出现 node-pty 退出异常，交互断言已通过。`npm test` 22 项、typecheck、build、diff 检查通过。运行中的正式版 tmux 服务已临时加载两条绑定，并核对 copy-mode 与 copy-mode-vi 均生效；未在用户当前会话发送按键或重新打包。
- 2026-09-27：先用隔离 Electron 复现组合框位于屏幕上方，再移除 composition-view 和 textarea 的强制 left/top 样式。两档窗口（900×580、1360×860）、四档字号（8／14／24／40）和三个光标位置共 24 组检查通过：合成拼音 `nihao` 可见，组合框与输入法 textarea 坐标均跟随实际光标。typecheck、build、DMG 打包及 hdiutil verify 通过，asar 版本为 0.2.6 且已无错误定位样式。未连接正式版 tmux；原生输入法候选窗仍待用户实测。
- 2026-09-26：v0.2.5 本地 arm64 DMG 打包完成，输出 `release/0.2.5/All Agents in One-0.2.5-arm64.dmg`（约 119 MiB）。22 项测试、typecheck、build 通过；沙箱内首次创建磁盘映像失败，获得环境权限后以已生成的 `.app` 完成 DMG 打包。`hdiutil verify` 通过；包内版本为 0.2.5、可执行文件为 arm64，asar 内主进程／preload／HTML 与本次构建一致，包含文件粘贴桥接。用户已确认文件复制粘贴试用通过。未安装、未签名公证、未公开发布。
- 2026-09-26：文件粘贴功能的 22 项现有测试、typecheck、build、diff 检查通过；隔离 Electron 自动验证磁盘 File 的粘贴导入、普通文本粘贴、截图分流与原有拖入回归。另在 Finder 真实选择两个临时文件并 ⌘C，在使用独立用户数据与 tmux 服务的测试版中 ⌘V，界面确认「已复制 2 个文件到项目，路径已插入，尚未发送」。
- 2026-09-26：文件拖入的 `npm test` 共 22 项通过，新增覆盖内部引用、外部复制、多文件同名与重复批次、原文件保持、Git 忽略、符号链接、非法输入和 shell 路径转义；`npm run typecheck`、`npm run build`、`git diff --check` 通过。独立 Electron 测试窗口使用临时用户数据、实际 sandbox preload、磁盘 File 对象、IPC 复制处理与真实 TerminalView/xterm，验证混合拖入、中文／空格／单引号路径、无回车提交、文件夹错误和提示关闭。输入接收端为模拟终端；未连接正式版 tmux，Finder 物理拖放尚未实测。
- 2026-09-26：用户确认遮挡位置是右侧滑动块覆盖行尾。隔离 Electron 窗口加载实际 `TerminalView`，合成普通滚轮和捏合滚轮事件：普通滚轮不触发缩放，捏合向外／向内分别触发字号增／减，事件阻止浏览器缩放；xterm 滑动块样式为 `display: none`。三档窗口、四档字号的 xterm 边界复查通过；`npm test`、`npm run typecheck`、`npm run build`、`git diff --check` 通过。物理触控板仍待用户试用。
- 2026-09-26：终端字号缩放在隔离 Electron 窗口中以 900×580、1360×860、2000×1100 三档窗口和 8／14／24／40 点字号检查 xterm 屏幕边界；最小窗口 40 点截图确认行尾中文完整显示。`npm test`、`npm run typecheck`、`npm run build`、`git diff --check` 通过；尚未在用户当前 tmux 会话中操作快捷键。
- 2026-09-26：针对长行、拖选复制和拼音遮挡修复，隔离 Electron 窗口实测 xterm 屏幕右边界在容器内，拼音组合文字与输入法定位点位于屏幕上方；隔离 tmux 会话实测选区状态为 1、`copy-pipe-and-cancel pbcopy` 复制出预期内容、松开鼠标自动复制绑定已移除。`npm test` 16 项通过，`npm run typecheck`、`npm run build`、`git diff --check` 通过。尚未在用户当前会话中做真实鼠标和拼音输入操作。
- 2026-09-25：版本升至 0.2.4，运行 `npm test`（16 项通过）、`npm run typecheck`、`npm run dist`；生成 `release/0.2.4/All Agents in One-0.2.4-arm64.dmg`，`hdiutil verify` 通过，包内版本为 0.2.4、架构为 arm64。打包未签名、未公证。
- 2026-09-25：实现 Codex／Kimi 图片粘贴快捷键适配：活动终端中按 ⌘V 且剪贴板含图片时，应用向 CLI 发送其支持的 Ctrl+V，并让 CLI 自行缓存附件、显示图片占位符；纯文本粘贴保持 xterm 原行为。新增终端白名单与剪贴板 MIME 单测。16 项测试、`npm run typecheck`、`npm run build`、`git diff --check` 通过；开发版窗口已启动供用户试用，但应用内图片粘贴尚未端到端验证。
- 2026-09-24：README 增加中文内容并保留英文版，涵盖功能、环境要求、开发、隐私和发布产物；人工核对双语章节对应，`git diff --check` 通过。
- 2026-09-24：开源准备修订完成：README 补充功能、安装前置条件、数据处理说明与 DMG 路径；新增贡献指南、Apache NOTICE 和 GitHub Actions CI；锁定 package.json 依赖版本；Electron 启用 sandbox、限制导航与新窗口并校验 IPC 主框架；Kimi 用量接口只接受 HTTPS；替换截图里的真实外部仓库地址与提示文本。`npm test` 14 项通过，`npm run typecheck`、`npm run build`、离线 package-lock 同步通过。未打包、未提交或推送。
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
- 2026-09-24：侧栏滚动修复后 `npm run typecheck` 与 `npm run build` 通过；隔离 Electron 窗口加载实际 CSS，30 个项目时列表 `clientHeight=410`、`scrollHeight=810`、设置滚动后 `scrollTop=400.5`，底部栏仍在视口内。复制断行报告中，用户贴出的命令保留了两处原有的 `\` 续行，而屏幕上的 `docker exec` 自动折行已在复制结果中合并；未改复制逻辑。
- 2026-09-24：按侧栏整体样式调整项目列表滚动条后，隔离 Electron 窗口渲染 18 个项目并检查默认与悬停画面；列表 `clientHeight=376`、`scrollHeight=1845`、滚到底 `scrollTop=1469`，底部栏仍在视口内。`npm run typecheck`、`npm run build` 通过。
- 2026-09-24：全屏终端溢出定位：修复前实际开发窗口中 `.xterm-screen` 比 `.xterm` 宽 12px、高 24px，原因是 FitAddon 未扣除外层 `.terminal-view` 的 padding。将 padding 移到 `.xterm` 后，以真实 xterm + FitAddon 在隔离 Electron 窗口按普通及接近全屏尺寸验证，屏幕层右边和底边均在容器内；`npm run typecheck`、`npm run build` 通过。
- 2026-09-24：用户截图指出上一轮间距调整露出黑边；将 `.terminal-view`、`.xterm` 和 `.xterm-viewport` 的背景同步到已有的 `--terminal-bg` 主题变量，并调整右侧滚动区域和侧栏滑块颜色。重启开发版后读取实际 DOM：容器及滚动层背景均为 iTerm 暗色主题 `#1e1e2e`，屏幕层仍位于容器内；窗口截图确认黑边和亮色右侧条消失。`npm run typecheck`、`npm run build`、`git diff --check` 通过。
- 2026-09-24：将上述修复打为本地 arm64 DMG，输出到 `release/2026-09-24-dmg/` 以保留旧版同名包；`hdiutil verify` 通过，包内版本 0.2.2、主程序为 arm64，`app.asar` 包含本次构建的 CSS。按现有配置未签名，也未公开发布。
- 2026-09-24：当前／历史项目拖放分组与终端 Ready 待查看标记完成；`npm run typecheck`、`npm run build`、`git diff --check` 通过。拖放与标记的实际窗口交互尚待手动验证。
- 2026-09-24：版本升至 0.2.3，`package.json` 与 `package-lock.json` 顶层版本一致；`npm run typecheck`、`npm run dist` 通过，生成本地 arm64 DMG 和 ZIP。`hdiutil verify`、`unzip -tq` 均通过，打包应用的 `CFBundleShortVersionString` 为 0.2.3；按现有配置未签名，也未公开发布。
- 2026-09-24：按要求将打包目标改为仅 DMG，输出目录改为 `release/${version}/`；重新运行 `npm run dist`，产物为 `release/0.2.3/All Agents in One-0.2.3-arm64.dmg`，该版本目录无 ZIP。`npm run typecheck`、`hdiutil verify`、`git diff --check` 通过，包内版本为 0.2.3。
- 2026-09-24：新增 `npm test`，12 项测试全部通过，覆盖输入过滤、CLI 状态解析、项目分组移动与 Ready 待查看逻辑；`npm run typecheck`、`npm run build`、`git diff --check` 通过。
