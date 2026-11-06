'use strict';
// Exercises the production implementation in a VM. The injected test seam exposes
// closure state without changing the shipped module or reimplementing its rules.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'followups.js');
const originalSource = fs.readFileSync(appPath, 'utf8');
const seamAnchor = '  window.Followups={init,prefill,stats};';
assert.equal(originalSource.split(seamAnchor).length, 2, 'production API anchor must exist exactly once');
const source = originalSource.replace(seamAnchor, `
  window.__followupsTest = {
    validDate, validateTask, validated, importJSON, exportJSON, exportICS, icsEscape, fold, persist,
    setTasks(value) { tasks = value; },
    getTasks() { return tasks; },
    prepareImport() { nodes.import = {value:'chosen.json'}; },
    importValue() { return nodes.import.value; }
  };
${seamAnchor}`);

function fixture() {
  const saves = [], downloads = [], messages = [], events = [], confirmations = [];
  let accepts = true, savesWork = true;
  const window = {
    Hub: {
      save(key, value) { if (!savesWork) return false; saves.push({key, value}); return true; },
      toast(message) { messages.push(message); },
      download(name, text, type) { downloads.push({name, text, type}); }
    },
    dispatchEvent(event) { events.push(event.type); }
  };
  const context = vm.createContext({
    window, console, TextEncoder, Date, crypto:require('node:crypto').webcrypto,
    CustomEvent:class {constructor(type) {this.type=type;}},
    confirm(message) {confirmations.push(message);return accepts;}
  });
  vm.runInContext(source, context, {filename:appPath});
  const api = window.__followupsTest;
  api.prepareImport();
  return {api,saves,downloads,messages,events,confirmations,setAccepts(v){accepts=v;},setSavesWork(v){savesWork=v;}};
}
function task(overrides={}) {
  return {id:'merchant-1',merchant:'Test Merchant',title:'Review campaign',date:'2026-11-06',time:'10:30',priority:'medium',status:'pending',notes:'Follow up after activation.',createdAt:'2026-11-01T15:00:00.000Z',updatedAt:'2026-11-01T15:00:00.000Z',...overrides};
}
function jsonFile(data, raw=false) {const text=raw?data:JSON.stringify(data);return {size:Buffer.byteLength(text),async text(){return text;}};}
function plain(value) {return JSON.parse(JSON.stringify(value));}
function assertICSPhysicalLines(text) {
  assert.ok(text.endsWith('\r\n'), 'calendar must terminate with CRLF');
  assert.ok(!text.replaceAll('\r\n','').match(/[\r\n]/), 'all physical newlines must be CRLF');
  for (const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line,'utf8')<=75, `line exceeds RFC 5545 octet limit: ${Buffer.byteLength(line)}`);
}

test('calendar validation accepts leap days and rejects normalized or malformed dates', () => {
  const {api}=fixture();
  for(const value of ['2000-02-29','2024-02-29','2026-11-06','1900-01-01','9999-12-31']) assert.equal(api.validDate(value),true,value);
  for(const value of ['1900-02-29','2026-02-29','2024-02-30','2026-04-31','2026-00-12','2026-13-01','2026-01-00','2026-11-6','26-11-06','1899-12-31','10000-01-01','',null,20261106]) assert.equal(api.validDate(value),false,String(value));
});

test('task validation enforces time, priority, status, required fields, and data bounds', () => {
  const {api}=fixture();
  for(const time of ['','00:00','09:05','23:59']) assert.equal(api.validateTask(task({time})).time,time);
  for(const time of ['24:00','23:60','12:3','1:30','-1:00','00:00:00',null,123]) assert.throws(()=>api.validateTask(task({time})),/inválido/);
  for(const priority of ['high','medium','low']) assert.equal(api.validateTask(task({priority})).priority,priority);
  for(const priority of ['urgent','',null,'__proto__','toString']) assert.throws(()=>api.validateTask(task({priority})),/inválido/);
  for(const status of ['pending','done']) assert.equal(api.validateTask(task({status})).status,status);
  for(const status of ['complete','Pending','',null]) assert.throws(()=>api.validateTask(task({status})),/inválido/);
  for(const overrides of [{id:''},{id:'x'.repeat(161)},{merchant:'  '},{merchant:'x'.repeat(161)},{title:''},{title:'x'.repeat(241)},{notes:'x'.repeat(20001)},{notes:null},{date:'2026-02-29'}]) assert.throws(()=>api.validateTask(task(overrides)),/inválido/);
  const clean=api.validateTask(task({merchant:'  Merchant  ',title:'  Call again  ',ignored:'not persisted'}));
  assert.equal(clean.merchant,'Merchant');assert.equal(clean.title,'Call again');assert.equal(clean.ignored,undefined);
});

test('backup validation checks version, complete batch, duplicate IDs, and size', () => {
  const {api}=fixture();
  assert.equal(api.validated({version:1,tasks:[]}).length,0);
  assert.equal(api.validated({version:1,tasks:[task()]}).length,1);
  assert.throws(()=>api.validated({version:1,tasks:[task(),task()]}),/duplicados/);
  for(const value of [null,[],{}, {version:2,tasks:[]},{version:'1',tasks:[]},{version:1,tasks:{}},{version:1,tasks:new Array(10001).fill(task())}]) assert.throws(()=>api.validated(value),/versión 1/);
  assert.throws(()=>api.validated({version:1,tasks:[task(),task({id:'second',date:'2026-02-29'})]}),/inválido/);
});

