const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require('path').join(__dirname,'../tools/video.html'),'utf8');
const code=source.slice(source.indexOf('// Scrubbing has one outstanding decode'),source.indexOf('A.onPlayback='));
class El{constructor(id){this.id=id;this.style={};this.attrs={};this.listeners={};this.scrollLeft=0;this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x)};}setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,v){(this.listeners[k]??=new Set()).add(v)}removeEventListener(k,v){this.listeners[k]?.delete(v)}emit(k,v){for(const f of [...(this.listeners[k]||[])])f({type:k,...v});}hasPointerCapture(){return true}setPointerCapture(){}releasePointerCapture(){}closest(selector){return selector==='#'+this.id?this:null}getBoundingClientRect(){return this.id==='timelineInner'?{left:10-elements.timelineScroll.scrollLeft}:{left:10,right:800};}}
const elements=Object.fromEntries(['playhead','timecode','timelineInner','timelineScroll'].map(k=>[k,new El(k)]));
const A={busy:false,project:{clips:[{start:0,duration:20}]},time:0,zoom:70};let seeks=[],running=0,maxRunning=0,paused=0;
const ctx={A,$:s=>elements[s.slice(1)],time:s=>s.toFixed(3),duration:p=>20,clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),fail:e=>{throw e},Engine:{pause:()=>paused++},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},window:new El('window'),console};
ctx.seek=async t=>{running++;maxRunning=Math.max(maxRunning,running);seeks.push(t);A.time=t;A.onTime(t);await new Promise(r=>setTimeout(r,2));running--;};vm.createContext(ctx);vm.runInContext(code,ctx);
const wait=()=>new Promise(r=>setTimeout(r,50));
(async()=>{
 vm.runInContext('queueScrub(1);queueScrub(2);queueScrub(7)',ctx);await wait();assert.deepEqual(seeks,[1,7]);assert.equal(maxRunning,1);assert.equal(A.time,7);assert.equal(elements.playhead.attrs['aria-valuenow'],'7');
 const down={button:0,pointerId:5,clientX:10+144+7*70,clientY:30,target:elements.playhead,preventDefault(){}};
 ctx.event=down;vm.runInContext('startTimelineScrub(event)',ctx);elements.timelineInner.emit('pointermove',{pointerId:5,clientX:down.clientX+140,preventDefault(){}});await wait();assert.equal(A.time,9);elements.timelineInner.emit('pointerup',{pointerId:5,clientX:down.clientX+210});await wait();assert.equal(A.time,10);assert(!elements.playhead.classes.has('dragging'));
 // Pointer capture ignores unrelated fingers; scroll offsets and zoom are accounted for.
 A.zoom=210;elements.timelineScroll.scrollLeft=600;down.clientX=10-600+144+10*210;vm.runInContext('startTimelineScrub(event)',ctx);elements.timelineInner.emit('pointermove',{pointerId:99,clientX:1,preventDefault(){}});await wait();assert.equal(A.time,10);elements.timelineInner.emit('pointermove',{pointerId:5,clientX:down.clientX-210,preventDefault(){}});await wait();assert.equal(A.time,9);elements.timelineInner.emit('pointercancel',{pointerId:5});await wait();assert(!elements.playhead.classes.has('dragging'));
 vm.runInContext('queueScrub(-20)',ctx);await wait();assert.equal(A.time,0);vm.runInContext('queueScrub(100)',ctx);await wait();assert.equal(A.time,20);
 console.log(JSON.stringify({passed:true,checks:['latest pointer wins','one decode in flight','continuous drag','final pointerup position','zoom and scroll offsets','pointer identity','cancel cleanup','duration bounds','slider ARIA'],maxConcurrentSeeks:maxRunning,paused}));
})().catch(e=>{console.error(e);process.exit(1)});
