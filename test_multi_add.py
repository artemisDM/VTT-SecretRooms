#!/usr/bin/env python3
"""Offline safety tests for the isolated source patch."""
from add_multi_add import patch, MARKER

anchor='/* ============ render ============ */'
ui='<button id="btnAddJug"></button><div id="juglist"></div><div id="jugador"></div><input id="jgPersonaje">'
js='/* BEGIN VeilCast Secret Room Toggle */\n'+anchor+'\narrancar();\ninitSecretRooms();\n})();'
feature='/* BEGIN VeilCast Native Campaign Player Multi Add */\nfunction initVeilCastMultiAdd(){}'
html=ui+js
result=patch(html,feature)
assert MARKER in result
assert result.count('initVeilCastMultiAdd();')==1
assert 'initSecretRooms();' in result
assert result.replace(feature+'\n','').replace('initVeilCastMultiAdd();\n','')==html
try:patch(result,feature)
except ValueError:pass
else:raise AssertionError('duplicate patch allowed')

with_fog=ui+'/* BEGIN VeilCast Secret Room Toggle */\n/* BEGIN VeilCast Per-Token Fog Exclusion Toggle */\n'+anchor+'\narrancar();\ninitSecretRooms();\ninitFogExclusionToggle();\n})();'
result=patch(with_fog,feature)
assert 'initFogExclusionToggle();\ninitVeilCastMultiAdd();' in result
assert 'BEGIN VeilCast Per-Token Fog Exclusion Toggle' in result
assert result.replace(feature+'\n','').replace('initVeilCastMultiAdd();\n','')==with_fog

try:patch(ui+'/* BEGIN VeilCast Combat Tracker Map Tokens */'+js,feature)
except ValueError:pass
else:raise AssertionError('old combat patch should be refused')

print('PASS: Secret Rooms-only patch, Secret Rooms+Fog patch, unchanged code, duplicate rejection, obsolete combat patch rejection')
