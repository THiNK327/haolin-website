'use client';
import { Component, type ReactNode } from 'react';

/** A broken tool module must not remove its sibling mode or the site navigation. */
export class ModeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="tool-notice" role="alert"><h2>This mode could not be loaded</h2><p>You can switch modes or return to the Playground. No example result will be substituted for a custom analysis.</p><button type="button" className="button secondary" onClick={() => this.setState({ failed: false })}>Retry this mode</button></div>;
  }
}
