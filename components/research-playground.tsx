import { ArrowRight, FlaskConical } from 'lucide-react';
import { getResearchToolLink } from '@/data/research-playground';

export function PlaygroundAction({ toolId, secondary = false }: { toolId: string; secondary?: boolean }) {
  const link = getResearchToolLink(toolId);
  if (!link) return null;
  return <a className={`button ${secondary || !link.available ? 'secondary' : ''}`} href={link.href}>{link.label}<ArrowRight size={16} aria-hidden="true"/></a>;
}

/** Shared invitation used beside the research, in the profile preview, and in resources. */
export function ResearchPlaygroundLink({ toolId, preview = false }: { toolId: string; preview?: boolean }) {
  const link = getResearchToolLink(toolId);
  if (!link) return null;
  return <aside className={`research-tool-cta ${link.available ? 'is-available' : 'is-planned'} ${preview ? 'with-preview' : ''}`} aria-label={`${link.tool.title} playground invitation`}>
    <div className="research-tool-kicker"><span><FlaskConical size={14} aria-hidden="true"/>Research → Playground</span><span className="research-tool-status">{link.status}</span></div>
    <p className="research-tool-title">{link.research.invitation}</p>
    <p className="research-tool-description">{link.research.description}</p>
    {preview && toolId === 'crasdi' && link.example && <a className="research-tool-preview" href={link.href} aria-label="Open the CRASDI example explorer">
      <figure><img src="/crasdi/missing-reference.png" width={160} height={160} alt="Reference crack map from the CRASDI teaching examples"/><figcaption>Reference map</figcaption></figure>
      <figure><img src="/crasdi/missing-testing.png" width={160} height={160} alt="Comparison crack map with a missing section"/><figcaption>A section is missing</figcaption></figure>
    </a>}
    <PlaygroundAction toolId={toolId}/><small className="research-tool-note">{link.note}</small>
  </aside>;
}

/** Reciprocal link outside the input/verification flow: research context stays public. */
export function ToolResearchContext({ toolId }: { toolId: string }) {
  const link = getResearchToolLink(toolId);
  if (!link) return null;
  return <aside className="tool-research-context" aria-label="Research behind this tool">
    <div><div className="eyebrow">The research behind this tool</div><p><strong>{link.research.researchTitle}.</strong> {link.research.context}</p></div>
    <a className="text-link" href={link.research.researchHref}>Research behind {link.tool.title}<ArrowRight size={15} aria-hidden="true"/></a>
  </aside>;
}
