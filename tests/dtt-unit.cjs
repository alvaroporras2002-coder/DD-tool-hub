const fs=require('fs'),vm=require('vm'),assert=require('assert');
const script=fs.readFileSync(require('path').join(__dirname,'../tools/dtt.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const storage={};
function boot(){const nodes={}; const mk=id=>({id,value:id==='goalInput'?'70':'',textContent:'',style:{},dataset:{},classList:{add(){},remove(){}},children:[],handlers:{},set innerHTML(s){this.children=[]},get innerHTML(){return''},addEventListener(n,f){(this.handlers[n]??=[]).push(f)},append(...x){this.children.push(...x)},appendChild(x){this.children.push(x)},focus(){},click(){},remove(){}});
const document={getElementById:id=>nodes[id]??=(mk(id)),createElement:()=>mk(''),body:mk('body')};
const window={crypto:{randomUUID:()=>Math.random().toString()},confirm:()=>true};window.parent=window;
const ctx=vm.createContext({document,window,crypto:window.crypto,location:{origin:'http://test'},localStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>storage[k]=v},Date,console,Blob,URL,setTimeout});vm.runInContext(script,ctx);return{ctx,nodes,run:s=>vm.runInContext(s,ctx),fire:(id,event)=>nodes[id].handlers[event].forEach(f=>f({}))};}
let a=boot();a.run(`parseFile('Duration in Seconds,State,Merchant\\n120,Completed,"A, one"\\n30,Missed,Two\\n45, Completed ,Three\\n0,Completed,Four\\ninvalid,Completed,Five\\n','calls.csv')`);
assert.equal(a.nodes.totalDtt.textContent,'00:06:15');assert.equal(a.nodes.baseTime.textContent,'00:03:15');assert.equal(a.nodes.bonusTime.textContent,'00:03:00');assert.equal(a.nodes.validCalls.textContent,'3');
a.nodes.manualMinutes.value='2';a.run('addManualTime()');assert.equal(a.nodes.totalDtt.textContent,'00:08:15');
a.run(`parseFile('Duration in Seconds,State\\n120,Completed\\n30,Missed\\n45, Completed \\n0,Completed\\n','calls.csv')`);assert.equal(a.nodes.totalDtt.textContent,'00:08:15');
a.nodes.goalInput.value='90';a.fire('goalInput','input');const original=a.nodes.dayInput.value;a.nodes.dayInput.value='2026-11-01';a.fire('dayInput','change');assert.equal(a.nodes.totalDtt.textContent,'00:00:00');a.nodes.dayInput.value=original;a.fire('dayInput','change');assert.equal(a.nodes.totalDtt.textContent,'00:08:15');assert.equal(a.nodes.goalInput.value,90);
a=boot();assert.equal(a.nodes.totalDtt.textContent,'00:08:15');assert.throws(()=>a.run(`parseFile('Duration,State\\n30,Completed','bad.csv')`),/Duration in Seconds/);assert.equal(a.nodes.totalDtt.textContent,'00:08:15');
a.run(`parseFile('Duration in Seconds;State\\r\\n10;completed\\r\\n20;Left Message','semi.csv')`);assert.equal(a.nodes.totalDtt.textContent,'00:03:30');
console.log('PASS: Completed-only bonus including 0 duration; invalid durations skipped; quoted CSV; manual; repeated upload replaces; dates isolated; goal and reload persisted; bad CSV preserves state; semicolon parser.');
