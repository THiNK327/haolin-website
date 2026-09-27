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
for key,label,desc in [('missing','Missing branch','One branch is absent from the testing map. Unmatched crack length contributes to the difference score.'),('identical','Identical maps','The same vector map is used twice: all four attributes agree.'),('shift','Small displacement','All testing segments are shifted three pixels to the right, while the reference stays fixed.'),('extra','Extra branch','An additional, disconnected segment appears in the testing map. It is counted as unmatched length.')]:
 test=copy.deepcopy(gt)
 if key=='missing':test['features'].pop(2)
 if key=='shift':
  for f in test['features']:
   for p in f['geometry']['coordinates']:p[1]+=3
 if key=='extra':test['features']+=vm([[[35,40],[57,45],[77,33],[100,42]]])['features']
 res={m:crasdi(copy.deepcopy(test),copy.deepcopy(gt),output_path=None,mode=m) for m in ['default','geom','att']}
 cases.append({'id':key,'label':label,'description':desc,'gt':gt,'test':test,'results':res})
 for name,vector in [('reference',gt),('testing',test)]:
  (ROOT/f'public/crasdi/{key}-{name}.geojson').write_text(json.dumps(vector))
  img=Image.new('L',(256,256));draw=ImageDraw.Draw(img)
  for f in vector['features']:draw.line([(p[1],p[0]) for p in f['geometry']['coordinates']],fill=255,width=3)
  img.save(ROOT/f'public/crasdi/{key}-{name}.png')
(ROOT/'data/examples.json').write_text(json.dumps({'source_commit':'9aba96fa250bb98887d1e6cca463d645aa744715','cases':cases}))
print([(c['id'],c['results']['default']['CRASDI']) for c in cases])
