# Contributing

## Requirements

- Node.js 22.13 or newer and npm.
- macOS and tmux for running the desktop application. Install tmux with `brew install tmux`.
- iTerm2 is optional.

## Setup

```bash
npm ci
npm run dev
```

Before opening a pull request, run:

```bash
npm test
npm run typecheck
npm run build
```

The tests use Node's built-in test runner and do not add a test dependency. The CI workflow runs the same checks on Node.js 22.

## Packaging

`npm run dist` builds a macOS DMG under `release/<version>/`. Packaging has only been verified on macOS arm64. The current artifact is unsigned and not notarized.
