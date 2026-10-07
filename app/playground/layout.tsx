import type { Metadata } from 'next';
import '@/components/playground/playground.css';
export const metadata: Metadata = {
  title: 'Research Playground — Haolin Wang',
  description: 'Explore research ideas with curated examples and discover interactive tools as they become available.',
};
export default function PlaygroundLayout({ children }: { children: React.ReactNode }) { return children; }
