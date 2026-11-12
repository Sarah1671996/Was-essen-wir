import sys,os
import numpy as np
from PIL import Image
src,names,dst=sys.argv[1],sys.argv[2].split(','),sys.argv[3]
im=Image.open(src).convert('RGB');a=np.asarray(im).astype(int)
fg=~((a.min(2)>222)&((a.max(2)-a.min(2))<28))
def runs(v,minlen=40):
    r=[];s=None
    for i,x in enumerate(v):
        if x and s is None:s=i
        if not x and s is not None:
            if i-s>=minlen:r.append((s,i))
            s=None
    if s is not None:r.append((s,len(v)))
    return r
boxes=[]
for y0,y1 in runs(fg.sum(1)>3):
    band=fg[y0:y1]
    for x0,x1 in runs(band.sum(0)>3):
        sub=fg[y0:y1,x0:x1];ys=np.where(sub.sum(1)>0)[0]
        boxes.append((x0,y0+ys[0],x1,y0+ys[-1]+1))
print(len(boxes),'pieces')
for nm,(x0,y0,x1,y1) in zip(names,boxes):
    p=14;im.crop((max(0,x0-p),max(0,y0-p),min(im.width,x1+p),min(im.height,y1+p))).save(os.path.join(dst,nm+'.jpg'))
