/* Runs the production export controller with controlled browser APIs.
   It validates lifecycle/selection, not actual browser encoding or A/V sync. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../tools/video.html'),'utf8');
const first=source.indexOf('// Export dimensions follow'),last=source.indexOf('async function freeze()',first);
const engineCode=source.slice(first,last);
class Events extends EventTarget{emit(type,data={}){const event=new Event(type);Object.assign(event,data);this.dispatchEvent(event);}}
function harness(mode='success'){
 let now=0,next=0,renderCalls=0,frameCalls=0,allTracks=[],allStreams=[],recorder,intervals=new Set(),raf=new Map(),preloaded=[],strictCalls=0,progress=[];
 const document=new Events();document.visibilityState='visible';document.fonts={ready:Promise.resolve()};
 const signal=new AbortController();
 class Track{constructor(kind='video',original=false){this.kind=kind;this.original=original;this.stopped=false;this.frames=0;allTracks.push(this);if(kind==='video'&&mode!=='fallback')this.requestFrame=()=>{this.frames++;if(mode==='recorder-error'&&this.frames===2)recorder.emit('error',{error:new Error('encoder failed')});if(mode==='unexpected-stop'&&this.frames===2)recorder.externalStop();};}clone(){return new Track(this.kind);}stop(){this.stopped=true;}}
 class Stream{constructor(tracks=[]){this.tracks=tracks;allStreams.push(this);}getTracks(){return this.tracks;}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}addTrack(track){this.tracks.push(track);}}
 class Recorder extends Events{
  static isTypeSupported(){return true;}
  constructor(stream,options){super();if(mode==='constructor-error')throw new Error('unsupported dimensions');this.stream=stream;this.options=options;this.mimeType=options.mimeType;this.videoBitsPerSecond=options.videoBitsPerSecond;this.state='inactive';recorder=this;}
  start(){if(mode==='start-error')throw new Error('could not start');this.state='recording';queueMicrotask(()=>this.emit('start'));}
  externalStop(){this.state='inactive';queueMicrotask(()=>{this.emit('dataavailable',{data:new Blob(['partial-chunk-no-header'])});this.emit('stop');});}
  stop(){if(this.state==='inactive')return;this.state='inactive';queueMicrotask(()=>{
    const header=this.mimeType.includes('mp4')?new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0]):new Uint8Array([26,69,223,163,0,0,0,0,0,0,0,0,0,0,0,0]);
    this.emit('dataavailable',{data:new Blob([mode==='bad-header'?'invalid-header------':header,'final-chunk-preserved'])});this.emit('stop');
   });}
 }
 const videoTrack=()=>new Track('video');
 const canvas={width:1280,height:720,captureStream(rate){this.captureRates??=[];this.captureRates.push(rate);return new Stream([videoTrack()]);}};
 const app={project:{width:1920,height:1080,fps:30,clips:[{id:'text',type:'text',start:0,duration:.2}],tracks:[]},media:new Map(),canvas,time:.1,playing:false,onTime(){},onPlayback(value){app.playing=value;}};
 const originalAudio=new Track('audio',true),audioStream=new Stream([originalAudio]),speaker={gain:{value:.7}},audioContext={state:'running',resume:async()=>{}};
 const resources=new Map();
 const context={exporting:false,app,document,window:{MediaRecorder:Recorder},MediaRecorder:Recorder,navigator:{wakeLock:{request:async()=>({released:false,async release(){this.released=true;}})}},Blob,Uint8Array,DOMException,Promise,Map,Math,Number,String,Error,performance:{now:()=>now},console,
  clamp:(n,a,b)=>Math.min(b,Math.max(a,Number(n)||0)),value:(n,f)=>Number.isFinite(Number(n))?Number(n):f,
  length:()=>Math.max(0,...app.project.clips.map(c=>c.start+c.duration)),
  ensureAudio:()=>true,audioContext,recordDestination:{stream:audioStream},speaker,
  pause(){app.playing=false;},setTime(t){app.time=t;},
  supportedTypes:()=>['video/mp4','video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus'],
  resource(clip){preloaded.push(clip.id);if(!resources.has(clip.id))resources.set(clip.id,{type:clip.type==='audio'?'audio':'image',el:{},promise:Promise.resolve()});return resources.get(clip.id);},
  seekElement:async()=>{},seek:async t=>{app.time=t;if(mode==='restore-error'&&t===.1)throw new Error('restore failed');},
  render(){renderCalls++;if(mode==='render-error'&&renderCalls>=2)throw new Error('render failed');},
  syncMedia:async(t,playing,options)=>{if(options?.strict){strictCalls++;if(mode==='media-error')throw new Error('decode failed');}},
  setTimeout,clearTimeout,setInterval(fn,delay){let timer;if(mode==='watchdog'){timer=setTimeout(()=>{now=1000;fn();},5);}else timer=setInterval(fn,delay);intervals.add(timer);return timer;},clearInterval(timer){clearInterval(timer);clearTimeout(timer);intervals.delete(timer);},
  requestAnimationFrame(fn){const id=++next;raf.set(id,true);if(mode==='watchdog')return id;setImmediate(()=>{if(!raf.has(id))return;raf.delete(id);now+=mode==='stall'?500:1000/60;frameCalls++;if(mode==='hidden'&&frameCalls===2){document.visibilityState='hidden';document.emit('visibilitychange');}if(mode==='abort'&&frameCalls===2)signal.abort();fn(now);});return id;},cancelAnimationFrame(id){raf.delete(id);}
 };
 vm.createContext(context);vm.runInContext(engineCode+'\nthis.productionExport=exportVideo;this.profile=exportProfile;',context);
 function cleanup(){for(const timer of intervals){clearInterval(timer);clearTimeout(timer);}intervals.clear();raf.clear();}
 return {context,app,canvas,document,signal,allTracks,allStreams,originalAudio,speaker,preloaded,cleanup,get recorder(){return recorder;},get renderCalls(){return renderCalls;},get strictCalls(){return strictCalls;},progress};
}
async function run(mode='success',options={},prepare){const h=harness(mode);try{prepare?.(h);const result=await h.context.productionExport({mimeType:'video/webm;codecs=vp9,opus',signal:h.signal.signal,onProgress:p=>{h.progress.push(p);if(mode==='progress-error')throw new Error('progress failed');},...options});return {h,result};}catch(error){h.error=error;return {h,error};}finally{h.cleanup();}}
function restored(h){assert.equal(h.canvas.width,1280);assert.equal(h.canvas.height,720);assert.equal(h.app.time,.1);assert.equal(h.app.playing,false);assert.equal(h.context.exporting,false);assert.equal(h.speaker.gain.value,.7);assert.equal(h.originalAudio.stopped,false,'shared audio destination survives');for(const track of h.allTracks.filter(t=>!t.original))assert.equal(track.stopped,true,'every capture/clone track stops');}
(async()=>{
 const typesCode=source.slice(source.indexOf('function supportedTypes()'),source.indexOf('// Export dimensions follow'));
 const detected=new Set(['video/mp4;codecs=avc1,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus']);
 const typeContext={window:{MediaRecorder:true},MediaRecorder:{isTypeSupported:type=>detected.has(type)}};vm.createContext(typeContext);vm.runInContext(typesCode+'\nthis.getSupported=supportedTypes;',typeContext);
 assert.equal(typeContext.getSupported()[0],'video/mp4;codecs=avc1,mp4a.40.2','prefer explicit H264/AAC when supported');
 detected.delete('video/mp4;codecs=avc1,mp4a.40.2');assert.equal(typeContext.getSupported()[0],'video/mp4','preserve browser native MP4 fallback');
 detected.delete('video/mp4');assert.equal(typeContext.getSupported()[0],'video/webm;codecs=vp8,opus','preserve WebM fallback');
 let h=harness();
 const p={width:1280,height:720,fps:30,clips:[{type:'video',mediaId:'main',duration:10,start:0,fit:'contain'}]},media=new Map([['main',{width:1920,height:1080,name:'native1080.mp4'}]]);
 let profile=h.context.profile(p,media,'auto',30,'video/mp4','high');assert.equal(profile.width,1920);assert.equal(profile.height,1080);assert(profile.bitrate>=20000000);assert.equal(p.width,1280,'no saved project migration');
 media.set('main',{width:640,height:360});profile=h.context.profile(p,media,'1080',30,'video/mp4');assert.equal(profile.width,640);assert.equal(profile.height,360,'no pointless source upscale');
 p.width=720;p.height=1280;media.set('main',{width:2160,height:3840});profile=h.context.profile(p,media,'auto',60,'video/mp4');assert.equal(profile.width,2160);assert.equal(profile.height,3840);assert(profile.bitrate>50000000);h.cleanup();
 let response=await run();assert(!response.error,response.error?.stack);h=response.h;assert.equal(response.result.framesDrawn,6);assert.equal(response.result.droppedFrames,0);assert.equal(response.result.manualCapture,true);assert.equal(response.result.width,1920);assert(response.result.bitrate>8000000);assert.equal(h.recorder.options.audioBitsPerSecond,256000);assert((await response.result.blob.text()).endsWith('final-chunk-preserved'),'last dataavailable included before returning');assert.equal(h.progress.at(-1),1);assert(h.strictCalls>=2,'decoder warmup before recorder');restored(h);
 response=await run('fallback',{mimeType:'video/mp4'});assert(!response.error,response.error?.stack);assert.equal(response.result.extension,'mp4');assert.equal(response.result.manualCapture,false);assert.deepEqual(response.h.canvas.captureRates,[0,30]);restored(response.h);
 response=await run('success',{width:4000,height:2000});assert(!response.error,response.error?.stack);assert.equal(response.result.width,3840);assert.equal(response.result.height,1920,'dimensions capped proportionally');restored(response.h);
 response=await run('success',{},h=>{h.app.project.clips=[{id:'v',type:'video',mediaId:'media',start:0,duration:.2}];h.app.project.bgMode='image';h.app.project.bgMediaId='background';});assert(!response.error,response.error?.stack);assert(response.h.preloaded.includes('__background'),'background loaded before recording');assert(response.h.allTracks.some(t=>t.kind==='audio'&&!t.original));restored(response.h);
 for(const mode of ['constructor-error','start-error','render-error','media-error','recorder-error','unexpected-stop','hidden','abort','stall','watchdog','progress-error','bad-header']){
  response=await run(mode);assert(response.error,`${mode} must reject instead of producing a partial file`);if(mode==='abort')assert.equal(response.error.name,'AbortError');restored(response.h);
 }
 response=await run('success',{},h=>h.signal.abort());assert.equal(response.error.name,'AbortError');assert.equal(response.h.recorder,undefined);assert.equal(response.h.canvas.width,1280);
 response=await run('success',{},h=>{h.document.fonts.ready=new Promise(()=>{});setTimeout(()=>h.signal.abort(),5);});assert.equal(response.error.name,'AbortError','cancel interrupts preflight font wait');restored(response.h);
 response=await run('restore-error');assert(!response.error,'successful result survives preview-restore failure');restored(response.h);
 console.log(JSON.stringify({passed:true,checks:['feature-detected H264/AAC preference and codec fallbacks','source-aware native dimensions','no source upscale','adaptive codec/FPS bitrate','portrait 4K','real export controller and final chunk flush','manual capture and fallback','proportional output limit','decoder prewarm','background preload','audio clone ownership','constructor/start/render/media/encoder errors','unexpected stop','hidden tab and cadence stalls','watchdog','cancel during recording and preflight','progress exceptions','container header guard','preview/audio/track restoration'],scope:'native API mocks; browser encoding and A/V sync not exercised'}));
})().catch(error=>{console.error(error);process.exit(1)});
