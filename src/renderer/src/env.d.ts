import type { ToDoDeskApi } from '../../shared/api'

declare global {
  interface Window {
    tododesk: ToDoDeskApi
  }
}

export {}