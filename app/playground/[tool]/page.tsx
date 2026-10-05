import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { playgroundTools, getPlaygroundTool } from '@/data/playground';
import { ToolPage } from '@/components/playground/tool-page';

export const dynamicParams = false;
export function generateStaticParams() {
  return playgroundTools.map(tool => ({ tool: tool.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const tool = getPlaygroundTool((await params).tool);
  return tool ? { title: `${tool.title} Playground — Haolin Wang`, description: tool.description } : {};
}
export default async function PlaygroundToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const tool = getPlaygroundTool((await params).tool);
  if (!tool) notFound();
  return <ToolPage key={tool.id} toolId={tool.id}/>;
}
