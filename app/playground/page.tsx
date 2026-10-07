import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { playgroundTools, toolHref } from '@/data/playground';

export default function Playground() {
  return <><a className="skip" href="#playground">Skip to playground</a><div className="wrap playground-page"><SiteHeader playground/><main id="playground">
    <div className="tool-breadcrumb"><a className="text-link" href="/">← Back to Haolin’s profile</a></div>
    <header className="tool-heading"><div className="eyebrow">Research playground</div><h1>Explore the ideas. Try the tools.</h1><p>Start with a curated example, or bring your own data when a tool supports it. Each tool grows independently.</p></header>
    <div className="tool-catalog">{playgroundTools.map(tool => {
      const ready = tool.modes.example === 'available' || tool.modes.interactive.status === 'available';
      return <article className="tool-card" key={tool.id}>
        <div className="eyebrow">{tool.category}</div><h2><a href={toolHref(tool.id)}>{tool.title}</a></h2><p>{tool.description}</p>
        <div className="tool-badges">
          {tool.modes.example !== 'hidden' && <span className={`tool-badge ${tool.modes.example === 'available' ? 'available' : ''}`}>{tool.modes.example === 'available' ? 'Examples available' : 'Examples · Planned'}</span>}
          {tool.modes.interactive.status !== 'hidden' && <span className={`tool-badge ${tool.modes.interactive.status === 'available' ? 'available' : ''}`}>{tool.modes.interactive.status === 'available' ? 'Try your own data' : 'Your own data · Planned'}</span>}
        </div><a className="text-link tool-card-link" href={toolHref(tool.id)}>{ready ? `Explore ${tool.title}` : 'View planned tool'} <span aria-hidden="true">↗</span></a>
      </article>;
    })}</div>
    <p className="tool-catalog-note">Examples need no account or uploads. Planned features are clearly marked and are not running yet.</p>
  </main><SiteFooter/></div></>;
}
