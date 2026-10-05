import type { PlaygroundTool, ToolMode } from '../lib/playground/types';

/** Add a tool here, then register its implemented views in components/playground/modules.ts. */
export const playgroundTools: readonly PlaygroundTool[] = [
  {
    id: 'crasdi',
    title: 'CRASDI',
    description: 'Compare pavement crack maps and understand differences in geometry, length, width, and orientation.',
    category: 'Crack comparison',
    modes: { example: 'available', interactive: { status: 'planned', runtime: 'server' } },
    sourceUrl: 'https://github.com/THiNK327/CRASDI',
  },
  {
    id: 'lane-marking',
    title: 'Lane Marking Detection',
    description: 'Explore roadway lane-marking detection and how its results can support pavement surveys.',
    category: 'Roadway sensing',
    modes: { example: 'planned', interactive: { status: 'planned', runtime: 'server' } },
  },
  {
    id: 'alligator-cracking',
    title: 'Alligator Crack Detection',
    description: 'Explore the detection of interconnected pavement cracking patterns.',
    category: 'Pavement distress',
    modes: { example: 'planned', interactive: { status: 'planned', runtime: 'server' } },
  },
];

export function getPlaygroundTool(id: string) {
  return playgroundTools.find(tool => tool.id === id);
}
export function toolHref(id: string) {
  return `/playground/${encodeURIComponent(id)}`;
}
export function visibleModes(tool: PlaygroundTool): ToolMode[] {
  const modes: ToolMode[] = [];
  if (tool.modes.example !== 'hidden') modes.push('example');
  if (tool.modes.interactive.status !== 'hidden') modes.push('interactive');
  return modes;
}
