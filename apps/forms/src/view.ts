/// <reference lib="dom" />
// Self-contained browser code: each function is serialized after TypeScript
// compilation and executed in Chest's sandbox or under this tool's own host.
// No imports: the server validates every operation, these checks only keep
// the display coherent. All received text is written with textContent.
type Chest = { invoke: (operation: string, input?: unknown) => Promise<unknown>; publicEntry: string };

function member(chest: Chest, canPublish: boolean): void {
 type Field = { name: string; label: string; required: boolean };
 type State = { definition: { title: string; description: string; fields: Field[] }; status: 'draft'|'open'|'closed'|'public'; responses: { at: string; answers: Record<string, string> }[] };
 const root=document.querySelector<HTMLElement>('#forms')!;
 const notice=document.querySelector<HTMLElement>('#notice')!;
 let busy=false,uncertain=false;
 function node<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className=''):HTMLElementTagNameMap[K]{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;}
 function say(text:string,error=false):void{notice.textContent=text;notice.className=error?'error':'';}
 function lock():void{for(const el of root.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLTextAreaElement>('button,input,textarea'))el.disabled=busy||uncertain;root.setAttribute('aria-busy',String(busy));}
 function run(action:()=>Promise<void>):void{
  if(busy||uncertain)return;
  busy=true;say('');lock();
  void action().catch((error:unknown)=>{
   const code=error instanceof Error?error.message:'';
   if(code==='Chest 400')say('Vérifiez les champs : certaines valeurs ne sont pas valides.',true);
   else if(code==='Chest 409')say('Les données ont changé. Actualisez l’état avant de continuer.',true);
   else if(code==='Chest 413')say('La limite de cet outil est atteinte. La dernière écriture a été refusée.',true);
   else if(code==='Chest 429')say('L’outil est occupé ou sa limite de réponses est atteinte.',true);
   else{uncertain=true;say('Résultat non confirmé. Actualisez l’état avant toute nouvelle action ; ne renvoyez pas votre réponse sans vérifier si elle est déjà enregistrée.',true);}
  }).finally(()=>{busy=false;lock();});
 }
 function button(label:string,action:()=>Promise<void>,className=''):HTMLButtonElement{const b=node('button',label,className);b.type='button';b.onclick=()=>run(action);return b;}
 // A sandboxed frame never dispatches form submission: the button carries the
 // action, and the submit event (Enter, on the tool's own host) joins it.
 function sends(form:HTMLFormElement,send:HTMLButtonElement,action:()=>Promise<void>):void{
  const go=():void=>{if(form.reportValidity())run(action);};
  send.type='button';send.onclick=go;form.onsubmit=event=>{event.preventDefault();go();};
 }
 function labeled(parent:HTMLElement,text:string,control:HTMLElement):void{const label=node('label',text);label.append(control);parent.append(label);}
 // A sandboxed frame has no modal dialogs: confirmation happens in the page.
 function confirmed(label:string,question:string,className:string,action:()=>Promise<void>):HTMLElement{
  const box=node('div','','confirm');
  const ask=node('button',label,className);ask.type='button';
  ask.onclick=()=>{
   if(busy||uncertain)return;
   const cancel=node('button','Annuler','quiet');cancel.type='button';cancel.onclick=()=>box.replaceChildren(ask);
   box.replaceChildren(node('p',question),button('Confirmer',action,className),cancel);
  };
  box.append(ask);return box;
 }
 function text(value:unknown,max:number):value is string{return typeof value==='string'&&value.length<=max;}
 function state(raw:unknown):State|null{
  if(raw===null)return null;
  const v=raw as State;
  if(!v||typeof v!=='object'||!v.definition||typeof v.definition!=='object'||!text(v.definition.title,80)||!text(v.definition.description,160)||!Array.isArray(v.definition.fields)||v.definition.fields.length<1||v.definition.fields.length>4||!['draft','open','closed','public'].includes(v.status)||!Array.isArray(v.responses)||v.responses.length>10)throw new Error('Invalid state');
  if(v.definition.fields.some(f=>!f||!text(f.name,24)||!text(f.label,60)||typeof f.required!=='boolean'))throw new Error('Invalid state');
  if(v.responses.some(r=>!r||!text(r.at,24)||!r.answers||typeof r.answers!=='object'||Object.values(r.answers).some(a=>!text(a,240))))throw new Error('Invalid state');
  return v;
 }
 function creation():HTMLElement{
  const grid=node('div','','grid');
  const form=node('form','','card');
  form.append(node('span','01 / VOTRE PREMIER FORMULAIRE','step'),node('h2','Qu’aimeriez-vous savoir ?'));
  const title=node('input');title.type='text';title.maxLength=80;title.required=true;title.placeholder='Ex. Demande de contact';
  const description=node('textarea');description.maxLength=160;description.placeholder='Quelques mots pour guider les réponses.';
  labeled(form,'Titre du formulaire',title);labeled(form,'Description · facultatif',description);
  const fields=node('div');form.append(fields);
  const rows:{label:HTMLInputElement;required:HTMLInputElement}[]=[];
  function addField():void{
   const group=node('fieldset');group.append(node('legend','QUESTION '+(rows.length+1)));
   const label=node('input');label.type='text';label.maxLength=60;label.required=true;label.placeholder='Ex. Votre message';labeled(group,'Intitulé',label);
   const required=node('input');required.type='checkbox';required.checked=true;
   const check=node('label','','checkbox');check.append(required,document.createTextNode('Réponse obligatoire'));group.append(check);
   rows.push({label,required});fields.append(group);
  }
  addField();
  const add=node('button','+ Ajouter une question','quiet');add.type='button';
  add.onclick=()=>{if(rows.length<4)addField();add.hidden=rows.length>=4;};
  const save=node('button','Enregistrer le brouillon');
  const actions=node('div','','actions');actions.append(add,save);form.append(actions);
  sends(form,save,async()=>{
   await chest.invoke('create',{title:title.value,description:description.value,fields:rows.map((row,i)=>({name:'question_'+(i+1),label:row.label.value,required:row.required.checked}))});
   await render();say('Brouillon enregistré. La collecte est encore fermée.');
  });
  const aside=node('aside','','card');
  aside.append(node('span','EN TOUTE SIMPLICITÉ','step'),node('h2','Préparez. Ouvrez. Recueillez.'),node('p','Votre brouillon reste dans votre équipe. L’ouverture de la collecte demande une action explicite et les droits nécessaires.'),node('p','Ouvrez d’abord la collecte pour votre équipe. Vous pourrez ensuite activer explicitement un lien de réponse sans compte si cette entrée est autorisée.','muted'));
  grid.append(form,aside);return grid;
 }
 function shown(current:State):HTMLElement{
  const section=node('div');
  const summary=node('section','','card');
  const head=node('div','','card-head');head.append(node('span','VOTRE FORMULAIRE','step'),node('span',{draft:'Brouillon',open:'Collecte ouverte',closed:'Collecte fermée',public:'Collecte publique'}[current.status],'badge'));
  summary.append(head,node('h2',current.definition.title),node('p',current.definition.description));
  summary.append(node('p',current.status==='public'?'Toute personne disposant du lien peut répondre sans compte. La gestion et les réponses restent privées.':'Collecte réservée aux membres autorisés, ou fermée.','muted'));
  if(current.status==='public'&&chest.publicEntry){
   const link=node('input');link.type='text';link.readOnly=true;link.value=chest.publicEntry;link.onfocus=()=>link.select();
   labeled(summary,'Lien de réponse à partager',link);
  }
  const actions=node('div','','actions');
  if(canPublish&&current.status!=='closed'){
   const opening=current.status==='draft';
   actions.append(confirmed(opening?'Ouvrir la collecte':'Fermer la collecte',opening?'Ouvrir la collecte pour les membres autorisés ? Aucun accès public ne sera créé.':'Fermer la collecte ? Les réponses existantes seront conservées.',opening?'':'danger',async()=>{
    await chest.invoke(opening?'publish':'close');await render();say(opening?'La collecte est ouverte.':'La collecte est fermée.');
   }));
  } else if(!canPublish&&current.status!=='closed')summary.append(node('p','Votre accès ne permet pas d’ouvrir ou de fermer la collecte.','muted'));
  if(canPublish&&chest.publicEntry&&current.status==='open')actions.append(confirmed('Activer le lien public','Rendre les questions publiques et autoriser toute personne disposant du lien à répondre sans compte ? La gestion et les réponses restent privées.','',async()=>{
   await chest.invoke('share');await render();say('Le lien public est activé.');
  }));
  summary.append(actions);section.append(summary);
  if(current.status==='draft'){
   const preview=node('section','','card');preview.append(node('h3','Aperçu des questions'));
   for(const field of current.definition.fields)preview.append(node('p',field.label+(field.required?' · obligatoire':'')));
   section.append(preview);
  }
  if(current.status==='open'||current.status==='public'){
   const form=node('form','','card');form.append(node('h3','Envoyer une réponse'));
   const controls=new Map<string,HTMLTextAreaElement>();
   for(const field of current.definition.fields){const area=node('textarea');area.maxLength=240;area.required=field.required;labeled(form,field.label+(field.required?' *':''),area);controls.set(field.name,area);}
   const send=node('button','Envoyer la réponse');const sending=node('div','','actions');sending.append(send);form.append(sending);
   sends(form,send,async()=>{
    await chest.invoke('submit',Object.fromEntries([...controls].map(([name,area])=>[name,area.value])));await render();say('Votre réponse a été enregistrée.');
   });
   section.append(form);
  }
  const responses=node('section','','card');responses.append(node('span','RÉPONSES RECUEILLIES','step'),node('p',String(current.responses.length),'metric'));
  if(!current.responses.length)responses.append(node('p','Les réponses apparaîtront ici.','empty'));
  else{
   const wrap=node('div','','table-wrap');const table=node('table');const header=node('tr');
   header.append(node('th','Date'));for(const field of current.definition.fields)header.append(node('th',field.label));
   const thead=node('thead');thead.append(header);const tbody=node('tbody');
   for(const response of current.responses){const row=node('tr');row.append(node('td',new Date(response.at).toLocaleString('fr-FR')));for(const field of current.definition.fields)row.append(node('td',response.answers[field.name]??''));tbody.append(row);}
   table.append(thead,tbody);wrap.append(table);responses.append(wrap);
  }
  section.append(responses);return section;
 }
 async function render():Promise<void>{
  const current=state(await chest.invoke('snapshot'));
  root.replaceChildren(current===null?creation():shown(current));
 }
 void render().catch(()=>{say('Formulaires est indisponible. Actualisez l’état pour vérifier votre accès.',true);});
}

