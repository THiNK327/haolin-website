export type Feature={geometry:{coordinates:number[][]};properties?:unknown};
export type Vector={properties:{image:{height_px:number;width_px:number}};features:Feature[]};
export type Mode='default'|'geom'|'att';
export type Cluster={cluster_id:number;from_file_Testing:Feature[];from_file_GT:Feature[];scores:{EHD:number;length:number;width:number;orientation:number;length_GT:number;length_Testing:number}};
export type Scores={CRASDI:number;d_bar_ehd:number;d_bar_length:number;d_bar_width:number;d_bar_orientation:number;matched_clusters:Cluster[];unmatched_GT:Feature[];unmatched_Testing:Feature[];unmatched_length_GT_mm:number;unmatched_length_Testing_mm:number;CRASDI_mode:string};
export type Attribute='all'|'combined'|'EHD'|'length'|'width'|'orientation';
const round=(n:number)=>Math.round(n*10000)/10000;
export function clusterValue(c:Cluster,attribute:Attribute,mode:Mode):number{
 if(attribute==='all')return (c.scores.EHD+c.scores.length+c.scores.width+c.scores.orientation)/4;
 if(attribute!=='combined')return c.scores[attribute];
 const s=c.scores;return mode==='geom'?s.EHD:mode==='att'?(s.length+s.width+s.orientation)/3:(s.EHD+s.length+s.width+s.orientation)/4;
}
export function differenceColor(value:number){const t=Math.max(0,Math.min(1,value));return `rgb(${Math.round(255-51*t)}, ${Math.round(238-158*t)}, ${Math.round(225-205*t)})`}
function location(features:Feature[],image:Vector['properties']['image']){
 let row=0,col=0,total=0;
 for(const f of features){const pts=f.geometry.coordinates;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);row+=(a[0]+b[0])/2*length;col+=(a[1]+b[1])/2*length;total+=length;}}
 if(!total)return 'undetermined';
 const y=row/total/image.height_px,x=col/total/image.width_px;
 return `${y<1/3?'upper':y>2/3?'lower':'middle'} ${x<1/3?'left':x>2/3?'right':'center'}`;
}
function regions(features:Feature[],image:Vector['properties']['image']){
 const areas=new Map<string,number>();for(const f of features){const at=location([f],image);areas.set(at,(areas.get(at)||0)+1)}
 return [...areas].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([region,segments])=>({region,segments}));
}
export function summarize(score:Scores,gt:Vector,test:Vector,mode:Mode){
 const components=[{name:'Geometry',value:score.d_bar_ehd,key:'EHD'},{name:'Length',value:score.d_bar_length,key:'length'},{name:'Width',value:score.d_bar_width,key:'width'},{name:'Orientation',value:score.d_bar_orientation,key:'orientation'}];
 const active=components.filter(c=>mode==='default'||(mode==='geom'?c.key==='EHD':c.key!=='EHD'));
 const max=Math.max(...active.map(c=>c.value));
 const leaders=active.filter(c=>Math.abs(c.value-max)<.00011);
 const matchedReference=score.matched_clusters.reduce((sum,c)=>sum+c.scores.length_GT,0);
 const unmatched=score.unmatched_length_GT_mm+score.unmatched_length_Testing_mm;
 const penalty=unmatched/(matchedReference+unmatched||1); // alpha=1 in the playground
 const missing=regions(score.unmatched_GT,gt.properties.image),extra=regions(score.unmatched_Testing,gt.properties.image);
 const top=[...score.matched_clusters].map(c=>({cluster:c.cluster_id,local_difference:round(clusterValue(c,'combined',mode)),region:location([...c.from_file_GT,...c.from_file_Testing],gt.properties.image)})).sort((a,b)=>b.local_difference-a.local_difference).filter(c=>c.local_difference>0).slice(0,3);
 const headline=score.CRASDI===0?'No difference measured under these settings.':unmatched>0&&Math.abs(score.CRASDI-penalty)<.0002?'The measured difference comes from unmatched crack structure.':`${leaders.map(c=>c.name).join(', ')} ${leaders.length===1?'is the largest component':'are tied as the largest components'} in this comparison.`;
 const modeName=mode==='default'?'all four attributes':mode==='geom'?'geometry only':'length, width, and orientation';
 const interpretation=`CRASDI is ${score.CRASDI.toFixed(3)} using ${modeName}. Lower values mean closer agreement; this is a difference index, not a percentage of incorrect pixels or a pavement condition rating.`;
 const observations:string[]=[];
 if(score.unmatched_GT.length)observations.push(`${score.unmatched_GT.length} reference segment${score.unmatched_GT.length===1?' has':'s have'} no match in the testing map (${score.unmatched_length_GT_mm.toFixed(1)} mm), centered in the ${missing.map(x=>x.region).join(', ')}. Inspect the dashed yellow traces for omitted structure or displacement beyond the matching tolerance.`);
 if(score.unmatched_Testing.length)observations.push(`${score.unmatched_Testing.length} testing segment${score.unmatched_Testing.length===1?' has':'s have'} no reference match (${score.unmatched_length_Testing_mm.toFixed(1)} mm), centered in the ${extra.map(x=>x.region).join(', ')}. Solid yellow traces show this additional or displaced structure.`);
 if(!unmatched)observations.push(`All segments were assigned to matched groups. ${score.CRASDI===0?'The selected score components agree at the reported precision.':'The measured difference is within those groups, rather than unmatched segments.'}`);
 if(top.length)observations.push(`The highest local difference is in matched group ${top[0].cluster}, centered in the ${top[0].region} (${top[0].local_difference.toFixed(3)} under the selected scoring mode). Local colors describe matched groups; they are not pixelwise errors.`);
 if(unmatched)observations.push(`Unmatched length adds about ${penalty.toFixed(3)} to every displayed component. A nonzero width or orientation component can therefore appear even when the matched cracks agree.`);
 const checks=score.CRASDI===0?'Agreement here concerns the represented crack maps and selected settings; it does not establish that either map is ground truth.':leaders.some(c=>c.key==='width')&&leaders.length===1?'Check mask thickness, threshold, and resolution when interpreting the width difference. The score alone cannot identify its cause.':'Check alignment, matching radius, and mask completeness before interpreting this as a detection error or physical change.';
 return {headline,interpretation,observations,checks,evidence:{schema_version:1,summary_method:'local_rules',mode,score:score.CRASDI,components:Object.fromEntries(components.map(c=>[c.key,c.value])),image_px:[gt.properties.image.height_px,gt.properties.image.width_px],segments:{reference:gt.features.length,testing:test.features.length,matched_groups:score.matched_clusters.length},unmatched:{reference_mm:score.unmatched_length_GT_mm,testing_mm:score.unmatched_length_Testing_mm,additive_penalty:round(penalty),reference_regions:missing,testing_regions:extra},top_matched_regions:top}};
}
