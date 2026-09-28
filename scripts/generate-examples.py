"""Synthetic examples scored with the unmodified pinned upstream CRASDI implementation."""
import json, sys, copy
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'public'))
from crasdi import crasdi
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
# Pixel coordinates stored in CRASDI row/column convention.
lines=[[[24,82],[43,94],[57,89],[78,105],[99,99],[119,112],[139,108],[159,120],[181,113],[204,129],[229,121]],[[78,105],[67,134],[72,154],[61,175],[68,193],[57,214]],[[139,108],[148,84],[139,66],[151,44]],[[181,113],[167,144],[176,162],[163,184],[173,210]]]
def vm(ls):
 return {'type':'FeatureCollection','properties':{'image':{'height_px':256,'width_px':256}},'features':[{'type':'Feature','geometry':{'type':'LineString','coordinates':line},'properties':{'name':f'branch-{i}','width_mm':[0]+[8+((j%3)*2) for j in range(len(line)-2)]+[0]}} for i,line in enumerate(ls)]}
gt=vm(lines)
cases=[]
configurations={}
pixel_sizes=[2,4,8]
matching_radii=[1,3,5,10]
for key,label,desc in [('missing','Missing branch','One branch is absent from the testing map. Unmatched crack length contributes to the difference score.'),('identical','Identical maps','The same vector map is used twice: all four attributes agree.'),('shift','Small displacement','All testing segments are shifted three pixels to the right, while the reference stays fixed.'),('extra','Extra branch','An additional, disconnected segment appears in the testing map. It is counted as unmatched length.'),('growth','Wider & longer','Existing cracks widen and extend at their tips. The original paths stay in place; no disconnected crack is added. Widths are doubled along existing nonzero-width points. This is a synthetic growth example, not a deterioration forecast.')]:
 test=copy.deepcopy(gt)
 if key=='missing':test['features'].pop(2)
 if key=='shift':
  for f in test['features']:
   for p in f['geometry']['coordinates']:p[1]+=3
 if key=='extra':test['features']+=vm([[[35,40],[57,45],[77,33],[100,42]]])['features']
 if key=='growth':
  extensions=[[[243,127],[251,125]],[[48,232],[53,247]],[[154,25],[143,9]],[[164,230],[171,247]]]
  for f,extension in zip(test['features'],extensions):
   f['geometry']['coordinates']+=extension
   widths=[2*w for w in f['properties']['width_mm']]
   widths[-1]=16 # The old tip is now an interior point.
   f['properties']['width_mm']=widths+[16,0]
 res={m:crasdi(copy.deepcopy(test),copy.deepcopy(gt),output_path=None,mode=m) for m in ['default','geom','att']}
 configurations[key]={f'{pixel}-{radius}':{m:(res[m] if pixel==4 and radius==5 else crasdi(copy.deepcopy(test),copy.deepcopy(gt),output_path=None,mode=m,pixel_size=pixel,epsilon=radius)) for m in ['default','geom','att']} for pixel in pixel_sizes for radius in matching_radii}
 cases.append({'id':key,'label':label,'description':desc,'gt':gt,'test':test,'results':res})
 for name,vector in [('reference',gt),('testing',test)]:
  (ROOT/f'public/crasdi/{key}-{name}.geojson').write_text(json.dumps(vector))
  img=Image.new('L',(256,256));draw=ImageDraw.Draw(img)
  for f in vector['features']:
   points=[(p[1],p[0]) for p in f['geometry']['coordinates']]
   if key=='growth':
    # Illustration only: rasterize segment-average widths at 4 mm/pixel.
    widths=f['properties']['width_mm']
    for j in range(1,len(points)):
     draw.line([points[j-1],points[j]],fill=255,width=max(1,round((widths[j-1]+widths[j])/8)))
   else:draw.line(points,fill=255,width=3)
  img.save(ROOT/f'public/crasdi/{key}-{name}.png')
(ROOT/'data/examples.json').write_text(json.dumps({'source_commit':'9aba96fa250bb98887d1e6cca463d645aa744715','cases':cases}))
print([(c['id'],c['results']['default']['CRASDI']) for c in cases])

# Store matching evidence once per configuration; modes only change weighting.
for variants in configurations.values():
 for key,modes in list(variants.items()):
  assert all(all(value==modes['default'][field] for field,value in result.items() if field not in ('CRASDI','CRASDI_mode')) for result in modes.values())
  variants[key]={'evidence':modes['default'],'totals':{mode:result['CRASDI'] for mode,result in modes.items()}}
(ROOT/'data/example-configurations.json').write_text(json.dumps({'pixel_sizes':pixel_sizes,'matching_radii':matching_radii,'results':configurations},separators=(',',':')))
