'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Something went wrong' }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ hasError: false, message: '' })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/15 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">Something went wrong</p>
            <p className="text-xs text-slate-400 max-w-xs">{this.state.message}</p>
          </div>
          <button
            onClick={this.reset}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/20 text-rose-400 hover:bg-rose-500/25 transition"
          >
            <RefreshCw className="w-3 h-3" /> Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
