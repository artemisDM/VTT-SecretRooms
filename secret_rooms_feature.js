/* BEGIN VeilCast Secret Room Toggle — additive extension (2026-11-23)
 * This section is embedded INSIDE VeilCast's original IIFE by the builder.
 * It does not alter walls, fog, tokens, or normal scene rendering.
 */
const SECRET_ROOM_CACHE = new Map();
function secretRoomImage(room) {
  const previous = SECRET_ROOM_CACHE.get(room.id);
  if (previous && previous.src === room.dataUrl) return previous.img;
  const img = new Image();
  SECRET_ROOM_CACHE.set(room.id, {src: room.dataUrl, img});
  img.onload = () => draw();
  img.onerror = () => console.warn('Could not load secret room:', room.name);
  img.src = room.dataUrl;
  return img;
}

/* Called AFTER the base map image has been drawn, BEFORE the usual fog pass.
   Overlay pixels remain hidden wherever existing VeilCast fog covers them. */
function secretRoomsDraw(c, scene) {
  if (!scene || scene.type !== 'map' || !scene.secretRooms) return;
  for (const room of scene.secretRooms) {
    if (!room.visible || !room.dataUrl) continue;
    const img = secretRoomImage(room);
    if (img.complete && img.naturalWidth > 0)
      c.drawImage(img, 0, 0, scene.w, scene.h);
  }
}

