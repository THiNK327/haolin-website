"""Bounded browser adapter; does not modify CRASDI's scoring implementation."""
import json, math, base64, io
import numpy as np
from PIL import Image
from crasdi import crasdi
from crasdi.vectorize import vectorize_crack_map

def validate_vector(v):
    if not isinstance(v,dict) or v.get('type')!='FeatureCollection':
        raise ValueError('Expected a CRASDI GeoJSON FeatureCollection.')
    image=v.get('properties',{}).get('image',{})
    h,w=image.get('height_px',0),image.get('width_px',0)
    if not all(isinstance(x,int) and not isinstance(x,bool) and 1<=x<=512 for x in (h,w)):
        raise ValueError('Image height_px and width_px must be integers from 1 to 512.')
    features=v.get('features',[])
    if not isinstance(features,list) or not 1<=len(features)<=100:
        raise ValueError('Use 1–100 crack segments in each map.')
    total=0
    for f in features:
        g=f.get('geometry',{})
        pts=g.get('coordinates',[])
        if g.get('type')!='LineString' or not isinstance(pts,list) or len(pts)<2:
            raise ValueError('Every feature must be a LineString with at least two points.')
        total+=len(pts)
        for p in pts:
            if not isinstance(p,list) or len(p)!=2 or not all(isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x) for x in p):
                raise ValueError('Coordinates must be finite [row, column] pixel pairs.')
            if not (0<=p[0]<h and 0<=p[1]<w):
                raise ValueError('Coordinates must lie inside the image bounds.')
        if not any(p!=pts[0] for p in pts[1:]):raise ValueError('Zero-length segments are not supported.')
        widths=f.get('properties',{}).get('width_mm')
        if not isinstance(widths,list) or len(widths)!=len(pts) or not all(isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x) and 0<=x<=512 for x in widths):
            raise ValueError('Each segment needs a finite nonnegative width_mm value per point (maximum 512).')
    if total>5000:raise ValueError('Maximum 5,000 vector points per map.')
    return v

def read_map(item,threshold,invert):
    if item['kind']=='vector':return validate_vector(item['value'])
    if item['kind']!='png':raise ValueError('Use PNG or CRASDI GeoJSON files.')
    raw=base64.b64decode(item['value'],validate=True)
    if len(raw)>2*1024*1024:raise ValueError('Maximum file size is 2 MB.')
    im=Image.open(io.BytesIO(raw))
    if im.format!='PNG' or getattr(im,'n_frames',1)!=1:raise ValueError('Use a single-frame PNG mask.')
    if not (1<=im.width<=512 and 1<=im.height<=512):raise ValueError('PNG images must be at most 512 × 512 pixels. Images are never resized automatically.')
    if 'A' in im.getbands() and im.getchannel('A').getextrema()!=(255,255):raise ValueError('Use an opaque PNG without transparent pixels.')
    a=np.array(im.convert('L'))
    binary=(a>threshold)
    if invert:binary=~binary
    if binary.sum()==0:raise ValueError('No crack pixels found. Check threshold and polarity.')
    if binary.mean()>.25:raise ValueError('More than 25% of the image is foreground. Use a sparse crack mask and check polarity.')
    return validate_vector(vectorize_crack_map(a,threshold=threshold,invert=invert,min_branch_px=2))

def run_request(raw):
    req=json.loads(raw)
    p=req['params']
    if p['mode'] not in ['default','geom','att']:raise ValueError('Invalid scoring mode.')
    for key,lo,hi in [('pixel_size',.01,100),('epsilon',1,10),('threshold',0,254)]:
        v=p[key]
        if not isinstance(v,(int,float)) or not math.isfinite(v) or not lo<=v<=hi:raise ValueError('Invalid '+key)
    test=read_map(req['test'],p['threshold'],p['invert'])
    gt=read_map(req['gt'],p['threshold'],p['invert'])
    if test['properties']['image']!=gt['properties']['image']:raise ValueError('Both maps must have the same image dimensions.')
    result=crasdi(test,gt,output_path=None,mode=p['mode'],pixel_size=p['pixel_size'],epsilon=p['epsilon'],alpha=1.0,overlap_threshold=.5)
    return json.dumps({'scores':result,'test':test,'gt':gt,'parameters':p,'source_commit':'9aba96fa250bb98887d1e6cca463d645aa744715'},allow_nan=False)
