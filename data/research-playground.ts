import { getPlaygroundTool, toolHref } from './playground';

/** Research-to-tool relationships. Availability always comes from the tool registry. */
export const researchPlayground: Record<string, {
  researchHref: string;
  researchTitle: string;
  context: string;
  invitation: string;
  description: string;
}> = {
  crasdi: {
    researchHref: '/#research-crasdi',
    researchTitle: 'Crack-map comparison and evaluation',
    context: 'CRASDI supports the pavement-cracking digital-twin pipeline by comparing crack maps as graphs and separating differences in geometry, length, width, and orientation.',
    invitation: 'What changes when part of a crack is missed?',
    description: 'Compare preloaded crack maps, change the settings, and see which differences the score captures.',
  },
  'lane-marking': {
    researchHref: '/#research-lane-marking',
    researchTitle: 'Lane marking for wheelpath-based distress measurement',
    context: 'The OrthoLaneMark benchmark studies lane-marking presence and wheelpath-region accuracy as supporting methods for pavement distress measurement.',
    invitation: 'From lane markings to the right measurement region',
    description: 'A future module will connect the lane-marking research to examples of wheelpath-based pavement measurement.',
  },
  'alligator-cracking': {
    researchHref: '/#research-crack-density',
    researchTitle: 'Link-level crack density and alligator-crack assessment',
    context: 'The link-level crack-density indicator uses buffers around CVM graph links to support alligator-crack classification and a consistent severity measure for treatment selection.',
    invitation: 'How can crack structure help assess severity?',
    description: 'A future module will illustrate the connection between crack density, alligator-crack classification, and treatment selection.',
  },
};

export function getResearchToolLink(toolId: string) {
  const tool = getPlaygroundTool(toolId);
  const research = researchPlayground[toolId];
  if (!tool || !research) return undefined;
  const example = tool.modes.example === 'available';
  const interactive = tool.modes.interactive.status === 'available';
  return {
    tool, research, available: example || interactive, example,
    href: toolHref(toolId) + (example ? '#example' : interactive ? '#interactive' : ''),
    label: example ? `Try ${tool.title} examples` : interactive ? `Try ${tool.title}` : 'View planned module',
    status: example ? 'Examples available' : interactive ? 'Interactive tool available' : 'Playground · Coming soon',
    note: example ? 'Preloaded examples · No sign-in or upload' : interactive ? 'Open the tool to see its input and access requirements.' : 'The research is available; the demo is not live yet.',
  };
}
