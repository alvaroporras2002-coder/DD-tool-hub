const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require('path').join(__dirname,'../tools/video.html'),'utf8');
const code=source.slice(source.indexOf('// Scrubbing has one outstanding decode'),source.indexOf('A.onPlayback='));
class El{
 constructor(id){this.id=id;this.style={};this.attrs={};this.listeners={};this.scrollLeft=0;this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x)};}
 setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,v){(this.listeners[k]??=new Set()).add(v)}removeEventListener(k,v){this.listeners[k]?.delete(v)}
 emit(k,v){for(const f of [...(this.listeners[k]||[])])f({type:k,preventDefault(){},stopPropagation(){},...v});}
 hasPointerCapture(){return true}setPointerCapture(){}releasePointerCapture(){}
 closest(selector){return selector==='#'+this.id?this:null}
 getBoundingClientRect(){return this.id==='timelineInner'?{left:10-elements.timelineScroll.scrollLeft}:{left:10,right:800};}
}
const elements=Object.fromEntries(['playhead','timecode','timelineInner','timelineScroll'].map(k=>[k,new El(k)]));
const duration=p=>Math.max(0,...p.clips.map(c=>c.start+c.duration));
const A={busy:false,playing:false,project:{fps:30,clips:[{start:0,duration:20,type:'video'}]},time:0,zoom:70};let seeks=[],running=0,maxRunning=0,paused=0;
const ctx={A,app:A,$:s=>elements[s.slice(1)],time:s=>s.toFixed(3),duration,clamp:(x,a,b)=>Math.min(b,Math.max(a,Number(x)||0)),value:(v,f)=>Number.isFinite(Number(v))?Number(v):f,fail:e=>{throw e},Engine:{pause:()=>paused++},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},window:new El('window'),console,generation:0,exporting:false,pause:()=>{paused++;A.playing=false},render:()=>{},live:(c,t)=>t>=c.start&&t<c.start+c.duration,resource:()=>({type:'image',promise:new Promise(r=>setTimeout(r,2))}),sourceTime:()=>0};
vm.createContext(ctx);
// Execute the real Engine duration, setTime and seek: a mock alone misses empty-project clamping.
const engineStart=source.indexOf('async function seek(t) {');
const engineCode=source.match(/const length = [^\n]+/)[0]+'\n'+source.match(/function setTime\(t[^\n]+/)[0]+'\n'+source.slice(engineStart,source.indexOf('function animated(',engineStart));
vm.runInContext(engineCode+'\nthis.engineSeek=seek;this.mediaDuration=length;this.setPlaybackTime=setTime;',ctx);
ctx.seek=async t=>{running++;maxRunning=Math.max(maxRunning,running);seeks.push(t);try{await ctx.engineSeek(t);}finally{running--;}};
vm.runInContext(code,ctx);
vm.runInContext(source.match(/\$\('#playhead'\)\.addEventListener\('keydown',[^\n]+/)[0],ctx);
const wait=()=>new Promise(r=>setTimeout(r,40));
const run=async text=>{vm.runInContext(text,ctx);await wait();};
(async()=>{
 await run('queueScrub(1);queueScrub(2);queueScrub(7)');assert.deepEqual(seeks,[1,7]);assert.equal(maxRunning,1);assert.equal(A.time,7);assert.equal(elements.playhead.attrs['aria-valuenow'],'7');
 const down={button:0,pointerId:5,clientX:10+144+7*70,clientY:30,target:elements.playhead,preventDefault(){}};
 ctx.event=down;vm.runInContext('startTimelineScrub(event)',ctx);elements.timelineInner.emit('pointermove',{pointerId:5,clientX:down.clientX+140});await wait();assert.equal(A.time,9);elements.timelineInner.emit('pointerup',{pointerId:5,clientX:down.clientX+210});await wait();assert.equal(A.time,10);assert(!elements.playhead.classes.has('dragging'));
 A.zoom=210;elements.timelineScroll.scrollLeft=600;down.clientX=10-600+144+10*210;vm.runInContext('startTimelineScrub(event)',ctx);elements.timelineInner.emit('pointermove',{pointerId:99,clientX:1});await wait();assert.equal(A.time,10);elements.timelineInner.emit('pointermove',{pointerId:5,clientX:down.clientX-210});await wait();assert.equal(A.time,9);elements.timelineInner.emit('pointercancel',{pointerId:5});await wait();assert(!elements.playhead.classes.has('dragging'));
 await run('queueScrub(-20)');assert.equal(A.time,0);await run('queueScrub(100)');assert.equal(A.time,20);
 // Empty preview range is independent of content, playback and export duration.
 A.project={fps:30,clips:[]};A.time=0;A.zoom=70;elements.timelineScroll.scrollLeft=0;
 await run('queueScrub(8)');assert.equal(A.time,8);assert.equal(elements.playhead.attrs['aria-valuemax'],'20');assert.equal(ctx.mediaDuration(),0);assert.equal(A.project.clips.length,0);
 down.clientX=10+144+8*70;vm.runInContext('startTimelineScrub(event)',ctx);elements.timelineInner.emit('pointermove',{pointerId:5,clientX:down.clientX+140});await wait();assert.equal(A.time,10);elements.timelineInner.emit('pointercancel',{pointerId:5});await wait();assert.equal(A.time,10);
 elements.playhead.emit('keydown',{key:'End'});await wait();assert.equal(A.time,20);elements.playhead.emit('keydown',{key:'Home'});await wait();assert.equal(A.time,0);elements.playhead.emit('keydown',{key:'ArrowRight',shiftKey:true});await wait();assert.equal(A.time,1);
 ctx.setPlaybackTime(12);assert.equal(A.time,0,'playback stays clamped to actual zero content duration');assert.equal(ctx.mediaDuration(),0);
 await run('queueScrub(100)');assert.equal(A.time,20);await run('queueScrub(-1)');assert.equal(A.time,0);
 // Inserting real text at an empty cursor keeps its selected start and creates real duration.
 A.project.tracks=[];await run('queueScrub(10)');ctx.safeEdit=()=>true;ctx.clip=(type,mediaId,trackId,start,duration)=>({id:'new-text',type,mediaId,trackId,start,duration});ctx.addTrack=()=>({id:'text-track'});ctx.commit=()=>{};ctx.refresh=()=>A.onTime(A.time);
 vm.runInContext(source.match(/^function addText[^\n]+/m)[0]+'\naddText();',ctx);
 assert.equal(A.project.clips[0].start,10);assert.equal(A.project.clips[0].duration,5);assert.equal(ctx.mediaDuration(),15);assert.equal(A.time,10);assert.equal(elements.playhead.attrs['aria-valuemax'],'15');
 // Existing text-only and audio-only projects retain their true media bounds.
 for(const [type,end]of [['text',5],['audio',8],['video',12]]){A.project={fps:30,clips:[{type,start:0,duration:end}]};await run('queueScrub(100)');assert.equal(A.time,end);assert.equal(elements.playhead.attrs['aria-valuemax'],String(end));assert.equal(ctx.mediaDuration(),end);elements.playhead.emit('keydown',{key:'Home'});await wait();assert.equal(A.time,0);elements.playhead.emit('keydown',{key:'End'});await wait();assert.equal(A.time,end);}
 assert(!/#00c4cc\b/.test(source),'cyan accent removed');
 console.log(JSON.stringify({passed:true,checks:['real Engine preview seeking','empty drag without media','empty keyboard Home/End','insert text at empty cursor','empty playback/export duration stays zero','text/audio/video bounds','latest pointer wins','one decode in flight','continuous drag','final pointerup position','zoom and scroll offsets','pointer identity','cancel cleanup','duration bounds','slider ARIA','DoorDash accent'],maxConcurrentSeeks:maxRunning}));
})().catch(e=>{console.error(e);process.exit(1)});
