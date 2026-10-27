import { Component, type ReactNode } from 'react'
import { Button } from './ui/button'

/** Keep editing and fabrication usable if the optional 3D bundle fails to load. */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed)
      return (
        <div className="scene-loading" role="alert">
          <div className="scene-load-error">
            <strong>The preview could not load</strong>
            <p>Your design and cut plans are still available.</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reload preview
            </Button>
          </div>
        </div>
      )
    return this.props.children
  }
}
