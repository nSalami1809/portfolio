'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  onError: () => void
  children: ReactNode
}

interface State {
  hasError: boolean
}

// react-pdf/docx-preview run third-party rendering code (canvas/WASM, mobile
// browser quirks, worker loading) that the `onError` callbacks passed into
// PdfPreview/DocxPreview only cover for promise rejections they explicitly
// report — a genuine synchronous render-time exception is NOT one of those
// and, with nothing catching it here, bubbles all the way up to the route's
// error.tsx, replacing the ENTIRE document page (title, description,
// download button included) with the generic "une erreur est survenue"
// screen. A React error boundary (must be a class component — no hook
// equivalent) is the only way to catch that and degrade to just the
// preview's own "aperçu indisponible" fallback instead.
export default class PreviewErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[DocumentPreview] render error, falling back:', error)
    this.props.onError()
  }

  render() {
    // Renders nothing once caught — DocumentPreview's own `failed` state
    // (set via onError, above) takes over on the very next render and
    // swaps this whole subtree for PreviewFallback.
    if (this.state.hasError) return null
    return this.props.children
  }
}
