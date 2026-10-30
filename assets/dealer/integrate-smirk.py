from PIL import Image
import numpy as np, cv2, shutil
from pathlib import Path
p=Path('assets/dealer/v3'); archive=p/'before-lip-smirk';archive.mkdir(exist_ok=True)
for i in (7,14):
 if not (archive/f'face-{i}.png').exists():shutil.copy2(p/f'face-{i}.png',archive/f'face-{i}.png')
base=Image.open(p/'frame-0.png').convert('RGBA'); base=Image.alpha_composite(base,Image.open(p/'face-0.png').convert('RGBA'))
a=np.array(base);mask=np.zeros(a.shape[:2],np.uint8)
cv2.fillPoly(mask,[np.array([(209,280),(219,280),(226,289),(238,295),(250,297),(252,301),(244,304),(232,302),(221,297),(212,289)])],255)
clean=cv2.inpaint(a[:,:,:3],mask,3,cv2.INPAINT_TELEA)
# Transfer only the generated lip ink; all other portrait pixels stay original.
gen=Image.open(p/'smirk-generated-source.png').convert('RGB').crop((511,815,710,884))
gray=np.array(gen).min(axis=2).astype(float)
ink=np.clip((170-gray)/100,0,1)
rgba=np.zeros((*ink.shape,4),np.uint8);rgba[:,:,:3]=[19,18,24];rgba[:,:,3]=(ink*255).astype('uint8')
lips=Image.fromarray(rgba).resize((43,18),Image.Resampling.LANCZOS)
full=Image.fromarray(np.dstack([clean,a[:,:,3]]));full.alpha_composite(lips,(212,282))
# Lock the edit to the lower muzzle and preserve the exact original silhouette.
f=np.array(full); f[:,:,3]=a[:,:,3]
full=Image.fromarray(f)
full.save(p/'face-7.png');Image.blend(base,full,.5).save(p/'face-14.png')
diff=np.any(np.array(full)!=a,axis=2);ys,xs=np.where(diff)
print('Changed bounds:',xs.min(),ys.min(),xs.max(),ys.max())
assert not diff[:279].any();assert np.array_equal(np.array(full)[:,:,3],a[:,:,3])
preview=Path('artifacts/animation-preview');preview.mkdir(parents=True,exist_ok=True)
full.save(preview/'new-smirk.png')