function initSecretRooms() {
  if (document.getElementById('secret-rooms-launcher')) return;
  const button = document.createElement('button');
  button.id = 'secret-rooms-launcher';
  button.textContent = 'Secret Rooms';
  button.title = 'DM-only secret room artwork toggles';
  button.style.cssText = 'position:fixed;right:14px;bottom:58px;z-index:30000;padding:8px 12px;'+
    'background:#25364a;color:#fff;border:1px solid #6c8298;border-radius:7px;'+
    'font:600 12px system-ui;cursor:pointer;box-shadow:0 3px 14px #0008';
  document.body.appendChild(button);

  const panel = document.createElement('div');
  panel.id = 'secret-rooms-panel';
  panel.style.cssText = 'display:none;position:fixed;right:14px;bottom:104px;z-index:30000;'+
    'width:330px;max-height:65vh;overflow:auto;padding:13px;background:#111925;'+
    'border:1px solid #66788d;border-radius:10px;color:#e8eef6;'+
    'font:12px system-ui;box-shadow:0 14px 35px #000b';
  document.body.appendChild(panel);

  const top = document.createElement('div');
  top.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px';
  const title = document.createElement('strong');
  title.textContent = 'Secret Room Toggle';
  title.style.fontSize = '14px';
  const close = document.createElement('button');
  close.textContent = '×'; close.title='Close';
  close.style.cssText = 'color:#fff;background:transparent;border:0;font-size:22px;cursor:pointer';
  top.append(title,close); panel.appendChild(top);

  const sceneLine = document.createElement('div');
  sceneLine.style.cssText = 'color:#b0c3d6;margin-bottom:7px';
  panel.appendChild(sceneLine);
  const info = document.createElement('p');
  info.textContent = 'Import a transparent PNG the SAME size as this map. '+
    'The room is invisible at first. Reveal/Hide only changes the artwork under the existing fog.';
  info.style.cssText='color:#9fb0c3;line-height:1.4;margin:6px 0 10px';
  panel.appendChild(info);

  const picker = document.createElement('input');
  picker.type='file'; picker.accept='image/png,image/webp'; picker.multiple=true;
  picker.style.display='none';
  panel.appendChild(picker);
  const add = document.createElement('button');
  add.textContent='+ Add room overlay';
  add.style.cssText='padding:7px 10px;background:#345a76;color:white;border:1px solid #729ab7;'+
    'border-radius:5px;cursor:pointer;margin-bottom:8px';
  panel.appendChild(add);
  const listing = document.createElement('div');
  panel.appendChild(listing);
  const status = document.createElement('div');
  status.style.cssText='min-height:14px;color:#e7c47d;margin-top:8px';
  panel.appendChild(status);

  const note = msg => {status.textContent=msg;};
  const currentScene = () => {
    const scene = sc();
    return scene && scene.type==='map' ? scene : null;
  };
  function persist(scene) {
    tocarEscena();
    // Save immediately in addition to VeilCast's existing deferred autosave.
    guardarEscenaMeta(scene).catch(err=>{
      console.error('Secret room save failed:',err);
      note('Saving failed. Check storage space and export a backup.');
    });
    draw();
  }
  function btn(text, action, danger=false) {
    const b=document.createElement('button'); b.type='button'; b.textContent=text;
    b.style.cssText='padding:5px 8px;border-radius:5px;cursor:pointer;'+
      (danger?'background:#54282a;border:1px solid #9b5250;color:#fff':
       'background:#263f55;border:1px solid #50738f;color:#fff');
    b.onclick=action;
    return b;
  }
  function refresh() {
    const scene=currentScene();
    sceneLine.textContent=scene ? ('Map: '+scene.name) : 'Select a map first';
    add.disabled=!scene; add.style.opacity=scene?'1':'0.5';
    listing.replaceChildren();
    if (!scene) return;
    const rooms=scene.secretRooms||[];
    if (!rooms.length) {
      const msg=document.createElement('div');
      msg.textContent='No secret rooms added to this map.';
      msg.style.color='#8097ad'; listing.appendChild(msg);
    }
    for (const room of rooms) {
      const row=document.createElement('div');
      row.style.cssText='padding:9px 0;border-top:1px solid #374a5b';
      const name=document.createElement('div');
      name.textContent=room.name;
      name.style.cssText='font-weight:600;margin-bottom:6px;overflow-wrap:anywhere';
      const actions=document.createElement('div');
      actions.style.cssText='display:flex;flex-wrap:wrap;gap:7px';
      const toggle=btn(room.visible?'Hide':'REVEAL',()=>{
        room.visible=!room.visible;
        persist(scene); refresh();
      });
      if (room.visible) toggle.style.background='#265e42';
      const del=btn('Remove',()=>{
        if(!window.confirm('Remove secret room "'+room.name+'" from this map?')) return;
        scene.secretRooms=scene.secretRooms.filter(r=>r.id!==room.id);
        SECRET_ROOM_CACHE.delete(room.id);
        persist(scene); refresh();
      },true);
      actions.append(toggle,del); row.append(name,actions); listing.appendChild(row);
    }
  }
  function parseImageData(dataUrl) {
    return new Promise((resolve,reject)=>{
      const i=new Image();
      i.onload=()=>resolve({width:i.naturalWidth,height:i.naturalHeight});
      i.onerror=()=>reject(new Error('Invalid image'));
      i.src=dataUrl;
    });
  }
  function asDataUrl(file) {
    return new Promise((resolve,reject)=>{
      const fr=new FileReader();
      fr.onload=()=>resolve(fr.result);
      fr.onerror=()=>reject(new Error('Could not read '+file.name));
      fr.readAsDataURL(file);
    });
  }
  add.onclick=()=>picker.click();
  picker.onchange=async()=>{
    const scene=currentScene();
    const files=Array.from(picker.files||[]);
    picker.value='';
    if(!scene || !files.length) return;
    for (const file of files) {
      if (!/^image\/(png|webp)$/.test(file.type)) {
        note('Use transparent PNG or WebP images only.'); continue;
      }
      try {
        const dataUrl=await asDataUrl(file);
        const dim=await parseImageData(dataUrl);
        if (dim.width!==scene.w || dim.height!==scene.h) {
          note(file.name+': '+dim.width+'×'+dim.height+' does not match this map ('+
            scene.w+'×'+scene.h+'). Use a full-size aligned transparent image.');
          continue;
        }
        const name=window.prompt('Secret room name:',file.name.replace(/\.[^.]+$/,''));
        if(name===null) continue;
        const entry={id:'secret-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),
          name:name.trim()||file.name,visible:false,dataUrl};
        scene.secretRooms=scene.secretRooms||[];
        scene.secretRooms.push(entry);
        persist(scene);
        note('Added hidden room: '+entry.name);
      } catch (err) {console.error(err);note('Unable to import '+file.name);}
    }
    refresh();
  };
  button.onclick=()=>{
    const show=panel.style.display==='none';
    panel.style.display=show?'block':'none';
    if(show) refresh();
  };
  close.onclick=()=>panel.style.display='none';
  let lastSceneId=null;
  setInterval(()=>{
    const s=currentScene(), id=s?s.id:null;
    if(id!==lastSceneId){lastSceneId=id; note(''); if(panel.style.display!=='none') refresh();}
  },650);
}
/* END VeilCast Secret Room Toggle */
