const fs=require('fs'),vm=require('vm'),assert=require('assert');
require(process.env.TEST_DOM_LIBRARY || 'basichtml');
const w=basicHTML.init({window:{}}),D=w.document,storage={},downloads=[];
const proto=basicHTML.HTMLElement.prototype;
function matches(node,sel){const attr=[...sel.matchAll(/\[([^=\]]+)(?:=["']?([^"'\]]*)["']?)?\]/g)];const base=sel.replace(/\[[^\]]*\]/g,'');return node.nodeType===1&&(!base||base==='*'||(base[0]==='#'?node.id===base.slice(1):base[0]==='.'?node.classList.contains(base.slice(1)):node.nodeName.toLowerCase()===base.toLowerCase()))&&attr.every(m=>node.hasAttribute(m[1])&&(m[2]===undefined||node.getAttribute(m[1])===m[2]));}
function qsa(sel){const parts=sel.trim().split(/\s+/),out=[];function visit(n){for(const c of n.childNodes||[]){if(matches(c,parts.at(-1))){let a=c.parentNode,i=parts.length-2;while(i>=0&&a){if(matches(a,parts[i]))i--;a=a.parentNode;}if(i<0)out.push(c);}visit(c);}}visit(this);return out;}
for(const p of [basicHTML.Element.prototype,basicHTML.Document.prototype]){p.querySelectorAll=qsa;p.querySelector=function(s){return this.querySelectorAll(s)[0]||null};}
proto.matches=function(s){return matches(this,s)};
proto.closest=function(s){for(let n=this;n;n=n.parentNode)if(matches(n,s))return n;return null};

proto.replaceChildren=function(...nodes){this.innerHTML='';this.append(...nodes)};
class TestEvent{constructor(type,options={}){this.type=type;Object.assign(this,options)}preventDefault(){}stopPropagation(){}}
for(const p of [proto,w,D]){p.addEventListener=function(t,f){((this.__listeners??={})[t]??=[]).push(f)};p.dispatchEvent=function(e){e.target??=this;for(const f of this.__listeners?.[e.type]||[])f(e);if(e.bubbles&&this.parentNode)this.parentNode.dispatchEvent(e);return true};}
Object.defineProperty(proto,'focus',{value:function(){},configurable:true});proto.showModal=function(){this.open=true};proto.close=function(){this.open=false};
Object.defineProperty(proto,'elements',{get(){const o={};for(const n of this.querySelectorAll('[name]'))o[n.getAttribute('name')]=n;return o;}});
proto.reset=function(){for(const n of Object.values(this.elements))n.value='';};proto.reportValidity=function(){return true};
class FormDataMock{constructor(form){this.entries=Object.values(form.elements).map(el=>[el.getAttribute('name'),el.value||''])}[Symbol.iterator](){return this.entries[Symbol.iterator]()}}
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');D.body.innerHTML=html.match(/<body>([\s\S]*?)<\/body>/)[1];
for(const n of D.querySelectorAll('iframe'))n.contentWindow={postMessage(){}};
const locationMock={origin:'http://test',get hash(){return this._hash||'#home'},set hash(v){this._hash=v.startsWith('#')?v:'#'+v}};
const ctx=vm.createContext({window:w,document:D,Node:basicHTML.Node,location:locationMock,localStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>storage[k]=v,removeItem:k=>delete storage[k]},console,Date,crypto:require('crypto').webcrypto,Event:TestEvent,CustomEvent:TestEvent,FormData:FormDataMock,TextEncoder,setTimeout,clearTimeout,navigator:{},Blob,URL,confirm:()=>true});
for(const file of ['notes.js','followups.js'])vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..',file),'utf8'),ctx);
// window properties are global in browsers.
ctx.Notes=w.Notes;ctx.Followups=w.Followups;
const app=fs.readFileSync(require('path').join(__dirname,'../app.js'),'utf8').replace('const $=s=>document.querySelector(s), esc=Hub.escape;','const Hub=window.Hub;const $=s=>document.querySelector(s), esc=Hub.escape;');
vm.runInContext(app,ctx);w.Hub.download=(...args)=>downloads.push(args);
const q=s=>D.querySelector(s),fire=(n,type)=>n.dispatchEvent(new TestEvent(type,{bubbles:true}));
function input(sel,value,type='input'){const n=q(sel);n.value=value;fire(n,type)}
assert.equal(q('#homeDtt').textContent,'00:00:00');assert.equal(q('#view-home').hidden,false);
assert.equal(q('#guideButton'),null);assert.equal(q('#guideDialog'),null);assert.equal(q('.local-status'),null);assert.equal(q('footer'),null);assert(!D.body.textContent.includes('Datos guardados en este navegador.'));
assert(!fs.readFileSync(require('path').join(__dirname,'../tools/dtt.html'),'utf8').includes('Actualiza el CSV del día para consultar tu DTT.'));

