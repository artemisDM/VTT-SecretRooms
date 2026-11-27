#!/usr/bin/env python3
"""Add *native combat-tracker map tokens* to a Secret Rooms-only VeilCast build.

An exact-anchored, fail-closed transformation. The original builder, secret
rooms code, and every upstream asset remain unchanged. No external bestiary.

Typical deployment:
  python3 build_veilcast_secretrooms.py
  python3 add_combat_tokens.py

The workflow controls this patch with a manual input, so you can redeploy
Secret Rooms only with one click to roll back.
"""
from __future__ import annotations
import argparse
from pathlib import Path

BASE=Path(__file__).resolve().parent

def patch_once(source,needle,replacement,description):
    n=source.count(needle)
    if n!=1:
        raise ValueError(f'NOT PATCHED: {description}: expected exactly one anchor, found {n}.')
    return source.replace(needle,replacement,1)

def patch(source,feature):
    if 'BEGIN VeilCast Combat Tracker Map Tokens' in source:
        raise ValueError('Combat Tokens is already applied.')
    if 'BEGIN VeilCast Monster Manager' in source:
        raise ValueError('Old 5e.tools Monster Manager is still present. Restore Secret Rooms-only first.')
    if 'BEGIN VeilCast Secret Room Toggle' not in source:
        raise ValueError('Secret Rooms-only build required. Refusing to modify unsupported version.')
    edits=[
      ('/* ============ render ============ */',
        feature+'\n/* ============ render ============ */',
        'insert additive helper functions'),
      ('  secretRoomsDraw(c,s);\n  c.globalAlpha=1;',
        '  secretRoomsDraw(c,s);\n  combatTokensDraw(c,s);\n  c.globalAlpha=1;',
        'draw on original map before original fog'),
      ('secretRooms:s.secretRooms||[], updated:Date.now()',
        'secretRooms:s.secretRooms||[], combatPins:s.combatPins||[], updated:Date.now()',
        'persist map token positions'),
      ('secretRooms:JSON.parse(JSON.stringify(o.secretRooms||[])), img:null, ready:false',
        'secretRooms:JSON.parse(JSON.stringify(o.secretRooms||[])), '
        'combatPins:JSON.parse(JSON.stringify(o.combatPins||[])), img:null, ready:false',
        'copy positions when duplicating a map'),
      ('      secretRooms:s.secretRooms||[],\n      img:',
        '      secretRooms:s.secretRooms||[], combatPins:s.combatPins||[],\n      img:',
        'include positions in campaign export'),
      ('if(Array.isArray(sd.secretRooms)) nueva.secretRooms=sd.secretRooms;',
        'if(Array.isArray(sd.secretRooms)) nueva.secretRooms=sd.secretRooms;\n'
        '      if(Array.isArray(sd.combatPins)) nueva.combatPins=sd.combatPins;',
        'restore positions during campaign backup import'),
      ('arrancar();\ninitSecretRooms();\n})();',
        'arrancar();\ninitSecretRooms();\ninitCombatTrackerMapTokens();\n})();',
        'initialize controls in native tracker and J tool'),
    ]
    # Check all anchors first so any upstream change fails BEFORE touching output.
    for anchor,replacement,name in edits:
        n=source.count(anchor)
        if n!=1:raise ValueError(f'NOT PATCHED: {name}: expected exactly one anchor, found {n}.')
    result=source
    for anchor,replacement,name in edits:
        result=patch_once(result,anchor,replacement,name)
    return result

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--site',type=Path,default=BASE/'VeilCast_SecretRooms')
    p.add_argument('--check-only',action='store_true')
    args=p.parse_args()
    idx=args.site/'index.html'
    if not idx.is_file():raise ValueError('Missing Secret Rooms build at '+str(idx))
    feature=(BASE/'combat_tokens_feature.js').read_text(encoding='utf-8')
    src=idx.read_text(encoding='utf-8')
    modified=patch(src,feature)
    if args.check_only:
        print('PASS: all 7 independent patch anchors and Secret Rooms checks OK. No file written.')
        return
    temp=idx.with_name('index.html.combattokens-temp')
    if temp.exists():raise RuntimeError('Refusing to overwrite unexpected temporary file.')
    try:
        temp.write_text(modified,encoding='utf-8')
        temp.replace(idx)
    finally:
        if temp.exists():temp.unlink()
    print('PASS: native combat tracker tokens added. All original source assets unchanged.')

if __name__=='__main__':
    try:main()
    except Exception as e:
        print('BUILD NOT APPLIED:',e)
        raise SystemExit(1)
