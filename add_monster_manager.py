#!/usr/bin/env python3
"""Add Monster Manager to an ALREADY-BUILT, working VeilCast SecretRooms copy.

This is a deliberately separate, fail-closed patch. The original
build_veilcast_secretrooms.py and secret_rooms_feature.js stay unchanged.
Only the output index.html is changed, and only at six exact, checked anchors.

Usage: python3 add_monster_manager.py
       python3 add_monster_manager.py --site VeilCast_SecretRooms
"""
from __future__ import annotations
import argparse
from pathlib import Path

HERE = Path(__file__).resolve().parent


def replace_once(text: str, old: str, new: str, description: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Refusing to patch {description}: expected 1 anchor, found {count}. "
                           "Existing site was not changed.")
    return text.replace(old, new, 1)


def patch(text: str, feature: str) -> str:
    if 'BEGIN VeilCast Monster Manager' in text:
        raise RuntimeError('This site already has Monster Manager. Existing site was not changed.')
    if 'BEGIN VeilCast Secret Room Toggle' not in text or 'initSecretRooms();' not in text:
        raise RuntimeError('Expected the existing Secret Rooms modification. Site not changed.')

    # Insert an independent function block inside the original JS closure.
    text = replace_once(text,
        '/* ============ render ============ */',
        feature + '\n/* ============ render ============ */',
        'isolated Monster Manager helpers')

    # Monster sprites are drawn alongside the existing Secret Room overlays,
    # before VeilCast's ORIGINAL fog renderer. No change to visibility algorithm.
    text = replace_once(text,
        '  secretRoomsDraw(c,s);\n  c.globalAlpha=1;',
        '  secretRoomsDraw(c,s);\n  monsterManagerDraw(c,s);\n  c.globalAlpha=1;',
        'monster drawing position beneath fog')

    # Persist an entirely new optional field, distinct from VeilCast normal tokens.
    text = replace_once(text,
        'secretRooms:s.secretRooms||[], updated:Date.now()',
        'secretRooms:s.secretRooms||[], vcmMonsters:s.vcmMonsters||[], updated:Date.now()',
        'save optional monster list')

    text = replace_once(text,
        'secretRooms:JSON.parse(JSON.stringify(o.secretRooms||[])), img:null, ready:false',
        'secretRooms:JSON.parse(JSON.stringify(o.secretRooms||[])), '
        'vcmMonsters:JSON.parse(JSON.stringify(o.vcmMonsters||[])), img:null, ready:false',
        'copy monster list when duplicating a map')

    text = replace_once(text,
        '      secretRooms:s.secretRooms||[],\n      img:',
        '      secretRooms:s.secretRooms||[], vcmMonsters:s.vcmMonsters||[],\n      img:',
        'include monsters in existing campaign backups')

    text = replace_once(text,
        'if(Array.isArray(sd.secretRooms)) nueva.secretRooms=sd.secretRooms;',
        'if(Array.isArray(sd.secretRooms)) nueva.secretRooms=sd.secretRooms;\n'
        '      if(Array.isArray(sd.vcmMonsters)) nueva.vcmMonsters=sd.vcmMonsters;',
        'restore monsters during campaign import')

    text = replace_once(text,
        'arrancar();\ninitSecretRooms();\n})();',
        'arrancar();\ninitSecretRooms();\ninitMonsterManager();\n})();',
        'initialize Monster Manager separately')
    return text


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--site',type=Path,default=HERE/'VeilCast_SecretRooms')
    p.add_argument('--check-only',action='store_true',help='Verify patch anchors without modifying files')
    args=p.parse_args()
    index=args.site/'index.html'
    if not index.is_file():
        raise RuntimeError(f'Missing built VeilCast website: {index}')
    original=index.read_text(encoding='utf-8')
    feature=(HERE/'monster_manager_feature.js').read_text(encoding='utf-8')
    changed=patch(original,feature)
    if args.check_only:
        print('PASS: all 7 integration anchors match exactly; site unchanged.')
        return
    tmp=index.with_name('index.html.monster-tmp')
    if tmp.exists():raise RuntimeError('Temporary output already exists. Refusing to overwrite.')
    try:
        tmp.write_text(changed,encoding='utf-8')
        tmp.replace(index)
    finally:
        if tmp.exists():tmp.unlink()
    print('PASS: Monster Manager added to existing Secret Rooms build.')
    print('Secret Rooms source file, original VeilCast files, and all other assets untouched.')


if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('MONSTER MANAGER NOT APPLIED:',exc)
        raise SystemExit(1)
