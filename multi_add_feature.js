/* BEGIN VeilCast Native Campaign Player Multi Add (v1.1 — prefix numbering)
 * Additive UI adapter. Uses the existing New Player form and its original
 * Save handler for EACH newly created character. The existing player model,
 * persistence, fog, rendering, tokens, combat tracker, and Secret Rooms stay
 * under VeilCast's native code. No network requests or imported bestiary.
 */
function initVeilCastMultiAdd(){
  const add=document.getElementById('btnAddJug');
  const dialog=document.getElementById('jugador');
  const character=document.getElementById('jgPersonaje');
  const list=document.getElementById('juglist');
  if(!add||!dialog||!character||!list||document.getElementById('vma-open'))return;
  const holder=add.closest('.grid2');
  const buttons=dialog.querySelector('.card .acts');
  if(!holder||!buttons)return;

  const open=document.createElement('button');
  open.type='button';open.id='vma-open';open.className='wide ghost';
  open.textContent='Multi add players';
  open.title='Create several native campaign players with identical stats and numbered names';
  open.style.cssText='width:100%;margin-top:6px';
  holder.insertAdjacentElement('afterend',open);

  const status=document.createElement('p');
  status.id='vma-status';status.className='hint';status.setAttribute('role','status');
  status.style.cssText='margin:5px 0 0;font-size:11px;display:none';
  open.insertAdjacentElement('afterend',status);
  function report(text,err=false){
    status.style.display='block';status.textContent=text;
    status.style.color=err?'#f0a6a6':'';
  }

  const controls=document.createElement('div');
  controls.id='vma-controls';controls.style.cssText='display:none;margin:12px 0 10px;padding:10px;border:1px solid #627086;border-radius:8px';
  const title=document.createElement('div');
  title.style.cssText='font-weight:600;font-size:12px;margin-bottom:7px';
  title.textContent='Create numbered copies of this character';
  const row=document.createElement('div');
  row.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap';
  const label=document.createElement('label');
  label.style.cssText='display:flex;align-items:center;gap:6px;font-size:12px';
  label.textContent='Quantity';
  const count=document.createElement('input');
  count.id='vma-count';count.type='number';count.min='2';count.max='30';count.step='1';count.value='3';
  count.style.cssText='width:65px';label.append(count);
  const run=document.createElement('button');
  run.type='button';run.id='vma-run';run.className='primary';run.textContent='Multi add';
  row.append(label,run);
  const info=document.createElement('div');
  info.style.cssText='font-size:11px;opacity:.8;margin-top:7px;line-height:1.4';
  info.textContent='Enter the base Character name and stats above. Copies inherit those fields and are named “1 Name”, “2 Name”, etc. Regular Save still creates one character.';
  controls.append(title,row,info);
  buttons.insertAdjacentElement('beforebegin',controls);

  let bulk=false,busy=false;
  const isOpen=()=>!dialog.classList.contains('hide')&&getComputedStyle(dialog).display!=='none';
  const update=()=>{controls.style.display=bulk&&isOpen()?'block':'none';};
  add.addEventListener('click',()=>{
    if(!busy){bulk=false;queueMicrotask(update);}
  });
  open.addEventListener('click',()=>{
    if(busy)return;
    add.click(); // official VeilCast's unmodified New Player dialog
    bulk=true;
    update();
    character.focus();
  });

  const fields=()=>Array.from(dialog.querySelectorAll('input, select, textarea')).filter(el=>
    !controls.contains(el)&&el.type!=='file'&&el.type!=='button'&&el.type!=='submit');
  function snapshot(){
    return fields().map(el=>({value:el.value,checked:el.checked}));
  }
  function restore(saved){
    const els=fields();
    if(els.length!==saved.length)throw new Error('The native player form changed while adding copies.');
    els.forEach((el,i)=>{
      const v=saved[i];
      if(el.type==='checkbox'||el.type==='radio')el.checked=v.checked;
      else el.value=v.value;
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
    });
  }
  function nativeSave(){
    const acts=Array.from(buttons.querySelectorAll('button')).filter(b=>b.id!=='vma-run');
    return acts.find(b=>/save|create|add|accept/i.test(b.textContent||''))||
           acts.find(b=>b.classList.contains('primary'))||null;
  }
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function until(predicate,ms=3200){
    const start=Date.now();
    while(Date.now()-start<ms){if(predicate())return true;await sleep(40);}
    return predicate();
  }
  function sendName(v){
    character.value=v;
    character.dispatchEvent(new Event('input',{bubbles:true}));
    character.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function existingNames(){
    // Native J-tool select is a useful collision check when populated. If not
    // populated, VeilCast's own normal validation remains authoritative.
    const sel=document.getElementById('tokenJug');
    return new Set(Array.from(sel?.querySelectorAll('option')||[])
      .map(o=>(o.textContent||'').trim().toLocaleLowerCase()).filter(Boolean));
  }
  run.addEventListener('click',async()=>{
    if(busy||!isOpen())return;
    const base=character.value.trim();
    const amount=Number(count.value);
    if(!base){alert('Enter a Character name first.');character.focus();return;}
    if(!Number.isSafeInteger(amount)||amount<2||amount>30){
      alert('Choose 2 to 30 copies.');count.focus();return;
    }
    const saver=nativeSave();
    if(!saver){report('Cannot locate the original Save button. Nothing created.',true);return;}
    const names=Array.from({length:amount},(_,i)=>(i+1)+' '+base);
    const collisions=names.filter(n=>existingNames().has(n.toLocaleLowerCase()));
    if(collisions.length){
      alert('These characters already exist: '+collisions.join(', ')+'. Rename the base or delete the originals first.');
      return;
    }
    if(!confirm('Create '+amount+' native characters with identical stats?\n\n'+names.join('\n')))return;
    // Snapshot exactly what the DM entered in the normal VeilCast form, not
    // an invented alternate character structure. Each save uses its native UI.
    const initial=snapshot();
    busy=true;run.disabled=true;open.disabled=true;
    let added=0;
    try{
      for(let i=0;i<names.length;i++){
        if(i>0){
          add.click();
          if(!await until(isOpen,1500))throw new Error('Cannot re-open native New Player dialog.');
          bulk=true;update();restore(initial);
        }
        sendName(names[i]);
        const native=nativeSave();
        if(!native)throw new Error('Native Save button disappeared.');
        native.click();
        if(!await until(()=>!isOpen())){
          throw new Error('Native Save did not close the form. Check required fields; stopped before creating further copies.');
        }
        added++;
      }
      report('Created '+added+' characters: '+names[0]+' through '+names[added-1]+'. Place them with J, then exclude monster tokens from fog as needed.');
      bulk=false;update();
    }catch(err){
      report('Created '+added+' of '+amount+' before stopping: '+err.message,true);
      console.error('[VeilCast Multi Add]',err);
      bulk=false;update();
    }finally{busy=false;run.disabled=false;open.disabled=false;}
  });
}
/* END VeilCast Native Campaign Player Multi Add */