function visitor(chest: Chest): void {
 const root=document.querySelector<HTMLElement>('#forms')!;
 const notice=document.querySelector<HTMLElement>('#notice')!;
 function node<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className=''):HTMLElementTagNameMap[K]{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;}
 function text(value:unknown,max:number):value is string{return typeof value==='string'&&value.length<=max;}
 async function load():Promise<void>{
  const raw=await chest.invoke('public-form') as {title:unknown;description:unknown;fields:unknown};
  if(!raw||typeof raw!=='object'||!text(raw.title,80)||!text(raw.description,160)||!Array.isArray(raw.fields)||raw.fields.length<1||raw.fields.length>4)throw new Error('Invalid form');
  const fields=raw.fields as {name:string;label:string;required:boolean}[];
  if(fields.some(f=>!f||!text(f.name,24)||!text(f.label,60)||typeof f.required!=='boolean'))throw new Error('Invalid form');
  const form=node('form','','card');
  form.append(node('h2',raw.title),node('p',raw.description));
  const controls=new Map<string,HTMLTextAreaElement>();
  for(const field of fields){const label=node('label',field.label+(field.required?' *':''));const area=node('textarea');area.maxLength=240;area.required=field.required;label.append(area);form.append(label);controls.set(field.name,area);}
  const send=node('button','Envoyer la réponse');send.type='button';const actions=node('div','','actions');actions.append(send);form.append(actions);
  let sending=false;
  // A sandboxed frame never dispatches form submission: the button carries the action.
  form.onsubmit=event=>{event.preventDefault();send.click();};
  send.onclick=()=>{
   if(sending||!form.reportValidity())return;
   sending=true;send.disabled=true;notice.textContent='Envoi en cours…';
   chest.invoke('public-submit',Object.fromEntries([...controls].map(([name,area])=>[name,area.value]))).then(()=>{
    root.replaceChildren();notice.textContent='Merci, votre réponse a été enregistrée.';
   }).catch((error:unknown)=>{
    const code=error instanceof Error?error.message:'';
    if(code==='Chest 400'){notice.textContent='Vérifiez vos réponses.';sending=false;send.disabled=false;return;}
    root.replaceChildren();
    // No retry after an unconfirmed write: it may already be committed.
    notice.textContent=['Chest 403','Chest 404','Chest 413','Chest 429'].includes(code)?'L’envoi a été refusé. Ce formulaire est indisponible ou sa limite est atteinte.':'Enregistrement non confirmé. Ne renvoyez pas votre réponse ; contactez l’équipe qui vous a partagé ce formulaire.';
   });
  };
  notice.textContent='';root.replaceChildren(form);
 }
 void load().catch(()=>{notice.textContent='Ce formulaire n’est pas disponible pour le moment.';});
}

