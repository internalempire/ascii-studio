"use client"

import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  onError: (message: string) => void
  /** Changing this remounts the subtree, so a new model gets a clean attempt. */
  resetKey: string
}

interface State {
  failed: boolean
}

/** A malformed .glb must not take the whole studio down with it. */
export class ModelErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error?.message || "Impossibile caricare il modello")
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
