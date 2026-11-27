/* BEGIN VeilCast Campaign Player Color Picker (v1)
 * Additive: UI-only player color labels; never changes fog, tokens, player
 * data objects, Secret Rooms, or the existing Multi Add form and save code.
 * Stores color choices in browser localStorage. This is NOT yet a canvas
 * token recoloring feature or native-backup field.
 */
function initVeilCastPlayerColorPicker(){
  const form=document.getElementById('jugador');
  const character=document.getElementById('jgPersonaje');
  const nativeAdd=document.getElementById('btnAddJug');
  const list=document.getElementById('juglist');
  if(!form||!character||!nativeAdd||!list||document.getElementById('vpc-color'))return;
  const actions=form.querySelector('.card .acts');
  if(!actions)return;
  const save=Array.from(actions.querySelectorAll('button')).find(b=>/save|create|add|accept/i.test(b.textContent||'')) ||
             Array.from(actions.querySelectorAll('button')).find(b=>b.classList.contains('primary'));
  if(!save)return;

  // Separate metadata: original VeilCast's persistence and player model
  // remain untouched. Distinct browser profiles have independent preferences.
  const STORE='veilcast-player-colors-v1:'+location.origin+location.pathname;
  const HEX=/^#[0-9a-fA-F]{6}$/;
  const DEFAULT='#5F93E6';
  const load=()=>{
    try{
      const data=JSON.parse(localStorage.getItem(STORE)||'{}');
      if(!data||typeof data!=='object'||Array.isArray(data))return {};
      return Object.fromEntries(Object.entries(data).filter(([name,color])=>name.length<256&&HEX.test(color)));
    }catch(_){return {};}
  };
  const colors=load();
  const saveColors=()=>{try{localStorage.setItem(STORE,JSON.stringify(colors));}catch(e){console.warn('[Player Color Picker] Could not save colors',e);}};
  const key=name=>String(name||'').trim().toLocaleLowerCase();

  const label=document.createElement('label');
  label.id='vpc-color-wrap';
  label.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0;padding:8px 10px;border:1px solid var(--line,#657183);border-radius:7px;';
  const span=document.createElement('span');
  span.textContent='Character color';
  span.style.cssText='font-size:12px;font-weight:600';
  const color=document.createElement('input');
  color.id='vpc-color';color.type='color';color.value=DEFAULT;
  color.title='Color associated with this character; Multi Add copies receive the same color';
  color.style.cssText='width:60px;height:33px;padding:0;border:0;cursor:pointer;background:transparent';
  label.append(span,color);
  // The native Save button remains unchanged. The Multi Add form continues
  // to snapshot this input with all its other native form fields.
  actions.insertAdjacentElement('beforebegin',label);

  const hint=document.createElement('small');
  hint.style.cssText='display:block;font-size:11px;opacity:.72;margin:-8px 0 9px';
  hint.textContent='Multi Add uses this same color for every numbered character.';
  label.insertAdjacentElement('afterend',hint);

  function drawSwatches(){
    // Decorate text in the native J-tool dropdown without altering its values.
    const tokenJug=document.getElementById('tokenJug');
    for(const option of tokenJug?.options||[]){
      const candidate=key(option.textContent);
      if(colors[candidate])option.style.color=colors[candidate];
    }
    // Add a color stripe to native roster cards with a name match.
    const candidates=Object.keys(colors).sort((a,b)=>b.length-a.length);
    for(const row of list.children){
      const text=key(row.textContent);
      const name=candidates.find(n=> text===n || text.startsWith(n+' ') || text.startsWith(n+'\n') || text.includes('\n'+n+'\n'));
      if(name){row.style.borderLeft='4px solid '+colors[name];row.dataset.vpcPlayerColor=colors[name];}
    }
  }
  let painting=false;
  function update(){
    if(painting)return;
    painting=true;
    try{drawSwatches();}finally{painting=false;}
  }
  let scheduled=false;
  const schedule=()=>{
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(()=>{scheduled=false;update();});
  };

  let wasOpen=false;
  const opened=()=>!form.classList.contains('hide')&&getComputedStyle(form).display!=='none';
  function showStoredColor(){
    const name=key(character.value);
    color.value=colors[name]||DEFAULT;
  }
  nativeAdd.addEventListener('click',()=>{
    // Native dialog reset runs first, then restore our own default.
    queueMicrotask(()=>{if(opened())color.value=DEFAULT;});
  });
  // Also preload saved color when the existing Edit Player path is used.
  new MutationObserver(()=>{
    const now=opened();
    if(now&&!wasOpen)queueMicrotask(showStoredColor);
    wasOpen=now;
  }).observe(form,{attributes:true,attributeFilter:['class','style']});
  character.addEventListener('change',()=>{if(opened()&&colors[key(character.value)])showStoredColor();});

  function nameExists(name){
    const select=document.getElementById('tokenJug');
    if(Array.from(select?.options||[]).some(o=>key(o.textContent)===name))return true;
    return Array.from(list.children).some(el=>key(el.textContent).startsWith(name));
  }
  save.addEventListener('click',()=>{
    const name=key(character.value);
    const chosen=color.value;
    if(!name||!HEX.test(chosen))return;
    const existed=nameExists(name);
    const started=Date.now();
    // Observe the native Save's success instead of altering its handler.
    // For Multi Add, the dialog may reopen immediately for the next copy.
    function check(){
      if((!opened() || (!existed && nameExists(name)))){
        colors[name]=chosen;saveColors();schedule();return;
      }
      if(Date.now()-started<3500)setTimeout(check,40);
    }
    queueMicrotask(check);
  },{capture:true});

  new MutationObserver(schedule).observe(list,{subtree:true,childList:true});
  const select=document.getElementById('tokenJug');
  if(select)new MutationObserver(schedule).observe(select,{subtree:true,childList:true});
  schedule();
}
/* END VeilCast Campaign Player Color Picker */
