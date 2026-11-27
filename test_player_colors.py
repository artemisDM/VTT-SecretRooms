#!/usr/bin/env python3
"""Patch checks for the additive native form color picker. No live app required."""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from add_player_colors import patch
base='''<div id="jugador"></div><input id="jgPersonaje"><button id="btnAddJug"></button><div id="juglist"></div>
/* BEGIN VeilCast Secret Room Toggle */
/* ============ render ============ */
arrancar();
initSecretRooms();
})();'''
feat=Path(__file__).with_name('player_color_feature.js').read_text()
res=patch(base,feat)
assert res.count('initVeilCastPlayerColorPicker();')==1
assert res.count('initSecretRooms();')==1
assert 'initVeilCastMultiAdd();' not in res
assert res.count('BEGIN VeilCast Campaign Player Color Picker')==1
try:
 patch(res,feat)
except ValueError:pass
else:raise AssertionError('Duplicate patch not blocked')
with_multi=base.replace('/* ============ render ============ */','/* BEGIN VeilCast Native Campaign Player Multi Add */\n/* ============ render ============ */').replace('initSecretRooms();','initSecretRooms();\ninitVeilCastMultiAdd();')
res=patch(with_multi,feat)
assert 'initVeilCastMultiAdd();\ninitVeilCastPlayerColorPicker();' in res
with_fog=base.replace('/* ============ render ============ */','/* BEGIN VeilCast Per-Token Fog Exclusion Toggle */\n/* ============ render ============ */').replace('initSecretRooms();','initSecretRooms();\ninitFogExclusionToggle();')
res=patch(with_fog,feat)
assert 'initFogExclusionToggle();\ninitVeilCastPlayerColorPicker();' in res
print('PASS: Safe additive patch, Secret Rooms, optional Fog and Multi Add, duplicates blocked')
