#!/usr/bin/env python3
"""Inject the small campaign-player color selector into an already built
VeilCast+Secret Rooms copy. The original code and native player Save remain
untouched; fails closed if the expected previous features are missing.
"""
import argparse
from pathlib import Path
import sys
HERE=Path(__file__).resolve().parent
INSERT='/* ============ render ============ */'
COLOR='BEGIN VeilCast Campaign Player Color Picker'
SECRET='BEGIN VeilCast Secret Room Toggle'
FOG='BEGIN VeilCast Per-Token Fog Exclusion Toggle'
MULTI='BEGIN VeilCast Native Campaign Player Multi Add'

def patch(original, feature):
    if COLOR in original:raise ValueError('Player colors already installed; refusing duplicate.')
    if SECRET not in original:raise ValueError('Expected existing Secret Rooms feature.')
    if any(x in original for x in ['BEGIN VeilCast Monster Manager','BEGIN VeilCast Combat Tracker Map Tokens']):
        raise ValueError('Outdated monster token patch present. Rebuild cleanly first.')
    for needle in [INSERT,'id="jugador"','id="jgPersonaje"','id="btnAddJug"','id="juglist"']:
        if original.count(needle)!=1:raise ValueError('Unexpected VeilCast structure: '+needle)
    # Match the exact order produced by the other opt-in patch tools.
    expected=['arrancar();','initSecretRooms();']
    if FOG in original:expected.append('initFogExclusionToggle();')
    if MULTI in original:expected.append('initVeilCastMultiAdd();')
    end='\n'.join(expected)+'\n})();'
    if original.count(end)!=1:raise ValueError('Cannot identify safe feature initialization block.')
    result=original.replace(INSERT,feature+'\n'+INSERT,1)
    return result.replace(end,'\n'.join(expected+['initVeilCastPlayerColorPicker();'])+'\n})();',1)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--site',type=Path,default=HERE/'VeilCast_SecretRooms')
    ap.add_argument('--check-only',action='store_true')
    args=ap.parse_args()
    file=args.site/'index.html'
    if not file.exists():raise ValueError('Missing already-built VeilCast: '+str(file))
    current=file.read_text('utf-8')
    feature=(HERE/'player_color_feature.js').read_text('utf-8')
    updated=patch(current,feature)
    if args.check_only:
        print('OK: Player-color patch can be safely applied.');return
    temp=file.with_name('index.html.playercolor-tmp')
    if temp.exists():raise ValueError('Temporary file already exists; refusing overwrite.')
    try:
        temp.write_text(updated,encoding='utf-8')
        temp.replace(file)
    finally:
        if temp.exists():temp.unlink()
    print('OK: Player color picker added. Secret Rooms, fog, and native Save unchanged.')

if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('NOT PATCHED:',exc,file=sys.stderr)
        raise SystemExit(1)
