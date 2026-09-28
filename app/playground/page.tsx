"use client";
import {useState,useEffect} from 'react';
import {ArrowUpRight,Download,FlaskConical,ExternalLink} from 'lucide-react';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Slider} from '@/components/ui/slider';
import examples from '@/data/examples.json';
import configurations from '@/data/example-configurations.json';
import {SiteHeader,SiteFooter} from '@/components/site-shell';
import {Comparison} from '@/components/crasdi-comparison';
import type {Scores,Mode} from '@/lib/crasdi-summary';

const cases=examples.cases;
const results=configurations.results as Record<string,Record<string,{evidence:Scores;totals:Record<Mode,number>}>>;
const repo='https://github.com/THiNK327/CRASDI';
function download(value:unknown,name:string){const u=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}

export default function Playground(){
 const [caseId,setCaseId]=useState('missing');
 const [mode,setMode]=useState<Mode>('default');
 const [pixel,setPixel]=useState('4');
 const [radius,setRadius]=useState('5');
 const [opacity,setOpacity]=useState(100);
 const selected=cases.find(c=>c.id===caseId)!;
 const configuration=results[caseId][`${pixel}-${radius}`];
 const score={...configuration.evidence,CRASDI:configuration.totals[mode],CRASDI_mode:mode};
 useEffect(()=>{
  const ctx=(document as Document & {modelContext?:{registerTool:(t:unknown,o:unknown)=>Promise<void>}}).modelContext;if(!ctx?.registerTool)return;
  const abort=new AbortController();
  try{Promise.resolve(ctx.registerTool({name:'select_crasdi_example',description:'Select a synthetic CRASDI example and scoring mode at the default resolution and matching radius. Returns genuine precomputed scores.',inputSchema:{type:'object',properties:{example:{type:'string',enum:cases.map(c=>c.id)},mode:{type:'string',enum:['default','geom','att']}},required:['example','mode'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input:{example:string;mode:Mode})=>{const c=cases.find(c=>c.id===input.example);if(!c||!['default','geom','att'].includes(input.mode))throw Error('Invalid example or mode');setCaseId(c.id);setMode(input.mode);setPixel('4');setRadius('5');await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return {example:c.id,mode:input.mode,pixel_size:4,epsilon:5,score:c.results[input.mode].CRASDI,source_commit:examples.source_commit};}},{signal:abort.signal})).catch(()=>{});}catch{}return ()=>abort.abort();
 },[]);
 return <><a className="skip" href="#playground">Skip to playground</a><div className="wrap"><SiteHeader playground/><main>
  <div className="playground-intro"><a className="text-link" href="/">← Back to Haolin’s profile</a></div>
  <section className="section" id="playground">
   <div className="section-heading"><div><div className="eyebrow">Research playground</div><h1>Compare pavement crack maps.</h1><p>Choose an example, adjust the settings, and see what changes.</p></div></div>
   <div className="lab">
    <div className="lab-header"><div className="lab-title"><FlaskConical size={20}/>CRASDI <span>Crack Structural Difference Index</span></div><span className="tag">Explore examples</span></div>
    <div className="lab-body">
     <aside className="controls">
      <span className="control-label">Choose an example</span>
      <div className="case-list">{cases.map((c,i)=><button key={c.id} onClick={()=>setCaseId(c.id)} aria-pressed={c.id===caseId} className={`case-button example-choice ${c.id===caseId?'active':''}`}><img src={`/crasdi/${c.id}-testing.png`} alt="" width={48} height={48}/><span><span className="case-no">0{i+1}</span>{c.label}</span></button>)}</div>
      <div className="field"><label id="mode-label">Compare using</label><Select value={mode} onValueChange={v=>setMode(v as Mode)}><SelectTrigger aria-labelledby="mode-label"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="default">All four attributes</SelectItem><SelectItem value="geom">Geometry only</SelectItem><SelectItem value="att">Attributes only</SelectItem></SelectContent></Select></div>
      <div className="field"><label id="radius-label">Matching radius (pixels)</label><Select value={radius} onValueChange={setRadius}><SelectTrigger aria-labelledby="radius-label"><SelectValue/></SelectTrigger><SelectContent>{configurations.matching_radii.map(v=><SelectItem key={v} value={String(v)}>{v} px</SelectItem>)}</SelectContent></Select><p className="control-note">A smaller radius requires closer alignment between cracks.</p></div>
      <div className="field"><label id="resolution-label">Resolution (mm / pixel)</label><Select value={pixel} onValueChange={setPixel}><SelectTrigger aria-labelledby="resolution-label"><SelectValue/></SelectTrigger><SelectContent>{configurations.pixel_sizes.map(v=><SelectItem key={v} value={String(v)}>{v} mm / pixel</SelectItem>)}</SelectContent></Select><p className="control-note">Changes the physical scale of coordinates. Stored crack widths stay fixed in millimeters.</p></div>
      <div className="field"><label id="opacity-label">Testing-map opacity <span style={{float:'right',color:'#6e6151'}}>{opacity}%</span></label><Slider aria-labelledby="opacity-label" min={0} max={100} step={5} value={[opacity]} onValueChange={v=>setOpacity(v[0])}/><p className="control-note">Changes the overlay only, not the score.</p></div>
      <button className="text-link" style={{background:'none',borderTop:0,borderLeft:0,borderRight:0,fontSize:13}} onClick={()=>{setMode('default');setPixel('4');setRadius('5');setOpacity(100)}}>Reset settings</button>
     </aside>
     <div className="workspace">
      <p className="example-description"><strong>{selected.label}.</strong> {selected.description}</p>
      <Comparison gt={selected.gt} test={selected.test} score={score} mode={mode} opacity={opacity} gtPreview={caseId==='growth'&&pixel==='4'?'/crasdi/growth-reference.png':undefined} testPreview={caseId==='growth'&&pixel==='4'?'/crasdi/growth-testing.png':undefined} previewIsIllustration={caseId==='growth'&&pixel==='4'}/>
     </div>
    </div>
    <div className="lab-footer"><span>Example results precomputed with the original CRASDI code</span><div style={{display:'flex',gap:18,flexWrap:'wrap'}}><a href={`${repo}/tree/${examples.source_commit}`} target="_blank" rel="noreferrer">View source <ExternalLink size={12} style={{display:'inline'}}/></a><button onClick={()=>download({source_commit:examples.source_commit,example:caseId,parameters:{mode,pixel_size:Number(pixel),epsilon:Number(radius),alpha:1,overlap_threshold:.5},scores:score,gt:selected.gt,test:selected.test},`crasdi-${caseId}-${mode}-${pixel}mm-${radius}px.json`)}><Download size={14}/>Export result</button></div></div>
   </div>
   <details className="details"><summary>How to interpret the score</summary><p><strong>Lower means more similar.</strong> CRASDI matches crack segments, then compares their geometry, length, width, and orientation. The default mode gives each attribute equal weight. Geometry-only mode uses the geometry component; attributes-only mode averages length, width, and orientation. Unmatched crack length adds a penalty. The displayed component values include that penalty.</p><p>Each example and settings combination has been computed in advance using the original code. Changing a setting loads its saved result and updates the map and summary. Some settings can produce the same score, especially for identical maps or scale-invariant comparisons.</p><p>These are synthetic teaching examples, not benchmark results or pavement condition ratings. <a className="text-link" href={repo}>Read the method and documentation <ArrowUpRight size={14}/></a></p></details>
  </section>
 </main><SiteFooter/></div></>
}
