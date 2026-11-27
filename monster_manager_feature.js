/* BEGIN VeilCast Monster Manager — isolated additive extension (2026-11-27)
 * Monster details load from externally hosted 5e.tools-format bestiary JSON.
 * This addon does not modify VeilCast's existing tokens, combat or fog algorithms.
 * Monster sprites are drawn between the base map and VeilCast fog.
 * WARNING: exploration memory does not equal current visibility. The DM must
 * manually hide monsters after they leave line of sight in Exploration mode.
 */
const VCM_DATA_BASE='https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/';
const VCM_DB_NAME='vcm-monster-catalog-v1';
const VCM_IMAGES=new Map();
const VCM_SOURCE_NAMES={XMM:"MM'25",XPHB:"PHB'24",XDMG:"DMG'24"};
const VCM_SOURCE_TITLES={XMM:'Monster Manual (2025)',MM:'Monster Manual (2014)',FTD:"Fizban's Treasury of Dragons",ToA:'Tomb of Annihilation',MPMM:'Mordenkainen Presents: Monsters of the Multiverse',AI:'Acquisitions Incorporated',BAM:"Boo's Astral Menagerie",BGG:'Bigby Presents: Glory of the Giants',XPHB:"Player's Handbook (2024)",XDMG:"Dungeon Master's Guide (2024)"};
function vcmSourceDisplay(src){return VCM_SOURCE_NAMES[src]||src;}
let vcmCanvas=null;
let vcmView=null;
let vcmPlace=null;
let vcmMove=false;
let vcmActiveMapId=null;
let vcmRefreshPanel=()=>{};

