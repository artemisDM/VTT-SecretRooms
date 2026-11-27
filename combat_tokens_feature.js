/* BEGIN VeilCast Combat Tracker Map Tokens — additive extension (v0.1)
 * Extends the EXISTING Combat > Initiative and existing J token selector.
 * The native combat tracker retains ownership of names, HP and initiative.
 * This feature stores ONLY per-scene map coordinates and a reveal toggle.
 * No external APIs, no bestiary, and no changes to lighting or fog logic.
 * Requires the existing VeilCast Secret Room Toggle build.
 */
const VCT_PREFIX='combatpin:';
let vctCanvas=null, vctMatrix=null, vctSceneId=null;
let vctSelectedKey=null, vctDrag=null, vctOverlay=null;
let vctLastRows=[];
let vctMessage=null;
let vctOverlayQueued=false;
let vctSuppressMouse=false;
const vctId=x=>String(x??'').trim();
const vctScene=()=>{const s=sc();return s&&s.type==='map'?s:null;};
const vctTokens=s=>Array.isArray(s?.combatPins)?s.combatPins:[];
const vctMatches=(t,k)=>t.key===k;
const vctToolOn=()=>!!document.querySelector('[data-tool="token"].on');

function vctTrackerRows(){
  const root=document.getElementById('panel')||document;
  const seen=new Map();
  const originalPlayers=new Set(Array.from(document.querySelectorAll('#tokenJug option'))
    .filter(o=>!String(o.value).startsWith(VCT_PREFIX))
    .map(o=>vctId(o.textContent).toLowerCase()).filter(Boolean));
  const rows=[];
  for(const row of root.querySelectorAll('.ini')){
    const label=row.querySelector('.nm');
    if(!label)continue;
    // Text nodes are preferred because some rows also contain condition icons.
    const name=vctId(label.childNodes.length&&label.firstChild.nodeType===3
      ?label.firstChild.textContent:label.textContent);
    if(!name)continue;
    // Characters in the existing campaign-player selector are not enemies.
    if(originalPlayers.has(name.toLowerCase()))continue;
    const internal=vctId(row.dataset.combatantId||row.dataset.combatId||row.dataset.id||
      row.getAttribute('data-combatant-id')||row.getAttribute('data-id'));
    const ordinal=(seen.get(name)||0)+1;seen.set(name,ordinal);
    // Stable native ID if VeilCast exposes one, otherwise name + duplicate index.
    // Recommend numbering identically named enemy combatants individually.
    const key=internal?'id:'+internal:'name:'+name.toLowerCase()+'#'+ordinal;
    rows.push({key,name,row});
  }
  return rows;
}
function vctPersist(s){
  if(!s)return;
  tocarEscena();
  guardarEscenaMeta(s).catch(err=>{
    console.error('[Combat Map Tokens] Save failed',err);
    vctStatus('Save failed — export a VeilCast backup.',true);
  });
  draw();
}
function vctStatus(text,error=false){
  if(vctMessage){vctMessage.textContent=text;vctMessage.style.color=error?'#ffb0aa':'#9fcfcb';}
}
function vctFind(s,key){return vctTokens(s).find(t=>vctMatches(t,key));}
function vctUpsert(s,actor,p){
  s.combatPins=s.combatPins||[];
  let token=vctFind(s,actor.key);
  if(!token){
    token={key:actor.key,name:actor.name,x:p.x,y:p.y,visible:false};
    s.combatPins.push(token);
  }else{token.x=p.x;token.y=p.y;token.name=actor.name;}
  return token;
}
function vctPoint(e){
  if(!vctCanvas||!vctMatrix)return null;
  const box=vctCanvas.getBoundingClientRect();
  if(!box.width||!box.height||!vctCanvas.width||!vctCanvas.height)return null;
  const x=(e.clientX-box.left)*vctCanvas.width/box.width;
  const y=(e.clientY-box.top)*vctCanvas.height/box.height;
  try{
    const m=new DOMPoint(x,y).matrixTransform(vctMatrix.inverse());
    return {x:m.x,y:m.y};
  }catch(err){console.warn('[Combat Map Tokens] Inverse map transform unavailable',err);return null;}
}
function vctInScene(s,p){return p&&p.x>=0&&p.y>=0&&p.x<=s.w&&p.y<=s.h;}
function vctRadius(s){
  const cell=Number(document.getElementById('gridPx')?.value)||Number(s.pxGrid)||
    Number(s.gridPx)||Number(s.celda)||28;
  return Math.max(8,Math.min(38,cell*.46));
}
function vctMarker(c,t,r,ghost=false){
  c.save(); c.globalAlpha=ghost?0.76:1;
  c.fillStyle=ghost?'#8b6b7a':'#9f3437';
  c.beginPath();c.arc(t.x,t.y,r,0,Math.PI*2);c.fill();
  c.lineWidth=Math.max(1.5,r*.15);c.strokeStyle=ghost?'#ffdca6':'#fff3dd';c.stroke();
  c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';
  c.font='bold '+Math.round(r*.96)+'px system-ui';
  const letters=String(t.name||'?').split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase();
  c.fillText(letters||'?',t.x,t.y);
  if(ghost){
    c.strokeStyle='#ffdb98';c.lineWidth=Math.max(1,r/8);
    c.beginPath();c.moveTo(t.x-r*.7,t.y-r*.7);c.lineTo(t.x+r*.7,t.y+r*.7);c.stroke();
  }
  c.restore();
}
function combatTokensDraw(c,s){
  if(!s||s.type!=='map')return;
  vctCanvas=c.canvas;vctMatrix=c.getTransform();vctSceneId=s.id;
  // Visible monsters are part of normal map rendering and therefore use VeilCast's
  // original fog. Hidden monsters are NEVER added to the player-facing canvas.
  for(const t of vctTokens(s)){
    if(t.visible&&Number.isFinite(t.x)&&Number.isFinite(t.y))vctMarker(c,t,vctRadius(s));
  }
  if(!vctOverlayQueued){
    vctOverlayQueued=true;
    requestAnimationFrame(()=>{vctOverlayQueued=false;vctDrawDMOverlay();});
  }
}
function vctDrawDMOverlay(){
  // The overlay is on the DM page only. It is NOT included in the frame VeilCast
  // sends to the Table View, and hidden monsters never enter the shared map.
  if(!document.getElementById('rail')||!vctCanvas)return;
  const s=vctScene();if(!s||s.id!==vctSceneId)return;
  if(!vctOverlay){
    vctOverlay=document.createElement('canvas');vctOverlay.id='combat-token-dm-overlay';
    vctOverlay.setAttribute('aria-hidden','true');
    vctOverlay.style.cssText='position:fixed;pointer-events:none;z-index:10;';
    document.body.append(vctOverlay);
  }
  const r=vctCanvas.getBoundingClientRect();
  vctOverlay.style.left=r.left+'px';vctOverlay.style.top=r.top+'px';
  vctOverlay.style.width=r.width+'px';vctOverlay.style.height=r.height+'px';
  if(vctOverlay.width!==vctCanvas.width)vctOverlay.width=vctCanvas.width;
  if(vctOverlay.height!==vctCanvas.height)vctOverlay.height=vctCanvas.height;
  const c=vctOverlay.getContext('2d');
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,vctOverlay.width,vctOverlay.height);
  if(vctMatrix)c.setTransform(vctMatrix);
  for(const t of vctTokens(s)){
    if(Number.isFinite(t.x)&&Number.isFinite(t.y))vctMarker(c,t,vctRadius(s),!t.visible);
  }
}
function vctPickToken(s,p){
  const r=vctRadius(s)*1.3;
  const choices=vctTokens(s).filter(t=>Number.isFinite(t.x)&&Number.isFinite(t.y));
  let winner=null,dist=r*r;
  for(const t of choices){
    const d=(t.x-p.x)**2+(t.y-p.y)**2;
    if(d<dist){winner=t;dist=d;}
  }
  return winner;
}
function vctRefreshNativeUI(){
  const s=vctScene(),sel=document.getElementById('tokenJug');
  const rows=vctTrackerRows();vctLastRows=rows;
  // Existing COMBAT rows get lightweight controls. There is no new monster panel.
  for(const actor of rows){
    const row=actor.row;
    let place=row.querySelector('.vct-place');
    if(!place){
      place=document.createElement('button');place.className='vct-place';place.type='button';
      place.textContent='📍';place.title='Place / drag this combatant on map (J)';
      place.style.cssText='margin-left:4px;min-width:26px;height:26px;cursor:pointer;';
      row.insertBefore(place,row.querySelector('.x')||null);
    }
    place.onclick=e=>{
      e.stopPropagation();e.preventDefault();
      vctSelectedKey=actor.key;
      const tool=document.querySelector('[data-tool="token"]');
      if(tool&&!vctToolOn())tool.click();
      vctEnsureOptions(sel,rows);
      if(sel)sel.value=VCT_PREFIX+actor.key;
      vctStatus('Click the map to place '+actor.name+'; drag the token to move it.');
    };
    let toggle=row.querySelector('.vct-toggle');
    if(!toggle){
      toggle=document.createElement('button');toggle.className='vct-toggle';toggle.type='button';
      toggle.style.cssText='margin-left:2px;min-width:26px;height:26px;cursor:pointer;';
      row.insertBefore(toggle,row.querySelector('.x')||null);
    }
    const pin=s?vctFind(s,actor.key):null;
    toggle.textContent=pin?(pin.visible?'👁':'◌'):'·';
    toggle.title=pin?(pin.visible?'Hide monster from players':'Reveal monster to players'):'Place token first';
    toggle.disabled=!pin;toggle.style.opacity=pin?'1':'.4';
    toggle.onclick=e=>{
      e.stopPropagation();e.preventDefault();
      const scene=vctScene(),t=scene&&vctFind(scene,actor.key);if(!t)return;
      t.visible=!t.visible;vctPersist(scene);vctRefreshNativeUI();
    };
  }
  vctEnsureOptions(sel,rows);
  if(vctMessage&&vctMessage.parentNode?.id!=='grp-token'){
    const bar=document.getElementById('grp-token');if(bar)bar.append(vctMessage);
  }
}
function vctEnsureOptions(sel,rows){
  if(!sel)return;
  const sig=rows.map(r=>r.key+'='+r.name).join('|');
  const group=sel.querySelector('optgroup[data-vct-combat]');
  if(group?.dataset.signature!==sig){
    if(group)group.remove();
    if(rows.length){
      const g=document.createElement('optgroup');g.label='Monsters — Combat tracker';
      g.dataset.vctCombat='true';g.dataset.signature=sig;
      for(const a of rows){const o=document.createElement('option');
        o.value=VCT_PREFIX+a.key;o.textContent='👹 '+a.name;g.append(o);}
      sel.append(g);
    }
  }
  if(vctSelectedKey&&rows.some(r=>r.key===vctSelectedKey)){
    // Only preserve a combatant choice while the user is still in the J tool.
    if(vctToolOn()&&sel.value!==VCT_PREFIX+vctSelectedKey)
      sel.value=VCT_PREFIX+vctSelectedKey;
  }
}
function vctPointerdown(e){
  if(!vctCanvas||e.target!==vctCanvas||!vctToolOn())return;
  const s=vctScene();if(!s||s.id!==vctSceneId)return;
  const p=vctPoint(e);if(!vctInScene(s,p))return;
  const sel=document.getElementById('tokenJug');
  const selected=sel&&String(sel.value).startsWith(VCT_PREFIX)?String(sel.value).slice(VCT_PREFIX.length):null;
  if(!selected)return;
  vctSelectedKey=selected;
  const actor=vctLastRows.find(r=>r.key===selected);if(!actor){vctStatus('Combatant missing from tracker.',true);return;}
  const near=vctPickToken(s,p);
  const pin=near&&near.key===selected?near:vctUpsert(s,actor,p);
  vctDrag={id:pin.key,sceneId:s.id,original:{x:pin.x,y:pin.y},moved:false};
  vctSuppressMouse=true;
  e.preventDefault();e.stopImmediatePropagation();
  vctPersist(s);vctRefreshNativeUI();
}
function vctPointermove(e){
  if(!vctDrag)return;
  e.preventDefault();e.stopImmediatePropagation();
  const s=vctScene();if(!s||s.id!==vctDrag.sceneId)return;
  const p=vctPoint(e);if(!vctInScene(s,p))return;
  const pin=vctFind(s,vctDrag.id);
  if(pin){pin.x=p.x;pin.y=p.y;vctDrag.moved=true;draw();}
}
function vctPointerup(e){
  if(!vctDrag)return;
  e.preventDefault();e.stopImmediatePropagation();
  const s=vctScene();if(s&&s.id===vctDrag.sceneId)vctPersist(s);
  vctDrag=null;
  setTimeout(()=>{vctSuppressMouse=false;},150);
}
function initCombatTrackerMapTokens(){
  if(document.getElementById('vct-installed'))return;
  const flag=document.createElement('span');flag.id='vct-installed';flag.style.display='none';
  document.body.append(flag);
  vctMessage=document.createElement('span');vctMessage.id='vct-hint';
  vctMessage.style.cssText='font-size:10px;max-width:230px;white-space:normal;';
  vctMessage.textContent='Select a monster from the tracker to place it here.';
  document.getElementById('tokenJug')?.addEventListener('change',e=>{
    const val=String(e.target.value);
    vctSelectedKey=val.startsWith(VCT_PREFIX)?val.slice(VCT_PREFIX.length):null;
  });
  document.addEventListener('pointerdown',vctPointerdown,true);
  document.addEventListener('pointermove',vctPointermove,true);
  document.addEventListener('pointerup',vctPointerup,true);
  document.addEventListener('pointercancel',vctPointerup,true);
  // Prevent native mouse click placement when the monster token tool intercepted
  // pointerdown; no other input is intercepted.
  for(const event of ['mousedown','mouseup','click']){
    document.addEventListener(event,e=>{
      if(!vctSuppressMouse||e.target!==vctCanvas)return;
      e.preventDefault();e.stopImmediatePropagation();
      if(event==='click')vctSuppressMouse=false;
    },true);
  }
  document.addEventListener('contextmenu',e=>{
    if(!vctCanvas||e.target!==vctCanvas||!vctToolOn())return;
    const s=vctScene(),p=s&&vctPoint(e);if(!s||!p)return;
    const pin=vctPickToken(s,p);if(!pin)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(confirm('Remove map token for '+pin.name+'? (Combat tracker entry remains)')){
      s.combatPins=vctTokens(s).filter(x=>x!==pin);
      vctPersist(s);vctRefreshNativeUI();
    }
  },true);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&vctDrag){
      const s=vctScene(),pin=s&&vctFind(s,vctDrag.id);
      if(pin){pin.x=vctDrag.original.x;pin.y=vctDrag.original.y;vctPersist(s);}
      vctDrag=null;vctStatus('Canceled token movement.');
    }
  },true);
  setInterval(vctRefreshNativeUI,600);
  vctRefreshNativeUI();
}
/* END VeilCast Combat Tracker Map Tokens */
