(() => {
  'use strict';
  const KEY = 'ddhub.followups.v1';
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const priorities = {high:'Alta', medium:'Media', low:'Baja'};
  let root, tasks = [], selected = dateKey(new Date()), view = monthStart(new Date()), query = '', filter = 'pending', dialog, form;
  let initialized = false;
  const nodes = {};
  const hub = () => window.Hub;
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (value !== false && value != null) node.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children.flat()) if (child != null) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    return node;
  }
  function dateKey(date) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function fromKey(key) {const [y,m,d] = key.split('-').map(Number); return new Date(y,m-1,d,12);}
  function validDate(s) {return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number(s.slice(0,4)) >= 1900 && Number(s.slice(0,4)) <= 9999 && dateKey(fromKey(s)) === s;}
  function monthStart(date) {return new Date(date.getFullYear(),date.getMonth(),1,12);}
  function readable(key, options) {return fromKey(key).toLocaleDateString('es',options || {weekday:'long',day:'numeric',month:'long'});}
  function uid() {return crypto.randomUUID ? crypto.randomUUID() : `fu-${Date.now()}-${Math.random().toString(36).slice(2)}`;}
  function str(v, max) {return typeof v === 'string' && v.length <= max;}
  function validateTask(t) {
    if (!t || typeof t !== 'object' || Array.isArray(t) || !str(t.id,160) || !t.id || !str(t.merchant,160) || !t.merchant.trim() || !str(t.title,240) || !t.title.trim() || !validDate(t.date) || !str(t.time,5) || (t.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)) || !Object.hasOwn(priorities,t.priority) || !['pending','done'].includes(t.status) || !str(t.notes,20000)) throw new Error('Hay un seguimiento inválido. Revisa merchant, título, fecha, hora, prioridad y estado.');
    return {id:t.id,merchant:t.merchant.trim(),title:t.title.trim(),date:t.date,time:t.time,priority:t.priority,status:t.status,notes:t.notes,createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),updatedAt:typeof t.updatedAt === 'string' ? t.updatedAt : new Date().toISOString()};
  }
  function validated(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.tasks) || data.tasks.length > 10000) throw new Error('Usa una copia JSON de DD Tool Hub (versión 1, máximo 10,000 seguimientos).');
    const seen = new Set();
    return data.tasks.map(t => {const item = validateTask(t); if(seen.has(item.id)) throw new Error('La copia contiene identificadores duplicados.'); seen.add(item.id); return item;});
  }
  function persist(next) {
    if (hub().save(KEY,{version:1,tasks:next}) === false) return false;
    tasks = next;
    render();
    window.dispatchEvent(new CustomEvent('hub-data-changed'));
    return true;
  }
  function stats() {
    const today = dateKey(new Date());
    return {overdue:tasks.filter(t=>t.status==='pending'&&t.date<today).length,today:tasks.filter(t=>t.status==='pending'&&t.date===today).length,upcoming:tasks.filter(t=>t.status==='pending'&&t.date>today).length,completed:tasks.filter(t=>t.status==='done').length,total:tasks.length};
  }
  function matches(t) {return (!query || `${t.merchant} ${t.title} ${t.notes}`.toLocaleLowerCase().includes(query)) && (filter==='all' || (filter==='overdue' ? t.status==='pending'&&t.date<dateKey(new Date()) : t.status===filter));}
  function sort(list) {return [...list].sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'99').localeCompare(b.time||'99')||a.merchant.localeCompare(b.merchant));}
  function toggle(id) {
    const item = tasks.find(t=>t.id===id); if(!item)return;
    if(persist(tasks.map(t=>t.id===id?{...t,status:t.status==='done'?'pending':'done',updatedAt:new Date().toISOString()}:t)))hub().toast(item.status==='done'?'Seguimiento reabierto.':'Seguimiento completado.');
  }
  function remove(id) {
    const item=tasks.find(t=>t.id===id); if(!item || !confirm(`¿Eliminar el seguimiento de ${item.merchant}?`))return;
    if(persist(tasks.filter(t=>t.id!==id))){dialog.close();hub().toast('Seguimiento eliminado.');}
  }
  function taskCard(t, compact=false) {
    const overdue = t.status==='pending'&&t.date<dateKey(new Date());
    const checkbox = el('input',{type:'checkbox','aria-label':`${t.status==='done'?'Reabrir':'Completar'}: ${t.title}`,onchange:()=>toggle(t.id)});checkbox.checked=t.status==='done';
    const body=el('div',{class:'fu-task-copy'},el('strong',{},t.merchant),el('span',{class:'fu-task-title'},t.title),el('div',{class:'fu-task-meta'},el('span',{},`${compact?'':readable(t.date,{day:'numeric',month:'short'})+' · '}${t.time||'Sin hora'}`),el('span',{class:`fu-priority fu-priority-${t.priority}`},priorities[t.priority]),overdue?el('span',{class:'fu-overdue'},'Vencido'):t.status==='done'?el('span',{},'Completado'):null));
    const card=el('article',{class:`fu-task ${t.status==='done'?'fu-done':''}`},checkbox,body,el('button',{class:'btn fu-edit',type:'button','aria-label':`Editar seguimiento de ${t.merchant}`,onclick:()=>openEditor(t)},'Editar'));
    return card;
  }
  function render() {
    if(!root)return;
    const count=stats();
    for(const key of ['overdue','today','upcoming','completed'])nodes[key].textContent=String(count[key]);
    nodes.month.textContent=view.toLocaleDateString('es',{month:'long',year:'numeric'});
    const start = new Date(view);start.setDate(1-((view.getDay()+6)%7));
    const days=[]; const today=dateKey(new Date());
    for(let i=0;i<42;i++) {
      const date=new Date(start);date.setDate(start.getDate()+i);const key=dateKey(date), dayTasks=tasks.filter(t=>t.date===key&&t.status==='pending');
      const label=`${readable(key,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}, ${dayTasks.length} seguimientos pendientes`;
      const btn=el('button',{type:'button',class:`fu-day ${date.getMonth()!==view.getMonth()?'fu-outside':''} ${key===today?'fu-today':''} ${key===selected?'fu-selected':''}`,'aria-label':label,'aria-pressed':String(key===selected),'data-date':key,onclick:()=>{selected=key;view=monthStart(date);render();},onkeydown:e=>calendarKeys(e,key)},el('span',{class:'fu-day-num'},date.getDate()));
      for(const t of dayTasks.slice(0,2))btn.append(el('span',{class:`fu-day-event fu-event-${t.priority}`},t.merchant));
      if(dayTasks.length>2)btn.append(el('span',{class:'fu-day-more'},`+${dayTasks.length-2} más`));
      days.push(btn);
    }
    nodes.grid.replaceChildren(...days);
    nodes.day.textContent=readable(selected);
    const daily=sort(tasks.filter(t=>t.date===selected));
    nodes.agenda.replaceChildren(...(daily.length?daily.map(t=>taskCard(t,true)):[el('div',{class:'fu-empty'},el('span',{class:'fu-empty-symbol'},'✓'),el('strong',{},'Espacio para lo que sigue'),el('p',{class:'muted'},'Este día no tiene seguimientos. Crea uno para organizar tu próxima acción.'))]));
    const filtered=sort(tasks.filter(matches));
    nodes.result.textContent=`${filtered.length} seguimiento${filtered.length===1?'':'s'}`;
    nodes.list.replaceChildren(...(filtered.length?filtered.map(t=>taskCard(t)):[el('div',{class:'fu-empty'},el('strong',{},tasks.length?'Sin coincidencias':'Tu mapa empieza aquí'),el('p',{class:'muted'},tasks.length?'Prueba otro filtro o busca por merchant.':'Agrega un merchant, elige una fecha y define el siguiente paso.'))]));
  }
  function calendarKeys(e,key) {
    const moves={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
    if(!Object.hasOwn(moves,e.key))return;e.preventDefault();
    const date=fromKey(key);date.setDate(date.getDate()+moves[e.key]);selected=dateKey(date);view=monthStart(date);render();nodes.grid.querySelector(`[data-date="${selected}"]`)?.focus();
  }
  function field(label,name,type='text',options={}) {
    const id=`fu-${name}`, input=type==='textarea'?el('textarea',{id,name,rows:4,...options}):type==='select'?el('select',{id,name,...options},...Object.entries(priorities).map(([value,text])=>el('option',{value},text))):el('input',{id,name,type,...options});
    input.className='control';return el('label',{class:'field',for:id},el('span',{},label),input);
  }
  function openEditor(task,detail={}) {
    form.reset();form.elements.id.value=task?.id||'';
    form.elements.merchant.value=task?.merchant||String(detail.merchant||'').slice(0,160);
    form.elements.title.value=task?.title||'Próximo contacto';form.elements.date.value=task?.date||selected;
    form.elements.time.value=task?.time||'';form.elements.priority.value=task?.priority||'medium';form.elements.notes.value=task?.notes||String(detail.notes||'').slice(0,20000);
    form.elements.status.value=task?.status||'pending';
    nodes.dialogTitle.textContent=task?'Editar seguimiento':'Nuevo seguimiento';nodes.delete.hidden=!task;
    dialog.showModal();form.elements.merchant.focus();
  }
  function prefill(detail={}) {if(!root)return;selected=dateKey(new Date());view=monthStart(new Date());render();openEditor(null,detail);}
  function submit(e) {
    e.preventDefault();if(!form.reportValidity())return;
    const raw=Object.fromEntries(new FormData(form)),old=tasks.find(t=>t.id===raw.id),now=new Date().toISOString();
    let item;try{item=validateTask({...raw,id:old?.id||uid(),createdAt:old?.createdAt||now,updatedAt:now});}catch(err){hub().toast(err.message);return;}
    const next=old?tasks.map(t=>t.id===old.id?item:t):[...tasks,item];
    selected=item.date;view=monthStart(fromKey(item.date));
    if(persist(next)){dialog.close();hub().toast(old?'Seguimiento actualizado.':'Seguimiento creado.');}
  }
  function exportJSON(){hub().download(`ddhub-seguimientos-${dateKey(new Date())}.json`,JSON.stringify({version:1,exportedAt:new Date().toISOString(),tasks},null,2),'application/json');}
  async function importJSON(file) {
    if(!file)return;
    try {
      if(file.size>10*1024*1024)throw new Error('La copia supera el máximo de 10 MB.');
      const imported=validated(JSON.parse(await file.text())),merged=new Map(tasks.map(t=>[t.id,t]));
      if(!imported.length){hub().toast('La copia no contiene seguimientos.');return;}
      const overlaps=imported.filter(t=>merged.has(t.id)).length;
      if(overlaps&&!confirm(`Se actualizarán ${overlaps} seguimientos existentes y se agregarán ${imported.length-overlaps}. ¿Importar esta copia?`))return;
      for(const item of imported)merged.set(item.id,item);
      if(merged.size>10000)throw new Error('La combinación supera 10,000 seguimientos.');
      if(persist([...merged.values()]))hub().toast(`${imported.length} seguimientos importados.`);
    }catch(err){hub().toast(err instanceof SyntaxError?'El archivo no contiene JSON válido.':err.message);}
    finally{nodes.import.value='';}
  }
  function icsEscape(value){return String(value).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
  function fold(line) {
    const encoder=new TextEncoder();let chunks=[],chunk='',bytes=0;
    for(const char of line){const n=encoder.encode(char).length;if(bytes+n>75){chunks.push(chunk);chunk=' ';bytes=1;}chunk+=char;bytes+=n;}chunks.push(chunk);return chunks.join('\r\n');
  }
  function exportICS() {
    const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DD Tool Hub//Follow Up Map//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:DD Tool Hub · Seguimientos'];
    for(const t of sort(tasks)) {
      lines.push('BEGIN:VEVENT',`UID:${encodeURIComponent(t.id)}@ddtoolhub.local`,`DTSTAMP:${stamp}`);
      const date=t.date.replace(/-/g,'');
      if(t.time){lines.push(`DTSTART:${date}T${t.time.replace(':','')}00`,'DURATION:PT30M');}
      else{const next=fromKey(t.date);next.setDate(next.getDate()+1);lines.push(`DTSTART;VALUE=DATE:${date}`,`DTEND;VALUE=DATE:${dateKey(next).replace(/-/g,'')}`);}
      lines.push(`SUMMARY:${icsEscape(t.merchant+' · '+t.title)}`,`DESCRIPTION:${icsEscape(`${t.notes}\nPrioridad: ${priorities[t.priority]}\nEstado: ${t.status==='done'?'Completado':'Pendiente'}`)}`,`PRIORITY:${t.priority==='high'?1:t.priority==='medium'?5:9}`,'STATUS:CONFIRMED','TRANSP:TRANSPARENT','END:VEVENT');
    }
    lines.push('END:VCALENDAR');hub().download(`ddhub-calendario-${dateKey(new Date())}.ics`,lines.map(fold).join('\r\n')+'\r\n','text/calendar;charset=utf-8');
  }
  function init(container) {
    if(initialized)return;initialized=true;root=container;
    try {const data=hub().load(KEY,{version:1,tasks:[]});tasks=validated(data);}catch(err){hub().toast('No se pudo leer la copia de seguimientos guardada. El archivo original permanece sin cambios.');tasks=[];}
    const metricLabels={overdue:'Vencidos',today:'Para hoy',upcoming:'Próximos',completed:'Completados'};
    const metrics=el('div',{class:'fu-metrics'},...Object.entries(metricLabels).map(([key,label])=>{nodes[key]=el('strong',{},'0');return el('div',{class:`card fu-metric fu-metric-${key}`},el('span',{class:'muted'},label),nodes[key]);}));
    nodes.month=el('h3',{id:'fu-month'});nodes.grid=el('div',{class:'fu-grid','aria-labelledby':'fu-month'});
    const calendar=el('section',{class:'card fu-calendar'},el('div',{class:'fu-calendar-top'},nodes.month,el('div',{class:'toolbar'},el('button',{class:'btn',type:'button','aria-label':'Mes anterior',onclick:()=>{view=new Date(view.getFullYear(),view.getMonth()-1,1,12);render();}},'←'),el('button',{class:'btn',type:'button',onclick:()=>{selected=dateKey(new Date());view=monthStart(new Date());render();}},'Hoy'),el('button',{class:'btn',type:'button','aria-label':'Mes siguiente',onclick:()=>{view=new Date(view.getFullYear(),view.getMonth()+1,1,12);render();}},'→'))),el('div',{class:'fu-weekdays','aria-hidden':'true'},...dayNames.map(d=>el('span',{},d))),nodes.grid,el('p',{class:'muted fu-calendar-help'},'Elige un día para ver su agenda. Usa las flechas del teclado para moverte.'));
    nodes.day=el('h3');nodes.agenda=el('div',{class:'fu-agenda-list'});
    const agenda=el('section',{class:'card fu-agenda'},el('div',{class:'fu-agenda-top'},el('div',{},el('span',{class:'fu-overline'},'AGENDA DEL DÍA'),nodes.day),el('button',{class:'btn primary',type:'button',onclick:()=>openEditor()},'+ Agregar')),nodes.agenda);
    nodes.result=el('span',{class:'muted'});nodes.list=el('div',{class:'fu-task-list'});
    const search=el('input',{class:'control',type:'search',placeholder:'Buscar merchant o próximo paso…','aria-label':'Buscar seguimientos',oninput:e=>{query=e.target.value.trim().toLocaleLowerCase();render();}});
    const select=el('select',{class:'control','aria-label':'Filtrar seguimientos',onchange:e=>{filter=e.target.value;render();}},el('option',{value:'pending'},'Pendientes'),el('option',{value:'overdue'},'Vencidos'),el('option',{value:'done'},'Completados'),el('option',{value:'all'},'Todos'));
    nodes.import=el('input',{type:'file',accept:'.json,application/json',hidden:true,'aria-label':'Importar copia de seguimientos',onchange:e=>importJSON(e.target.files[0])});
    const list=el('section',{class:'card fu-map'},el('div',{class:'fu-map-top'},el('div',{},el('h3',{},'Tu mapa de seguimientos'),nodes.result),el('div',{class:'fu-filter-bar'},search,select)),nodes.list);
    const exportBar=el('div',{class:'fu-export-bar'},el('p',{class:'muted'},'Los seguimientos se guardan en este navegador. Exporta una copia para conservarlos o llevarlos a otro equipo.'),el('div',{class:'toolbar'},el('button',{class:'btn',type:'button',onclick:exportJSON},'Exportar JSON'),el('button',{class:'btn',type:'button',onclick:()=>nodes.import.click()},'Importar copia'),el('button',{class:'btn',type:'button',onclick:exportICS},'Exportar calendario .ics')),nodes.import);
    dialog=el('dialog',{class:'fu-dialog','aria-labelledby':'fu-dialog-title'});nodes.dialogTitle=el('h2',{id:'fu-dialog-title'});
    form=el('form',{class:'fu-form',onsubmit:submit},el('input',{name:'id',type:'hidden'}),field('Merchant *','merchant','text',{required:true,maxlength:160,autocomplete:'organization'}),field('Próximo paso *','title','text',{required:true,maxlength:240}),el('div',{class:'fu-form-row'},field('Fecha *','date','date',{required:true,min:'1900-01-01',max:'9999-12-31'}),field('Hora (opcional)','time','time')),el('div',{class:'fu-form-row'},field('Prioridad','priority','select'),el('label',{class:'field',for:'fu-status'},el('span',{},'Estado'),el('select',{class:'control',id:'fu-status',name:'status'},el('option',{value:'pending'},'Pendiente'),el('option',{value:'done'},'Completado')))),field('Notas / contexto','notes','textarea',{maxlength:20000}));
    nodes.delete=el('button',{class:'btn fu-delete',type:'button',onclick:()=>remove(form.elements.id.value)},'Eliminar');
    form.append(el('div',{class:'fu-form-actions'},nodes.delete,el('button',{class:'btn',type:'button',onclick:()=>dialog.close()},'Cancelar'),el('button',{class:'btn primary',type:'submit'},'Guardar seguimiento')));
    dialog.append(el('div',{class:'fu-dialog-heading'},nodes.dialogTitle,el('button',{class:'btn',type:'button','aria-label':'Cerrar editor',onclick:()=>dialog.close()},'×')),form);
    root.replaceChildren(metrics,el('div',{class:'fu-layout'},calendar,agenda),list,exportBar,dialog);root.classList.add('fu-root');render();
    window.addEventListener('hub-followup',e=>prefill(e.detail));
    window.addEventListener('storage',e=>{if(e.key!==KEY)return;try{tasks=validated(e.newValue?JSON.parse(e.newValue):{version:1,tasks:[]});render();window.dispatchEvent(new CustomEvent('hub-data-changed'));}catch{hub().toast('La actualización desde otra pestaña no es válida.');}});
  }
  window.Followups={init,prefill,stats};
})();
