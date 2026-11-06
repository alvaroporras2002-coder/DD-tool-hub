/* DD Tool Hub — local, dependency-free workspace. */
(() => {
'use strict';
let toastTimer;
const localDay = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
window.Hub = {
 load(key,fallback){try{const value=localStorage.getItem(key);return value===null?fallback:JSON.parse(value);}catch{this.toast('No se pudieron leer los datos guardados. Revisa la configuración del navegador.');return fallback;}},
 save(key,value){try{localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new Event('hub-data-changed'));return true;}catch{this.toast('No se pudo guardar. Exporta un respaldo y revisa el espacio del navegador.');return false;}},
 toast(message){const el=document.getElementById('toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},5000);},
 escape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
 download(name,text,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
};
const $=s=>document.querySelector(s), esc=Hub.escape;
let active='home'; let dttStats=null;
function navigate(){let name=location.hash.slice(1);if(!['home','dtt','video','notes','followups'].includes(name))name='home';if(active==='video'&&name!=='video')$('#videoFrame').contentWindow?.postMessage({type:'ddhub-pause'},location.origin);active=name;document.querySelectorAll('[data-view]').forEach(el=>{el.hidden=el.dataset.view!==name;});document.querySelectorAll('[data-nav]').forEach(el=>{if(el.dataset.nav===name)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});if(name==='dtt'||name==='video'){const frame=$(`#${name}Frame`);if(!frame.getAttribute('src'))frame.src=frame.dataset.src;}if(name==='home')renderHome();document.title=`${{home:'Tu espacio de trabajo',dtt:'DTT Tracker',video:'Video Studio',notes:'Call Notes',followups:'Follow-up Map'}[name]} · DD Tool Hub`;}
function readTasks(){const raw=Hub.load('ddhub.followups.v1',[]);return Array.isArray(raw)?raw:Array.isArray(raw?.tasks)?raw.tasks:Array.isArray(raw?.items)?raw.items:[];}
function renderHome(){
 const day=localDay(),now=new Date();
 $('#todayLabel').textContent=now.toLocaleDateString('es-CR',{weekday:'long',day:'numeric',month:'long'});
 const tasks=readTasks(),pending=tasks.filter(t=>t.status!=='completed'&&t.status!=='done'&&!t.completed);
 const stats={today:pending.filter(t=>t.date===day).length,overdue:pending.filter(t=>t.date<day).length,upcoming:pending.filter(t=>t.date>day).length};
 $('#homeDue').textContent=String(stats.today);$('#homeOverdue').textContent=String(stats.overdue);$('#homeUpcoming').textContent=String(stats.upcoming);
 const m=now.getMonth(),year=now.getFullYear(),count=new Date(year,m+1,0).getDate(),offset=(new Date(year,m,1).getDay()+6)%7;
 let calendar=`<div class="mini-calendar-heading">${esc(now.toLocaleDateString('es-CR',{month:'long'}))} ${year}<span>‹ &nbsp; ›</span></div><div class="mini-calendar-grid">${['L','M','M','J','V','S','D'].map(x=>`<span class="weekday">${x}</span>`).join('')}${'<span></span>'.repeat(offset)}`;
 for(let d=1;d<=count;d++){const key=`${year}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;calendar+=`<span class="${key===day?'is-today ':''}${pending.some(t=>t.date===key)?'has-task':''}">${d}</span>`;}$('#homeCalendar').innerHTML=calendar+'</div>';
 const next=pending.slice().sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))).slice(0,3);
 $('#homeAgenda').innerHTML=next.length?next.map(t=>`<a class="home-agenda-item" href="#followups"><span class="agenda-date">${esc((t.date||'').slice(8))} / ${esc((t.date||'').slice(5,7))}</span><div><strong>${esc(t.merchant||t.title||'Seguimiento')}</strong><p>${esc(t.title||t.notes||'Próximo paso')} ${t.time?' · '+esc(t.time):''}</p></div><span class="agenda-pill ${t.date<day?'overdue':''}">${t.date<day?'Vencido':t.date===day?'Hoy':'Próximo'}</span></a>`).join(''):`<div class="agenda-empty"><span>☀</span><div><strong>Espacio para lo que viene.</strong>Agenda tu primer seguimiento desde el calendario.</div></div>`;
 updateDttCard();
}
function updateDttCard(){const saved=Hub.load('ddhub.dtt.v1',{}),d=saved?.days?.[localDay()];if(d)dttStats={day:localDay(),totalSeconds:(d.csvBaseSeconds||0)+(d.csvBonusSeconds||0)+(d.manualEntries||[]).reduce((n,e)=>n+(e.seconds||0),0),validCalls:d.csvValidCalls||0,goalMinutes:d.goalMinutes||70};if(!dttStats||dttStats.day!==localDay())dttStats={day:localDay(),totalSeconds:0,validCalls:0,goalMinutes:70};const s=Math.max(0,Math.round(dttStats.totalSeconds||0));$('#homeDtt').textContent=[Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,'0')).join(':');$('#homeDttCalls').textContent=`${dttStats.validCalls||0} llamadas completadas`;$('#homeDttGoal').textContent=`Meta: ${dttStats.goalMinutes||70} min`;$('#homeDttBar').style.width=Math.min(100,s/((dttStats.goalMinutes||70)*60)*100)+'%';}
window.addEventListener('message',e=>{if(e.origin!==location.origin)return;if(e.source===$('#dttFrame').contentWindow&&e.data?.type==='ddhub-dtt-stats'){dttStats=e.data;updateDttCard();}if(e.source===$('#dttFrame').contentWindow&&e.data?.type==='ddhub-dtt-height'&&Number.isFinite(e.data.height))$('#dttFrame').style.height=Math.min(6000,Math.max(600,e.data.height))+'px';});
window.addEventListener('hashchange',navigate);
window.addEventListener('hub-data-changed',()=>{if(active==='home')renderHome();});
window.addEventListener('hub-followup',e=>{location.hash='followups';navigate();});
window.addEventListener('storage',()=>{if(active==='home')renderHome();});
$('#guideButton').addEventListener('click',()=>$('#guideDialog').showModal());$('#closeGuide').addEventListener('click',()=>$('#guideDialog').close());$('#guideDialog').addEventListener('click',e=>{if(e.target===$('#guideDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('#backupButton').addEventListener('click',()=>{const keys=['ddhub.notes.v1','ddhub.followups.v1','ddhub.dtt.v1'];const data={format:'dd-tool-hub',version:1,exported:new Date().toISOString(),data:Object.fromEntries(keys.map(k=>[k,Hub.load(k,null)]))};Hub.download(`dd-tool-hub-${localDay()}.json`,JSON.stringify(data,null,2),'application/json');Hub.toast('Respaldo descargado. Los videos se respaldan desde Video Studio.');});
function validBackup(data){
 if(!data||data.format!=='dd-tool-hub'||data.version!==1||!data.data||Array.isArray(data.data))throw Error('Elige un respaldo JSON exportado desde DD Tool Hub.');
 const out={};const isObject=x=>!!x&&typeof x==='object'&&!Array.isArray(x),text=(x,n)=>typeof x==='string'&&x.length<=n,num=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
 for(const key of ['ddhub.notes.v1','ddhub.followups.v1','ddhub.dtt.v1']){
  const value=data.data[key];if(value===null){out[key]=null;continue;}if(!isObject(value))throw Error('El respaldo está incompleto.');
  if(key==='ddhub.followups.v1'){
   if(value.version!==1||!Array.isArray(value.tasks)||value.tasks.length>10000)throw Error('Los seguimientos del respaldo no son válidos.');
   const ids=new Set();for(const t of value.tasks){if(!isObject(t)||!text(t.id,160)||!t.id||ids.has(t.id)||!text(t.merchant,160)||!t.merchant.trim()||!text(t.title,240)||!t.title.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||!text(t.time,5)||(t.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time))||!['high','medium','low'].includes(t.priority)||!['pending','done'].includes(t.status)||!text(t.notes,20000))throw Error('Hay un seguimiento inválido en el respaldo.');const [y,m,d]=t.date.split('-').map(Number),dt=new Date(y,m-1,d,12);if(y<1900||y>9999||dt.getFullYear()!==y||dt.getMonth()!==m-1||dt.getDate()!==d)throw Error('Hay una fecha inválida en el respaldo.');ids.add(t.id);}
  }
  if(key==='ddhub.notes.v1'){
   if(!isObject(value.draft)||!Array.isArray(value.history)||value.history.length>200)throw Error('Las notas del respaldo no son válidas.');
   for(const n of [value.draft,...value.history]){if(!isObject(n)||!isObject(n.answers)||!['id','merchant','caseId','updated'].every(k=>text(n[k],500))||!text(n.details,30000))throw Error('Hay una nota inválida en el respaldo.');for(const [key,,options]of Notes.questions)if(n.answers[key]&&!options.some(o=>o[0]===n.answers[key]))throw Error('Hay una respuesta desconocida en el respaldo.');}
  }
  if(key==='ddhub.dtt.v1'){
   if(value.version!==1||!isObject(value.days)||Object.keys(value.days).length>10000)throw Error('El registro DTT del respaldo no es válido.');
   for(const [day,d]of Object.entries(value.days)){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!isObject(d)||!['csvBaseSeconds','csvBonusSeconds','csvValidCalls','csvValidBaseSeconds','csvTimedCalls','csvRows'].every(k=>num(d[k]))||!num(d.goalMinutes)||d.goalMinutes<1||!text(d.lastFileName,1000)||!text(d.lastDropTime,100)||!Array.isArray(d.manualEntries)||d.manualEntries.length>10000||!d.manualEntries.every(e=>isObject(e)&&text(e.id,160)&&num(e.seconds)))throw Error('Hay un día DTT inválido en el respaldo.');}
  }
  out[key]=value;
 }
 return out;
}
$('#restoreButton').addEventListener('click',()=>$('#restoreFile').click());
$('#restoreFile').addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
  if(file.size>20*1024*1024)throw Error('El respaldo supera 20 MB.');
  const data=validBackup(JSON.parse(await file.text()));
  if(!confirm('¿Restaurar este respaldo? Reemplazará las notas, los seguimientos y el DTT de este navegador. Los proyectos de video conservan su propio guardado.'))return;
  const before=Object.fromEntries(Object.keys(data).map(k=>[k,localStorage.getItem(k)]));
  try{for(const [k,v]of Object.entries(data)){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v));}}
  catch(err){for(const [k,v]of Object.entries(before)){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch{}}throw Error('No hay espacio para restaurar el respaldo. Tus datos anteriores se han conservado.');}
  location.reload();
 }catch(err){Hub.toast(err instanceof SyntaxError?'El archivo no contiene JSON válido.':err.message);}
 finally{e.target.value='';}
});
Notes.init($('#notesRoot'));Followups.init($('#followupsRoot'));navigate();
})();
