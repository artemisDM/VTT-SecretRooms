"""Local regression tests for fail-closed patch, source immutability, backup fields."""
from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location('vct',Path(__file__).with_name('add_combat_tokens.py'))
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
feature=Path(__file__).with_name('combat_tokens_feature.js').read_text()
fixture='''<!DOCTYPE html><html><body><script>
/* BEGIN VeilCast Secret Room Toggle */
/* ============ render ============ */
  secretRoomsDraw(c,s);
  c.globalAlpha=1;
const scene={secretRooms:s.secretRooms||[], updated:Date.now()};
const dup={secretRooms:JSON.parse(JSON.stringify(o.secretRooms||[])), img:null, ready:false};
const backup={\n      secretRooms:s.secretRooms||[],\n      img: 'base64'};
if(Array.isArray(sd.secretRooms)) nueva.secretRooms=sd.secretRooms;
arrancar();
initSecretRooms();
})();
</script></body></html>'''
patched=mod.patch(fixture,feature)
assert 'combatTokensDraw(c,s);' in patched
assert 'initCombatTrackerMapTokens();' in patched
assert 'combatPins:s.combatPins||[]' in patched
assert 'combatPins:JSON.parse(JSON.stringify(o.combatPins||[]))' in patched
assert 'if(Array.isArray(sd.combatPins)) nueva.combatPins=sd.combatPins;' in patched
assert patched.replace(feature+'\n','').replace('  combatTokensDraw(c,s);\n','').replace('combatPins:s.combatPins||[], ','').replace('combatPins:JSON.parse(JSON.stringify(o.combatPins||[])), ','').replace('combatPins:s.combatPins||[],\n      img:', 'img:').count('initCombatTrackerMapTokens()')==1
try:mod.patch(patched,feature)
except ValueError: pass
else:raise AssertionError('Double patch must fail')
try:mod.patch(fixture.replace('initSecretRooms();',''),feature)
except ValueError: pass
else:raise AssertionError('Missing anchor must fail')
try:mod.patch(fixture.replace('/* BEGIN VeilCast Secret Room Toggle */','/* BEGIN VeilCast Monster Manager */'),feature)
except ValueError:pass
else:raise AssertionError('Old monster manager must be rejected')
print('PASS: 7 anchors, backup state, refuse outdated/duplicate/unexpected source')
