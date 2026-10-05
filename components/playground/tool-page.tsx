'use client';
import { Suspense, useCallback, useEffect, useId, useState, type KeyboardEvent } from 'react';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { getPlaygroundTool, visibleModes } from '@/data/playground';
import { createPlaygroundClient } from '@/lib/playground/client';
import { playgroundConfig } from '@/lib/playground/config';
import type { AccessDecision, ToolMode } from '@/lib/playground/types';
import { EntryGate } from './entry-gate';
import { exampleModules, interactiveModules, verificationProviders } from './modules';

const client = createPlaygroundClient(playgroundConfig);
const labels: Record<ToolMode, string> = { example: 'Explore Example', interactive: 'Try Your Own Data' };

export function ToolPage({ toolId }: { toolId: string }) {
  const tool = getPlaygroundTool(toolId)!;
  const modes = visibleModes(tool);
  const [mode, setMode] = useState<ToolMode>(modes[0] || 'example');
  const [visited, setVisited] = useState<Partial<Record<ToolMode, boolean>>>({ [modes[0] || 'example']: true });
  const id = useId();
  const select = useCallback((next: ToolMode) => {
    setMode(next);
    setVisited(previous => ({ ...previous, [next]: true }));
  }, []);
  useEffect(() => {
    const readHash = () => {
      const next = window.location.hash.slice(1);
      if ((next === 'example' || next === 'interactive') && visibleModes(tool).includes(next)) select(next);
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, [tool, select]);
  const choose = (next: ToolMode) => {
    select(next);
    window.history.replaceState(null, '', `#${next}`);
  };
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, current: ToolMode) => {
    let index = modes.indexOf(current);
    if (event.key === 'ArrowRight') index = (index + 1) % modes.length;
    else if (event.key === 'ArrowLeft') index = (index - 1 + modes.length) % modes.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = modes.length - 1;
    else return;
    event.preventDefault();
    choose(modes[index]);
    document.getElementById(`${id}-${modes[index]}-tab`)?.focus();
  };
  const checkAccess = useCallback((signal: AbortSignal): Promise<AccessDecision> => {
    // Browser-only tools can be public. Server tools always ask the backend, even
    // when its launch policy is open: frontend flags never authorize server work.
    return tool.modes.interactive.runtime === 'browser'
      ? Promise.resolve({ status: 'allowed' })
      : client.checkAccess(tool.id, signal);
  }, [tool]);
  const run = useCallback((input: FormData, signal?: AbortSignal) => client.run(tool.id, input, signal), [tool]);
  const Example = exampleModules[tool.id];
  const Workspace = interactiveModules[tool.id];
  return <><a className="skip" href="#tool">Skip to tool</a><div className="wrap playground-page"><SiteHeader playground/><main id="tool">
    <div className="tool-breadcrumb"><a className="text-link" href="/playground">← All playground tools</a></div>
    <header className="tool-heading"><div className="eyebrow">{tool.category}</div><h1>{tool.title}</h1><p>{tool.description}</p>{tool.sourceUrl && <a className="text-link" href={tool.sourceUrl} target="_blank" rel="noreferrer">Code & documentation ↗</a>}</header>
    {modes.length > 0 ? <>
      <div className="tool-modes" role="tablist" aria-label={`${tool.title} modes`}>{modes.map(item => {
        const status = item === 'example' ? tool.modes.example : tool.modes.interactive.status;
        return <button type="button" key={item} id={`${id}-${item}-tab`} role="tab" aria-selected={mode === item} aria-controls={`${id}-${item}-panel`} tabIndex={mode === item ? 0 : -1} onClick={() => choose(item)} onKeyDown={event => keyboard(event, item)}><span>{labels[item]}</span>{status === 'planned' && <small>Planned</small>}</button>;
      })}</div>
      {modes.map(item => <section key={item} id={`${id}-${item}-panel`} className="tool-panel" role="tabpanel" aria-labelledby={`${id}-${item}-tab`} tabIndex={0} hidden={mode !== item}>
        {item === 'example' ? (tool.modes.example === 'available' && Example
          ? visited.example && <Suspense fallback={<p role="status">Loading examples…</p>}><Example/></Suspense>
          : <div className="tool-notice"><h2>Examples are being prepared</h2><p>This tool is planned. Curated examples will be added here when they are ready.</p></div>)
          : tool.modes.interactive.status === 'available' && Workspace
            ? visited.interactive && <EntryGate key={tool.id} toolId={tool.id} checkAccess={checkAccess} verificationProviders={verificationProviders}><Suspense fallback={<p role="status">Opening workspace…</p>}><Workspace toolId={tool.id} run={run}/></Suspense></EntryGate>
            : <div className="tool-notice"><h2>Custom analysis is not available yet</h2><p>{tool.modes.example === 'available' ? 'Explore the examples now, without preparing or uploading any data. They will remain available when custom analysis is added.' : 'This interactive tool will be added when it is ready. There is nothing to upload or verify at this stage.'}</p>{tool.modes.example === 'available' && <button type="button" className="button secondary" onClick={() => choose('example')}>Explore examples instead</button>}</div>}
      </section>)}
    </> : <div className="tool-notice"><h2>This tool is being prepared</h2><p>Examples and interactive options will appear here when they are ready.</p></div>}
  </main><SiteFooter/></div></>;
}