function vcmCatalogOpen() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(VCM_DB_NAME,1);
    request.onerror=()=>reject(request.error);
    request.onupgradeneeded=()=>request.result.createObjectStore('store');
    request.onsuccess=()=>resolve(request.result);
  });
}
async function vcmCatalogCacheRead() {
  try {
    const db=await vcmCatalogOpen();
    return await new Promise(resolve=>{
      const tx=db.transaction('store','readonly');
      const r=tx.objectStore('store').get('catalog');
      r.onsuccess=()=>resolve(r.result||null);
      r.onerror=()=>resolve(null);
      tx.oncomplete=()=>db.close();
    });
  } catch(e) {console.warn('Monster cache unavailable:',e);return null;}
}
async function vcmCatalogCacheWrite(value) {
  try {
    const db=await vcmCatalogOpen();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('store','readwrite');
      tx.objectStore('store').put(value,'catalog');
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
    });
    db.close();
  } catch(e) {console.warn('Monster cache not saved:',e);}
}
function vcmMonsterType(t) {return typeof t==='string'?t:(t&&typeof t.type==='string'?t.type:'—');}
function vcmMonsterCR(cr) {
  if(cr===0||typeof cr==='string'||typeof cr==='number')return String(cr);
  if(cr&&typeof cr==='object')return vcmMonsterCR(cr.cr??cr.lair??cr.coven??'—');
  return '—';
}
function vcmMonsterHP(hp) {
  if(hp===0||typeof hp==='number')return Math.max(0,Math.round(hp));
  if(hp&&typeof hp==='object'&&Number.isFinite(hp.average))return Math.max(0,Math.round(hp.average));
  if(hp&&typeof hp==='object'&&typeof hp.special==='string'){
    const m=/\d+/.exec(hp.special);if(m)return Number(m[0]);
  }
  return null;
}
function vcmMonsterAC(ac) {
  const first=Array.isArray(ac)?ac[0]:ac;
  if(typeof first==='number')return first;
  if(first&&typeof first==='object'&&Number.isFinite(first.ac))return first.ac;
  return null;
}
function vcmIndexMonster(m,sourceFallback) {
  if(!m||typeof m.name!=='string')return null;
  const source=String(m.source||sourceFallback||'—');
  return {key:m.name.toLowerCase()+'|'+source.toLowerCase(),name:m.name,source,
    sourceDisplay:vcmSourceDisplay(source),type:vcmMonsterType(m.type),cr:vcmMonsterCR(m.cr),
    hp:vcmMonsterHP(m.hp),ac:vcmMonsterAC(m.ac),
    size:Array.isArray(m.size)?m.size.join('/'):String(m.size||''),
    copy:m._copy?{name:m._copy.name,source:m._copy.source}:null};
}
async function vcmFetchJSON(url) {
  const resp=await fetch(url,{mode:'cors',cache:'default'});
  if(!resp.ok)throw Error('HTTP '+resp.status+' '+url);
  return resp.json();
}
async function vcmLoadAllBestiary(onProgress) {
  const files=await vcmFetchJSON(VCM_DATA_BASE+'index.json');
  const entries=Object.entries(files).filter(([source,file])=>
    typeof file==='string'&&/^bestiary-[a-zA-Z0-9_.-]+\.json$/.test(file));
  if(!entries.length)throw Error('Bestiary source index contains no valid files');
  let cursor=0,loaded=0,failed=0;
  const entriesByKey=new Map();
  const failedSources=[];
  const worker=async()=>{
    while(cursor<entries.length){
      const [source,file]=entries[cursor++];
      try {
        const body=await vcmFetchJSON(VCM_DATA_BASE+file);
        for(const m of (Array.isArray(body.monster)?body.monster:[])){
          const data=vcmIndexMonster(m,source);
          if(data)entriesByKey.set(data.key,data);
        }
      }catch(err){failed++;failedSources.push(source);console.warn('Bestiary failed:',source,err);}
      loaded++;
      onProgress?.(loaded,entries.length,entriesByKey.size,failed);
    }
  };
  await Promise.all(Array.from({length:6},()=>worker()));
  if(!entriesByKey.size)throw Error('Could not fetch any monster sources. Check network/CORS restrictions.');
  // Many 5e.tools variants inherit statistics via `_copy`.
  for(const m of entriesByKey.values()){
    if(!m.copy)continue;
    const base=entriesByKey.get(m.copy.name.toLowerCase()+'|'+String(m.copy.source||m.source).toLowerCase());
    if(!base)continue;
    if(m.hp===null)m.hp=base.hp;
    if(m.ac===null)m.ac=base.ac;
    if(m.type==='—')m.type=base.type;
    if(m.cr==='—')m.cr=base.cr;
    if(!m.size)m.size=base.size;
  }
  return {entries:Array.from(entriesByKey.values()).sort((a,b)=>a.name.localeCompare(b.name)||a.source.localeCompare(b.source)),
    savedAt:Date.now(),totalBooks:entries.length,failedSources};
}
function vcmUniqueId(){return 'vcm-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
function vcmImageFor(token){
  if(!token.art)return null;
  const old=VCM_IMAGES.get(token.id);
  if(old&&old.src===token.art)return old.image;
  const image=new Image();
  VCM_IMAGES.set(token.id,{src:token.art,image});
  image.onload=()=>draw();
  image.src=token.art;
  return image;
}
function monsterManagerDraw(c,s){
  if(!s||s.type!=='map')return;
  vcmCanvas=c.canvas;
  vcmView={transform:c.getTransform(),sceneId:s.id,scene:s};
  const list=Array.isArray(s.vcmMonsters)?s.vcmMonsters:[];
  for(const t of list){
    if(!t.visible||!Number.isFinite(t.x)||!Number.isFinite(t.y))continue;
    const r=Math.max(7,Math.min(100,(Number(t.diameter)||32)/2));
    c.save();c.globalAlpha=1;
    c.beginPath();c.arc(t.x,t.y,r,0,Math.PI*2);c.closePath();
    c.fillStyle=t.color||'#9c3b45';c.fill();
    const img=vcmImageFor(t);
    if(img&&img.complete&&img.naturalWidth){
      c.save();c.clip();c.drawImage(img,t.x-r,t.y-r,2*r,2*r);c.restore();
    }else{
      c.font='bold '+Math.round(r*.95)+'px system-ui';c.textAlign='center';c.textBaseline='middle';
      c.fillStyle='#fff';c.fillText((t.name||'?').slice(0,1).toUpperCase(),t.x,t.y);
    }
    c.strokeStyle='#f1e7d5';c.lineWidth=Math.max(1,r/10);c.stroke();c.restore();
  }
}
function vcmEventMapPoint(event){
  if(!vcmCanvas||!vcmView)return null;
  const bounds=vcmCanvas.getBoundingClientRect();
  if(!bounds.width||!bounds.height)return null;
  // Translate CSS pixels to canvas backing pixels, then invert the map transform.
  const point=new DOMPoint((event.clientX-bounds.left)*vcmCanvas.width/bounds.width,
    (event.clientY-bounds.top)*vcmCanvas.height/bounds.height);
  let p;
  try{p=point.matrixTransform(vcmView.transform.inverse());}catch(_){return null;}
  return {x:p.x,y:p.y};
}
function initMonsterManager(){
  if(document.getElementById('vcm-launcher'))return;
  const root=document.createElement('section');root.id='vcm-root';
  root.style.cssText='position:fixed;right:14px;bottom:12px;z-index:30010;font:12px system-ui;color:#e8eef6';
  document.body.append(root);
  const launch=document.createElement('button');launch.id='vcm-launcher';
  launch.textContent='Monsters';launch.style.cssText='background:#344b40;color:white;padding:8px 12px;border:1px solid #759c88;border-radius:7px;cursor:pointer';
  root.append(launch);
  const panel=document.createElement('div');panel.style.cssText='display:none;position:absolute;right:0;bottom:44px;width:395px;max-width:calc(100vw - 28px);max-height:77vh;overflow:auto;background:#131d25;padding:13px;border:1px solid #678b87;border-radius:10px;box-shadow:0 12px 34px #000b';root.append(panel);
  const el=(tag,txt,style='')=>{const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(style)n.style.cssText=style;return n;};
  const h=el('div',null,'display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px');
  h.append(el('strong','Monster Manager · 5e.tools','font-size:14px'));
  const close=el('button','×','border:0;background:none;color:white;cursor:pointer;font-size:23px');h.append(close);panel.append(h);
  const help=el('p','All indexed bestiary sourcebooks, source abbreviations and variants. Load once, then search and place tokens. DM must reveal/hide monsters manually; VeilCast fog remains unchanged.',
    'color:#b7c9d8;line-height:1.35;margin:4px 0 8px');panel.append(help);
  const status=el('div','Catalog not loaded','color:#d2bf8e;margin:6px 0');panel.append(status);
  const loadBtn=el('button','Load all bestiary','padding:7px;background:#285b55;color:white;border:1px solid #679b91;border-radius:5px;cursor:pointer');panel.append(loadBtn);
  const search=el('input',null,'width:100%;box-sizing:border-box;margin:9px 0;padding:8px;background:#1a2936;color:#fff;border:1px solid #556977;border-radius:5px');search.placeholder='Search names, books, sources, types...';panel.append(search);
  const results=el('div',null,'max-height:190px;overflow:auto;border:1px solid #41515f;border-radius:5px');panel.append(results);
  const selected=el('div','Select a monster from the list.','margin:8px 0;color:#cde1e6');panel.append(selected);
  const options=el('div',null,'display:flex;align-items:center;gap:7px;margin-bottom:8px');panel.append(options);
  const count=el('input');count.type='number';count.value='1';count.min='1';count.max='30';count.style.cssText='width:55px;background:#23323f;color:#fff;border:1px solid #60758a;padding:6px';
  options.append(el('span','Copies:'),count);
  const add=el('button','Add to map','background:#285b55;color:white;padding:7px;border:1px solid #679b91;border-radius:5px;cursor:pointer');options.append(add);
  const hint=el('div','Select a token below, then click “Place / move” and click its map position. Only this mode intercepts clicks.',
    'font-size:11px;color:#9db3c3;line-height:1.4;margin:9px 0');panel.append(hint);
  const roster=el('div');panel.append(roster);
  const notice=el('p','Note: In Exploration mode, previously seen map pixels can remain revealed. Hide a monster when it leaves current sight. This add-on does not change the engine’s fog or combat tracker.',
    'font-size:11px;line-height:1.3;color:#edc58a;border-top:1px solid #3c4a57;padding-top:8px;margin-bottom:0');panel.append(notice);
  let catalog=null,choice=null,loading=false;
  let queryTimer=0;
  const btn=(name,fn)=>{const b=el('button',name,'padding:5px 7px;background:#344f60;border:1px solid #587b90;color:white;border-radius:5px;cursor:pointer');b.onclick=fn;return b;};
  const scene=()=>{const s=sc();return s&&s.type==='map'?s:null;};
  const persist=s=>{tocarEscena();guardarEscenaMeta(s).catch(e=>{console.error('Monster save error',e);status.textContent='Save failed; export a backup.';});draw();};
  function entriesRender(){
    results.replaceChildren();
    if(!catalog)return;
    const q=search.value.toLocaleLowerCase().trim();
    const match=catalog.entries.filter(m=>!q||[m.name,m.source,m.sourceDisplay||m.source,m.type,m.cr].some(v=>String(v).toLocaleLowerCase().includes(q)));
    const top=match.slice(0,90);
    const heading=el('div',`${match.length} matches${match.length>90?' (showing first 90)':''}`,'padding:4px 6px;font-size:11px;color:#9cb1c1');results.append(heading);
    for(const m of top){
      const row=el('button',null,'display:grid;grid-template-columns:2.5fr 1.2fr 0.6fr 0.8fr;align-items:center;gap:5px;width:100%;padding:5px;text-align:left;border:0;border-top:1px solid #314252;color:#e4eef6;background:'+(choice?.key===m.key?'#34516b':'transparent')+';cursor:pointer');
      [m.name,m.type,m.cr,m.sourceDisplay||m.source].forEach((v,i)=>{const x=el('span',String(v),'overflow:hidden;white-space:nowrap;text-overflow:ellipsis;'+(i===3?'color:#8ad2fa':''));if(i===3)x.title=VCM_SOURCE_TITLES[m.source]||m.source;row.append(x);});
      row.onclick=()=>{choice=m;selected.textContent=`${m.name} · ${m.sourceDisplay||m.source} · CR ${m.cr} · HP ${m.hp??'—'} · AC ${m.ac??'—'}`;entriesRender();};results.append(row);
    }
  }
  function rosterRender(){
    const s=scene();roster.replaceChildren();
    if(!s){roster.append(el('p','Select a map scene.'));return;}
    const all=Array.isArray(s.vcmMonsters)?s.vcmMonsters:[];
    roster.append(el('strong','Map monsters ('+all.length+')'));
    for(const t of all){
      const row=el('div',null,'padding:7px 0;border-bottom:1px solid #354554');
      row.append(el('div',`${t.name} [${vcmSourceDisplay(t.source)}] · AC ${t.ac??'—'} · HP ${t.hp??'—'}/${t.maxHp??'—'} · ${t.visible?'Visible':'Hidden'}`,'margin-bottom:5px;overflow-wrap:anywhere'));
      const controls=el('div',null,'display:flex;gap:5px;flex-wrap:wrap');
      controls.append(btn(t.visible?'Hide':'Reveal',()=>{t.visible=!t.visible;persist(s);rosterRender();}));
      controls.append(btn('Place / move',()=>{vcmPlace={sceneId:s.id,tokenId:t.id};vcmMove=true;status.textContent='Click the desired position ON THE MAP. Press Escape to cancel.';}));
      controls.append(btn('−5 HP',()=>{t.hp=Math.max(0,(t.hp??t.maxHp??0)-5);persist(s);rosterRender();}));
      controls.append(btn('+5 HP',()=>{t.hp=Math.min(t.maxHp??1e8,(t.hp??0)+5);persist(s);rosterRender();}));
      controls.append(btn('Edit HP/AC',()=>{
        const hp=window.prompt('Current HP:',String(t.hp??''));if(hp===null)return;
        const ac=window.prompt('Armor Class:',String(t.ac??''));if(ac===null)return;
        if(hp.trim()!==''&&!Number.isNaN(Number(hp)))t.hp=Math.max(0,Number(hp));
        if(ac.trim()!==''&&!Number.isNaN(Number(ac)))t.ac=Number(ac);
        persist(s);rosterRender();
      }));
      controls.append(btn('Size',()=>{const n=window.prompt('Token diameter in map image pixels:',String(t.diameter||32));if(n!==null&&Number(n)>=8&&Number(n)<=240){t.diameter=Number(n);persist(s);}}));
      controls.append(btn('Art',()=>{const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=()=>{
        const file=input.files?.[0];if(!file)return;
        if(file.size>1_500_000){status.textContent='Image too large. Use an image smaller than 1.5 MB.';return;}
        const reader=new FileReader();reader.onload=()=>{t.art=reader.result;persist(s);};reader.readAsDataURL(file);
      };input.click();}));
      controls.append(btn('Delete',()=>{if(!window.confirm(`Remove ${t.name} from map?`))return;s.vcmMonsters=s.vcmMonsters.filter(m=>m.id!==t.id);VCM_IMAGES.delete(t.id);persist(s);rosterRender();}));
      row.append(controls);roster.append(row);
    }
  }
  vcmRefreshPanel=rosterRender;
  loadBtn.onclick=async()=>{
    if(loading)return;
    loading=true;loadBtn.disabled=true;
    try {
      status.textContent='Downloading bestiary index...';
      catalog=await vcmLoadAllBestiary((completed,total,count,failed)=>{
        status.textContent=`Loading ${completed}/${total} books · ${count} monsters · ${failed} failed`;});
      await vcmCatalogCacheWrite(catalog);
      status.textContent=`Loaded ${catalog.entries.length} monsters from ${catalog.totalBooks} sources`+
        (catalog.failedSources.length?`; ${catalog.failedSources.length} sources unavailable`:'');
      entriesRender();
    }catch(err){console.error(err);status.textContent='Catalog error: '+err.message;}
    finally {loading=false;loadBtn.disabled=false;loadBtn.textContent='Refresh catalog';}
  };
  add.onclick=()=>{
    const s=scene();if(!s){status.textContent='Select a map.';return;}
    if(!choice){status.textContent='Select a monster first.';return;}
    const n=Math.max(1,Math.min(30,Math.floor(Number(count.value)||1)));
    s.vcmMonsters=s.vcmMonsters||[];
    for(let i=0;i<n;i++){
      const pos={x:s.w/2+((i%5)-2)*38,y:s.h/2+Math.floor(i/5)*38};
      s.vcmMonsters.push({id:vcmUniqueId(),name:choice.name+(n>1?' '+(i+1):''),
        source:choice.source,type:choice.type,cr:choice.cr,
        ac:choice.ac,hp:choice.hp,maxHp:choice.hp,size:choice.size,
        x:pos.x,y:pos.y,diameter:32,visible:false});
    }
    persist(s);rosterRender();status.textContent=`Added ${n} hidden monster(s) near map center; use Place / move to position and Reveal to show.`;
  };
  search.oninput=()=>{clearTimeout(queryTimer);queryTimer=setTimeout(entriesRender,80);};
  launch.onclick=()=>{const open=panel.style.display==='none';panel.style.display=open?'block':'none';if(open){rosterRender();entriesRender();}};
  close.onclick=()=>panel.style.display='none';
  // Optional click-to-place listens in capture phase only while explicitly armed.
  document.addEventListener('pointerdown',event=>{
    if(!vcmPlace||!vcmCanvas||!vcmCanvas.contains(event.target))return;
    const s=scene();if(!s||s.id!==vcmPlace.sceneId||vcmView?.sceneId!==s.id)return;
    const p=vcmEventMapPoint(event);if(!p||p.x<0||p.y<0||p.x>s.w||p.y>s.h)return;
    const t=(s.vcmMonsters||[]).find(m=>m.id===vcmPlace.tokenId);
    if(!t)return;
    event.preventDefault();event.stopImmediatePropagation();
    t.x=p.x;t.y=p.y;vcmPlace=null;vcmMove=false;persist(s);rosterRender();
    status.textContent=`Placed ${t.name}.`;
  },true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&vcmPlace){vcmPlace=null;vcmMove=false;status.textContent='Placement canceled.';}},true);
  let lastSceneId=null;
  setInterval(()=>{
    const s=scene(), id=s?.id??null;
    if(id!==lastSceneId){lastSceneId=id;if(panel.style.display!=='none')rosterRender();}
  },800);
  vcmCatalogCacheRead().then(cached=>{
    if(!cached||!Array.isArray(cached.entries))return;
    catalog=cached;status.textContent=`Cached: ${catalog.entries.length} monsters. Click Refresh catalog to update.`;
    loadBtn.textContent='Refresh catalog';entriesRender();
  });
}
/* END VeilCast Monster Manager */
