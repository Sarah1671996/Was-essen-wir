import sys,os
from collections import deque
from PIL import Image, ImageFilter
import numpy as np
src,dst=sys.argv[1],sys.argv[2]
for f in sorted(os.listdir(src)):
    im=Image.open(os.path.join(src,f)).convert('RGB')
    a=np.asarray(im).astype(int); h,w,_=a.shape
    mn=a.min(axis=2); spread=a.max(axis=2)-mn
    bg=(mn>222)&(spread<28)
    seen=np.zeros((h,w),bool); q=deque()
    for x in range(w):
        for y in (0,h-1):
            if bg[y,x] and not seen[y,x]: seen[y,x]=1; q.append((y,x))
    for y in range(h):
        for x in (0,w-1):
            if bg[y,x] and not seen[y,x]: seen[y,x]=1; q.append((y,x))
    while q:
        y,x=q.popleft()
        for ny,nx in ((y+1,x),(y-1,x),(y,x+1),(y,x-1)):
            if 0<=ny<h and 0<=nx<w and not seen[ny,nx] and bg[ny,nx]:
                seen[ny,nx]=1; q.append((ny,nx))
    alpha=Image.fromarray(np.where(seen,0,255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.5))
    out=im.convert('RGBA'); out.putalpha(alpha); out=out.crop(out.getbbox())
    out.save(os.path.join(dst,os.path.splitext(f)[0]+'.png')); print(f,out.size)