test('JSON import merges by ID, updates confirmed overlaps, and preserves other records', async () => {
  const f=fixture();
  const existing=task(),untouched=task({id:'keep',merchant:'Keep Merchant'});
  f.api.setTasks([existing,untouched]);
  await f.api.importJSON(jsonFile({version:1,tasks:[task({merchant:'Updated Merchant'}),task({id:'new',merchant:'New Merchant'})]}));
  assert.equal(f.confirmations.length,1);
  assert.equal(f.saves.length,1);assert.equal(f.saves[0].key,'ddhub.followups.v1');
  const actual=plain(f.api.getTasks());assert.equal(actual.length,3);
  assert.equal(actual.find(t=>t.id===existing.id).merchant,'Updated Merchant');
  assert.deepEqual(actual.find(t=>t.id==='keep'),untouched);
  assert.equal(actual.find(t=>t.id==='new').merchant,'New Merchant');
  assert.deepEqual(f.events,['hub-data-changed']);assert.equal(f.api.importValue(),'');
  f.api.exportJSON();
  const exported=JSON.parse(f.downloads[0].text);
  assert.equal(exported.version,1);assert.deepEqual(exported.tasks,actual);
  assert.equal(f.api.validated(exported).length,3,'export must be importable');
});

test('invalid imports are atomic, preserve current records, and emit no change event', async () => {
  for(const data of [
    {version:1,tasks:[task({id:'new-valid'}),task({id:'bad',time:'24:00'})]},
    {version:1,tasks:[task({id:'duplicate'}),task({id:'duplicate'})]},
    {version:2,tasks:[task({id:'new'})]}
  ]) {
    const f=fixture(),original=[task({id:'keep'})];f.api.setTasks(original);
    await f.api.importJSON(jsonFile(data));
    assert.deepEqual(plain(f.api.getTasks()),original);assert.equal(f.saves.length,0);assert.equal(f.events.length,0);assert.ok(f.messages.length);assert.equal(f.api.importValue(),'');
  }
  const malformed=fixture();malformed.api.setTasks([task()]);
  await malformed.api.importJSON(jsonFile('{no valid JSON',true));
  assert.equal(malformed.saves.length,0);assert.equal(malformed.api.getTasks().length,1);
  const oversized=fixture();await oversized.api.importJSON({size:10*1024*1024+1,async text(){throw new Error('oversized import must not be read');}});
  assert.equal(oversized.saves.length,0);assert.match(oversized.messages[0],/10 MB/);
});

test('declined overlap and failed persistence leave the in-memory collection intact', async () => {
  const canceled=fixture();canceled.api.setTasks([task()]);canceled.setAccepts(false);
  await canceled.api.importJSON(jsonFile({version:1,tasks:[task({merchant:'Replaced'})]}));
  assert.equal(canceled.api.getTasks()[0].merchant,'Test Merchant');assert.equal(canceled.saves.length,0);assert.equal(canceled.events.length,0);
  const failed=fixture();failed.api.setTasks([task()]);failed.setSavesWork(false);
  await failed.api.importJSON(jsonFile({version:1,tasks:[task({id:'new'})]}));
  assert.equal(failed.api.getTasks().length,1);assert.equal(failed.saves.length,0);assert.equal(failed.events.length,0);
});

test('ICS text escapes delimiters, backslashes and every newline convention', () => {
  const {api}=fixture();
  assert.equal(api.icsEscape('A\\B;C,D\r\nE\rF\nG'),'A\\\\B\\;C\\,D\\nE\\nF\\nG');
  const raw='DESCRIPTION:'+('Árbol, café; 東京 🌳\\\n'.repeat(32));
  const escaped=api.icsEscape(raw),folded=api.fold(escaped);
  assertICSPhysicalLines(folded+'\r\n');
  assert.equal(folded.replace(/\r\n /g,''),escaped,'unfolding must preserve Unicode and escapes exactly');
  assert.ok(folded.includes('\r\n '),'long lines must be folded with leading continuation whitespace');
});

test('ICS export creates safe timed/all-day events with valid CRLF and UTF-8 line folding', () => {
  const f=fixture();
  const malicious='Line 1\r\nEND:VEVENT\r\nBEGIN:VEVENT;title,\\';
  f.api.setTasks([
    task({id:'id with spaces/特殊',merchant:'Comida 🌮 '.repeat(15),title:'Review; promo, details',notes:malicious,time:'00:00'}),
    task({id:'all-day',date:'2024-02-29',time:'',status:'done',priority:'high',notes:'Año bisiesto'})
  ]);
  f.api.exportICS();
  const {text,type,name}=f.downloads[0];
  assert.match(name,/\.ics$/);assert.equal(type,'text/calendar;charset=utf-8');
  assertICSPhysicalLines(text);
  const unfolded=text.replace(/\r\n /g,'');
  assert.equal(unfolded.split('BEGIN:VEVENT\r\n').length-1,2,'notes must not inject calendar components');
  assert.equal(unfolded.split('\r\nEND:VEVENT\r\n').length-1,2);
  assert.match(unfolded,/DTSTART:20261106T000000\r\nDURATION:PT30M/);
  assert.match(unfolded,/DTSTART;VALUE=DATE:20240229\r\nDTEND;VALUE=DATE:20240301/);
  assert.ok(unfolded.includes('UID:id%20with%20spaces%2F%E7%89%B9%E6%AE%8A@ddtoolhub.local'));
  assert.ok(unfolded.includes('Line 1\\nEND:VEVENT\\nBEGIN:VEVENT\\;title\\,\\\\'));
  assert.ok(unfolded.startsWith('BEGIN:VCALENDAR\r\n'));assert.ok(unfolded.endsWith('END:VCALENDAR\r\n'));
});
