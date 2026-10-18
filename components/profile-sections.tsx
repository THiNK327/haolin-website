'use client';
import { Children, useEffect, useState, type ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const sections = [
  ['skills', 'Skills'], ['research', 'Research'], ['publications', 'Publications'], ['resources', 'Resources'],
  ['background', 'Background'], ['teaching', 'Teaching'], ['service', 'Service'], ['contact', 'Contact'],
] as const;

export function ProfileSections({ children }: { children: ReactNode }) {
  const [active, setActive] = useState('skills');
  const [target, setTarget] = useState('');
  const panels = Children.toArray(children);
  useEffect(() => {
    const followHash = () => {
      const hash = window.location.hash.slice(1);
      const normalized = hash === 'work' ? 'research' : hash;
      const section = sections.find(([key]) => normalized === key || normalized.startsWith(`${key}-`));
      if (section) { setActive(section[0]); setTarget(normalized); }
    };
    followHash();
    window.addEventListener('hashchange', followHash);
    return () => window.removeEventListener('hashchange', followHash);
  }, []);
  useEffect(() => {
    // Activate the tab first; a browser cannot scroll to a heading in a hidden panel.
    if (!target || target === active) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'start', behavior: 'instant' }));
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [active, target]);
  return <Tabs className="profile-sections" value={active} onValueChange={value => { setActive(value); setTarget(''); window.history.replaceState(null, '', `#${value}`); }}>
    <TabsList className="profile-section-tabs" aria-label="About Haolin" variant="line">
      {sections.map(([id, label]) => <TabsTrigger key={id} value={id}>{label}</TabsTrigger>)}
    </TabsList>
    {sections.map(([id], index) => <TabsContent key={id} value={id} forceMount className="profile-section-panel">{panels[index]}</TabsContent>)}
  </Tabs>;
}