// System fonts only: the isolated document cannot load any external resource.
const css='*{box-sizing:border-box}body{margin:0;color:#212833;background:#fffdfa;font:16px/1.5 Arial,sans-serif}main{padding:4px}h1{font:400 38px/1.15 Georgia,serif;letter-spacing:-1px;margin:0 0 10px}h2{font-size:24px;letter-spacing:-.5px;margin:8px 0 14px}h3{font-size:17px;margin:0 0 16px}p{color:#596273;overflow-wrap:anywhere}.lead{margin:0 0 28px}.step{display:block;font-size:11px;font-weight:700;letter-spacing:1.6px;color:#596273}.card{padding:28px;border:1px solid #dedbd5;margin:0 0 20px}.grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(220px,1fr);gap:24px}.card-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.badge{background:#f3ede6;padding:6px 12px;font-size:12px;white-space:nowrap}button{font:inherit;font-size:14px;font-weight:700;border:1px solid transparent;border-radius:8px;padding:11px 18px;min-height:44px;background:#212833;color:#fffdfa;cursor:pointer}button:hover{background:#364050}button:disabled{opacity:.5;cursor:not-allowed}.quiet{background:transparent;color:#212833;border-color:#818ba3}.quiet:hover{background:#f3ede6}.danger{background:#813c32}.danger:hover{background:#633027}.actions,.confirm{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.actions{margin-top:24px}.confirm p{flex-basis:100%;margin:0;color:#212833}label{display:block;font-size:13px;font-weight:700;margin:18px 0 7px}input:not([type=checkbox]),textarea{display:block;width:100%;margin-top:7px;padding:11px 12px;background:#fffdfa;border:1px solid #818ba3;border-radius:8px;font:inherit;font-size:14px;color:#212833;min-height:44px}textarea{min-height:80px;resize:vertical}input[type=checkbox]{accent-color:#212833}.checkbox{display:flex;gap:8px;align-items:center;font-weight:400;margin:8px 0}fieldset{border:0;border-top:1px solid #dedbd5;padding:8px 0 12px;margin:22px 0 0;min-width:0}legend{font-size:12px;color:#596273;padding-right:10px}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #004eca;outline-offset:3px}.muted{font-size:13px}.empty{padding:22px 0;text-align:center}.metric{font-size:42px;letter-spacing:-2px;color:#212833;margin:0}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;color:#596273}th,td{padding:14px 12px;border-bottom:1px solid #dedbd5;vertical-align:top;max-width:280px;overflow-wrap:anywhere;white-space:pre-wrap}#notice{padding:12px 0;white-space:pre-wrap}#notice.error{color:#813c32}#notice:empty{display:none}[hidden]{display:none!important}@media(max-width:700px){.grid{grid-template-columns:1fr}.card{padding:20px}.actions button{flex:1}}';

export type View = { html: string; css: string; script: string };
// The publish right only adapts the display; the service checks it on every call.
export function memberView(canPublish: boolean): View {
 return { html:'<main><p id="notice" role="status" aria-live="polite"></p><div id="forms"></div></main>', css, script:'('+member.toString()+')(window.chest,'+String(canPublish)+');' };
}
export function visitorView(): View {
 return { html:'<main><h1>À vous la parole.</h1><p class="lead">Votre réponse sera visible par l’équipe qui gère ce formulaire.</p><p id="notice" role="status" aria-live="polite">Chargement du formulaire…</p><div id="forms"></div></main>', css, script:'('+visitor.toString()+')(window.chest);' };
}
