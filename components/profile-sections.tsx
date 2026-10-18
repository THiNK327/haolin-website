"use client";
import {Children,useEffect,useState,type ReactNode} from 'react';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';

const sections=[
 ['skills','Skills'],['research','Research'],['publications','Publications'],['resources','Resources'],
 ['background','Background'],['teaching','Teaching'],['service','Service'],['contact','Contact'],
] as const;

export function ProfileSections({children}:{children:ReactNode}){
 const [active,setActive]=useState('skills');
 const panels=Children.toArray(children);
 useEffect(()=>{
  const followHash=()=>{const hash=window.location.hash.slice(1);const id=hash==='work'?'research':hash;if(sections.some(([key])=>key===id))setActive(id)};
  followHash();window.addEventListener('hashchange',followHash);
  return ()=>window.removeEventListener('hashchange',followHash);
 },[]);
 return <Tabs className="profile-sections" value={active} onValueChange={value=>{setActive(value);window.history.replaceState(null,'',`#${value}`)}}>
  <TabsList className="profile-section-tabs" aria-label="About Haolin" variant="line">
   {sections.map(([id,label])=><TabsTrigger key={id} value={id}>{label}</TabsTrigger>)}
  </TabsList>
  {sections.map(([id],i)=><TabsContent key={id} value={id} forceMount className="profile-section-panel">{panels[i]}</TabsContent>)}
 </Tabs>;
}
