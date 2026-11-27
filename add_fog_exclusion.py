#!/usr/bin/env python3
"""Patch ONLY VeilCast's native token UI on top of the Secret Rooms build.

The original per-token Vision value remains the only source of truth. Fog is
not recalculated differently; a ticked token simply gets native Vision=0.
Requires a fresh Secret Rooms-only build, not a previously modified site.
"""
import argparse
from pathlib import Path

BASE=Path(__file__).resolve().parent

def patch(src,addon):
    if 'BEGIN VeilCast Per-Token Fog Exclusion Toggle' in src:
        raise ValueError('Fog exclusion toggle was already installed.')
    if 'BEGIN VeilCast Combat Tracker Map Tokens' in src or 'BEGIN VeilCast Monster Manager' in src:
        raise ValueError('Old combat/monster patch present; restore Secret Rooms only first.')
    if 'BEGIN VeilCast Secret Room Toggle' not in src:
        raise ValueError('Secret Rooms-only VeilCast build required.')
    expected={
        '/* ============ render ============ */':addon+'\n/* ============ render ============ */',
        'arrancar();\ninitSecretRooms();\n})();':
            'arrancar();\ninitSecretRooms();\ninitFogExclusionToggle();\n})();',
    }
    for before in expected:
        n=src.count(before)
        if n!=1:
            raise ValueError(f'VeilCast changed its structure: expected one anchor, found {n}: {before[:70]}')
    for before,after in expected.items():
        src=src.replace(before,after,1)
    return src

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--site',type=Path,default=BASE/'VeilCast_SecretRooms')
    parser.add_argument('--check-only',action='store_true')
    args=parser.parse_args()
    idx=args.site/'index.html'
    if not idx.is_file():raise ValueError('Cannot find '+str(idx))
    before=idx.read_text(encoding='utf-8')
    addon=(BASE/'fog_exclusion_toggle.js').read_text(encoding='utf-8')
    after=patch(before,addon)
    if args.check_only:
        print('OK: Secret Rooms intact, no prior monster patch, both exact anchors found. No changes made.')
        return
    tmp=idx.with_name('index.html.fog-toggle-tmp')
    if tmp.exists():raise ValueError('Unexpected temporary file, refusing to overwrite')
    try:
        tmp.write_text(after,encoding='utf-8')
        tmp.replace(idx)
    finally:
        if tmp.exists():tmp.unlink()
    print('OK: Fog exclusion toggle added to Secret Rooms-only VeilCast. Native fog code unchanged.')
if __name__=='__main__':
    try:main()
    except Exception as err:
        print('NOT PATCHED:',err)
        raise SystemExit(1)
