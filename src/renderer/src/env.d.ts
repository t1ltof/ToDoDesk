import type { ToDoDeskApi } from '../../preload/index'

declare global {
  interface Window {
    tododesk: ToDoDeskApi
  }
}

export {}