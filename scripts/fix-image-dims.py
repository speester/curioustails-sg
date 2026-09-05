# -*- coding: utf-8 -*-
"""fix-image-dims.py - rewrite image-dims.json (and the asset map) from the actual files.

Every <img> this site renders carries width/height so it reserves its own space and cannot
shift the section under it while loading. Those numbers come from the asset map, and the
map's own RIFF/WebP header parse silently returns 0x0 for most chunk layouts - 161 of 162
entries on the last run. Pillow reads them correctly, so this is the authority.

Run after any image generation or re-wire:  python scripts/fix-image-dims.py
"""
import io, json, os
from PIL import Image

os.chdir(os.environ.get("PROJECT_ROOT", os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
amap = json.load(io.open('public/images/asset-map.json', encoding='utf-8'))
dims, fixed = {}, 0
for v in amap.values():
    if not isinstance(v, dict): continue
    for i in v.get('images', []):
        f = os.path.join('public', i['file'].lstrip('/'))
        if not os.path.exists(f): continue
        with Image.open(f) as im: w, h = im.size
        if i.get('width') != w: fixed += 1
        i['width'], i['height'] = w, h
        dims[i['file']] = {'width': w, 'height': h}
io.open('public/images/asset-map.json','w',encoding='utf-8').write(json.dumps(amap,indent=2,ensure_ascii=False))
io.open('src/data/image-dims.json','w',encoding='utf-8').write(json.dumps(dims,indent=2))
print("dims %d (corrected %d)" % (len(dims), fixed))
