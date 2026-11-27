/* BEGIN VeilCast Per-Token Fog Exclusion Toggle (v1)
 * Tiny adapter around the ORIGINAL #tokenVision input.
 * No new rendering, raycasting, fog state, player records or save schema.
 * Unchecked = native vision radius; checked = native vision radius 0.
 * Zero vision is already supported by VeilCast and saved by VeilCast itself.
 */
function initFogExclusionToggle(){
  const select=document.getElementById('tokenJug');
  const vision=document.getElementById('tokenVision');
  const grp=document.getElementById('grp-token');
  if(!select||!vision||!grp||document.getElementById('vfx-no-fog'))return;
  const label=document.createElement('label');
  label.id='vfx-no-fog-wrap';
  label.style.cssText='display:inline-flex;align-items:center;gap:5px;white-space:nowrap;cursor:pointer;font-size:12px';
  label.title='Give this token zero vision, so it cannot reveal fog or unexplored rooms. Token display stays unchanged.';
  const checkbox=document.createElement('input');
  checkbox.type='checkbox';
  checkbox.id='vfx-no-fog';
  checkbox.setAttribute('aria-label','Exclude selected token from fog of war discovery');
  label.append(checkbox,document.createTextNode('Exclude from fog'));
  const visionWrap=vision.parentElement;
  if(visionWrap&&visionWrap.parentElement){visionWrap.insertAdjacentElement('afterend',label);}
  else grp.append(label);

  // A saved radius is a UX convenience only: the authoritative fog setting is
  // STILL the native per-token Vision radius, stored by unmodified VeilCast.
  // Values are keyed per token and per map URL. Nothing is sent to GitHub.
  const prefix='vfx-last-vision-v1:'+location.pathname+':';
  let updating=false;
  const id=()=>String(select.value||'').trim();
  const stored=()=>{
    try{const n=Number(localStorage.getItem(prefix+id()));return Number.isFinite(n)&&n>0?n:null;}
    catch(e){return null;}
  };
  const remember=(value)=>{
    if(!id()||!(value>0))return;
    try{localStorage.setItem(prefix+id(),String(value));}catch(e){}
  };
  const sync=()=>{
    if(updating)return;
    const active=!!id();
    checkbox.disabled=!active;
    const n=Number(vision.value);
    checkbox.checked=active&&Number.isFinite(n)&&n===0;
    label.style.opacity=active?'1':'.55';
    if(active&&n>0)remember(n);
  };
  function setNativeVision(n){
    updating=true;
    vision.value=String(n);
    // Let the original VeilCast handlers handle all scene updates and saving.
    vision.dispatchEvent(new Event('input',{bubbles:true}));
    vision.dispatchEvent(new Event('change',{bubbles:true}));
    updating=false;
    sync();
  }
  checkbox.addEventListener('change',()=>{
    if(!id()){sync();return;}
    if(checkbox.checked){
      const n=Number(vision.value);
      if(n>0)remember(n);
      setNativeVision(0);
    }else{
      setNativeVision(stored()||30);
    }
  });
  select.addEventListener('change',()=>{queueMicrotask(sync);setTimeout(sync,0);});
  vision.addEventListener('input',sync);
  vision.addEventListener('change',sync);
  // Native UI may repopulate the player list when campaign or scene changes.
  new MutationObserver(()=>queueMicrotask(sync)).observe(select,{childList:true,subtree:true});
  // A scene switch is a UI-only event; refresh checkbox after native handlers run.
  document.addEventListener('click',e=>{
    if(e.target.closest('#vfx-no-fog-wrap'))return;
    setTimeout(sync,0);
  },false);
  sync();
}
/* END VeilCast Per-Token Fog Exclusion Toggle */
