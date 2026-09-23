/// <reference types="vite/client" />

import type { TerminalApi } from '../../shared/types'

declare global {
  interface Window {
    terminalApi: TerminalApi
  }
}

export {}
