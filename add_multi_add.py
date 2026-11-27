#!/usr/bin/env python3
"""Add native-character Multi Add UI to the Secret Rooms VeilCast build.

Does NOT modify VeilCast's game model or token/fog/rendering code. The addon
reuses the native New Player dialog and its own Save button.
"""
from pathlib import Path
import argparse
import sys

BASE=Path(__file__).resolve().parent
MARKER='BEGIN VeilCast Native Campaign Player Multi Add'
SECRET='BEGIN VeilCast Secret Room Toggle'
FOG='BEGIN VeilCast Per-Token Fog Exclusion Toggle'
ANCHORED_COMMENT='/* ============ render ============ */'

def patch(original: str, addon: str) -> str:
    if MARKER in original:
        raise ValueError('Multi Add already installed. Refusing duplicate insertion.')
    if SECRET not in original:
        raise ValueError('Expected Secret Rooms VeilCast; not found.')
    if 'BEGIN VeilCast Monster Manager' in original or 'BEGIN VeilCast Combat Tracker Map Tokens' in original:
        raise ValueError('Old monster/combat token patch present; rebuild from Secret Rooms first.')
    if original.count(ANCHORED_COMMENT)!=1:
        raise ValueError('Cannot identify safe JavaScript feature insertion point.')
    if FOG in original:
        init='arrancar();\ninitSecretRooms();\ninitFogExclusionToggle();\n})();'
        add_init='arrancar();\ninitSecretRooms();\ninitFogExclusionToggle();\ninitVeilCastMultiAdd();\n})();'
    else:
        init='arrancar();\ninitSecretRooms();\n})();'
        add_init='arrancar();\ninitSecretRooms();\ninitVeilCastMultiAdd();\n})();'
    if original.count(init)!=1:
        raise ValueError('Cannot safely find the original initialization code. No changes made.')
    # Native dialog IDs verified in the official public HTML (2026-11).
    required=('id="btnAddJug"','id="juglist"','id="jgPersonaje"','id="jugador"')
    for identifier in required:
        if original.count(identifier)!=1:
            raise ValueError('Expected native VeilCast UI control not found: '+identifier)
    output=original.replace(ANCHORED_COMMENT,addon+'\n'+ANCHORED_COMMENT,1)
    output=output.replace(init,add_init,1)
    return output

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site',type=Path,default=BASE/'VeilCast_SecretRooms')
    parser.add_argument('--check-only',action='store_true')
    args=parser.parse_args()
    file=args.site/'index.html'
    if not file.is_file():raise ValueError('Built VeilCast index.html not found: '+str(file))
    before=file.read_text(encoding='utf-8')
    feature=(BASE/'multi_add_feature.js').read_text(encoding='utf-8')
    after=patch(before,feature)
    if args.check_only:
        print('OK: patch would add only Multi Add, preserving existing Secret Rooms and optional Fog Exclusion.')
        return
    tmp=file.with_name('index.html.multi-add-tmp')
    if tmp.exists():raise ValueError('Temporary file exists; refusing overwrite.')
    try:
        tmp.write_text(after,encoding='utf-8')
        tmp.replace(file)
    finally:
        if tmp.exists():tmp.unlink()
    print('OK: Native Multi Add added. Existing fog, token, combat and Secret Rooms source unchanged.')

if __name__=='__main__':
    try:main()
    except Exception as error:
        print('NOT PATCHED:',error,file=sys.stderr)
        raise SystemExit(1)