input('[data-notes-field="merchant"]','Zenza Pizzeria');
input('[data-notes-field="details"]','Discuss menu photos and follow up next week.');
for(const [key,,choices]of w.Notes.questions)input('[data-notes-answer="'+key+'"]',choices[0][0],'change');
assert.equal(q('[data-notes-count]').textContent,'11 / 11 completed');assert(q('[data-notes-preview]').value.includes('Merchant: Zenza Pizzeria'));
fire(q('[data-notes-save]'),'click');assert.equal(JSON.parse(storage['ddhub.notes.v1']).history.length,1);
fire(q('[data-notes-followup]'),'click');assert.equal(ctx.location.hash,'#followups');assert.equal(q('#view-followups').hidden,false);assert.equal(q('#fu-merchant').value,'Zenza Pizzeria');assert.equal(q('.fu-dialog').open,true);
q('#fu-title').value='Review campaign';q('#fu-time').value='10:00';q('#fu-priority').value='high';q('#fu-status').value='pending';
fire(q('.fu-form'),'submit');assert.equal(w.Followups.stats().total,1);assert.equal(q('.fu-dialog').open,false);assert.equal(JSON.parse(storage['ddhub.followups.v1']).tasks[0].merchant,'Zenza Pizzeria');
ctx.location.hash='#home';w.dispatchEvent(new TestEvent('hashchange'));assert.equal(q('#homeDue').textContent,'1');assert(q('#homeAgenda').textContent.includes('Zenza Pizzeria'));
fire(q('.fu-task input'),'change');assert.equal(w.Followups.stats().completed,1);assert.equal(q('#homeDue').textContent,'0');
ctx.location.hash='#notes';w.dispatchEvent(new TestEvent('hashchange'));input('[data-notes-field="merchant"]','<img src=x onerror=1>');fire(q('[data-notes-save]'),'click');assert.equal(q('[data-notes-history]').querySelectorAll('img').length,0);
ctx.location.hash='#video';w.dispatchEvent(new TestEvent('hashchange'));assert.equal(q('#view-video').hidden,false);
w.dispatchEvent(new TestEvent('message',{origin:'http://test',source:q('#videoFrame').contentWindow,data:{type:'ddhub-video-export-state',busy:true}}));
ctx.location.hash='#home';w.dispatchEvent(new TestEvent('hashchange'));assert.equal(ctx.location.hash,'#video');assert.equal(q('#view-video').hidden,false);assert.equal(q('#view-home').hidden,true);
w.dispatchEvent(new TestEvent('message',{origin:'http://test',source:q('#videoFrame').contentWindow,data:{type:'ddhub-video-export-state',busy:false}}));
ctx.location.hash='#home';w.dispatchEvent(new TestEvent('hashchange'));assert.equal(q('#view-home').hidden,false);
console.log('PASS hub DOM: note→calendar flows, dashboard, history escaping, export navigation guard.');

(async()=>{
 locationMock.reload=()=>{locationMock.reloaded=true};
 fire(q('#backupButton'),'click');const backup=JSON.parse(downloads.at(-1)[1]);assert.equal(backup.format,'dd-tool-hub');
 const original=JSON.stringify(storage), fileNode=q('#restoreFile');
 fileNode.files=[{size:100,text:async()=>JSON.stringify({format:'wrong'})}];fire(fileNode,'change');await new Promise(r=>setTimeout(r,0));assert.equal(JSON.stringify(storage),original);assert(!locationMock.reloaded);
 const invalid=JSON.parse(JSON.stringify(backup));invalid.data['ddhub.followups.v1'].tasks[0].date='2026-02-31';fileNode.files=[{size:100,text:async()=>JSON.stringify(invalid)}];fire(fileNode,'change');await new Promise(r=>setTimeout(r,0));assert.equal(JSON.stringify(storage),original);assert(!locationMock.reloaded);
 fileNode.files=[{size:100,text:async()=>JSON.stringify(backup)}];fire(fileNode,'change');await new Promise(r=>setTimeout(r,0));assert(locationMock.reloaded,q('#toast').textContent);assert.equal(JSON.parse(storage['ddhub.followups.v1']).tasks.length,1);
 console.log('PASS backup: export, malformed and invalid-date rejection without mutation, successful atomic restore.');
})().catch(e=>{console.error(e);process.exitCode=1});
