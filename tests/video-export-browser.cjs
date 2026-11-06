/* Real Chromium export smoke: synthetic public fixture only; no merchant data. */
const { chromium }=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),artifacts=path.join(__dirname,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURI(req.url.split('?')[0]));try{const data=fs.readFileSync(file),extension=path.extname(file);res.setHeader('content-type',({'.html':'text/html','.svg':'image/svg+xml','.css':'text/css','.js':'text/javascript','.json':'application/json'})[extension]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end('missing');}}).listen(8135);
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required'],...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',error=>errors.push(error.message));
 await p.goto('http://localhost:8135/tools/video.html');await p.locator('[data-action=new]').first().click();await p.locator('[data-tab=text]').click();await p.locator('[data-text-style=title]').click();
 // A genuine browser codec smoke test: render a short native-size composition,
 // decode its downloaded container, inspect dimensions and exercise cancellation.
 // This block requires a real installed browser; Node API mocks do not replace it.
 const encoded=await p.evaluate(async()=>{
  const text=app.project.clips.find(c=>c.type==='text');text.start=0;text.duration=.7;
  app.project.clips=[text];app.project.width=640;app.project.height=360;app.project.fps=24;app.canvas.width=640;app.canvas.height=360;
  app.refresh();await app.seek(0);
  const formats=Engine.supportedTypes();if(!formats.length)throw new Error('Browser has no supported export codec');
  const result=await Engine.exportVideo({width:640,height:360,fps:24,mimeType:formats[0]});
  const video=document.createElement('video');video.muted=true;video.playsInline=true;
  const url=URL.createObjectURL(result.blob);video.src=url;
  try{
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Exported container failed to decode')),10000);video.onloadeddata=()=>{clearTimeout(timer);resolve();};video.onerror=()=>{clearTimeout(timer);reject(new Error('Exported container decode error'));};video.load();});
   const metadata={width:video.videoWidth,height:video.videoHeight,duration:Number.isFinite(video.duration)?video.duration:null,mime:result.mimeType,bytes:result.blob.size};
   await video.play();await new Promise(resolve=>setTimeout(resolve,180));video.pause();metadata.decodedTime=video.currentTime;
   const controller=new AbortController();text.duration=2;app.refresh();const timer=setTimeout(()=>controller.abort(),80);
   try{await Engine.exportVideo({width:640,height:360,fps:24,mimeType:formats[0],signal:controller.signal});throw new Error('Cancellation unexpectedly returned a file');}catch(error){if(error.name!=='AbortError')throw error;}finally{clearTimeout(timer);}
   metadata.restoredWidth=app.canvas.width;metadata.restoredHeight=app.canvas.height;metadata.playing=app.playing;
   return metadata;
  }finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
 });
 assert.equal(encoded.width,640);assert.equal(encoded.height,360);assert(encoded.bytes>16);assert(encoded.decodedTime>0,'browser decodes and advances exported video');
 if(encoded.mime.includes('mp4'))assert(encoded.duration>0&&Number.isFinite(encoded.duration),'MP4 has finite duration metadata');
 assert.equal(encoded.restoredWidth,640);assert.equal(encoded.restoredHeight,360);assert.equal(encoded.playing,false);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({actualBrowserExportPassed:true,...encoded,scope:'actual MediaRecorder encode/decode and cancellation; source A/V synchronization needs a media fixture'}));

 // Real decoded video + audio fixture. The independent native recording creates
 // an input file; the production editor then imports, composes and exports it.
 const inputFixture=await p.evaluate(async()=>{
  const mime=Engine.supportedTypes()[0],fixture=document.createElement('canvas');fixture.width=1280;fixture.height=720;
  const ctx=fixture.getContext('2d'),audio=new AudioContext();await audio.resume();
  const destination=audio.createMediaStreamDestination(),tone=audio.createOscillator(),gain=audio.createGain();tone.frequency.value=440;gain.gain.value=.2;tone.connect(gain).connect(destination);
  let sequence=0;const paint=()=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,1280,720);ctx.fillStyle='#000';for(let x=0;x<1280;x+=8)ctx.fillRect(x,0,4,720);ctx.fillStyle='#fff';ctx.fillRect(48,48,500,100);ctx.fillStyle='#000';ctx.font='48px Arial';ctx.fillText('SOURCE DETAIL',65,115);ctx.fillStyle='#fff';ctx.fillRect(60+sequence%200,600,140,60);sequence++;};
  // The very first captured frame must already contain the pattern. Creating
  // captureStream on an unpainted canvas can enqueue a blank frame at t=0.
  paint();
  const stream=fixture.captureStream(30);for(const track of destination.stream.getAudioTracks())stream.addTrack(track);
  const parts=[],recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:12000000,audioBitsPerSecond:192000});
  const stop=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};recorder.onstop=resolve;recorder.onerror=e=>reject(e.error);});
  let animation;const draw=()=>{paint();animation=requestAnimationFrame(draw);};
  recorder.start();tone.start();draw();await new Promise(resolve=>setTimeout(resolve,1150));recorder.stop();await stop;cancelAnimationFrame(animation);tone.stop();stream.getTracks().forEach(track=>track.stop());await audio.close();
  const blob=new Blob(parts,{type:recorder.mimeType}),extension=mime.includes('mp4')?'mp4':'webm',video=document.createElement('video'),url=URL.createObjectURL(blob);video.muted=true;video.src=url;
  let stats;
  try{
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Independent source fixture failed to decode')),10000);video.onloadeddata=()=>{clearTimeout(timer);resolve();};video.onerror=()=>{clearTimeout(timer);reject(new Error('Independent source decode error'));};video.load();});
   const sample=document.createElement('canvas');sample.width=video.videoWidth;sample.height=video.videoHeight;sample.getContext('2d').drawImage(video,0,0);
   const pixels=sample.getContext('2d').getImageData(0,0,sample.width,sample.height).data;let luma=0;for(let i=0;i<pixels.length;i+=4)luma+=pixels[i];luma/=pixels.length/4;
   let error=0,count=0,blackSum=0,whiteSum=0,blackCount=0,whiteCount=0;
   for(let y=256;y<512;y++)for(let x=256;x<1024;x++){const i=(y*sample.width+x)*4,value=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722,expected=x%8<4?0:255;error+=Math.abs(value-expected);count++;if(expected===0){blackSum+=value;blackCount++;}else{whiteSum+=value;whiteCount++;}}
   stats={width:video.videoWidth,height:video.videoHeight,duration:Number.isFinite(video.duration)?video.duration:null,mime:blob.type,firstFrameMeanLuma:luma,stripeMeanAbsoluteError:error/count,stripeContrast:whiteSum/whiteCount-blackSum/blackCount,firstPixels:Array.from(pixels.slice((256*sample.width+256)*4,(256*sample.width+272)*4))};
  }finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
  window.__ddhubInputFixture={file:new File([blob],'source-audio-video.'+extension,{type:blob.type}),stats};
  return {stats,bytes:Array.from(new Uint8Array(await blob.arrayBuffer())),extension};
 });
 fs.writeFileSync(path.join(artifacts,'video-source-fixture.'+inputFixture.extension),Buffer.from(inputFixture.bytes));
 fs.writeFileSync(path.join(artifacts,'video-source-metadata.json'),JSON.stringify(inputFixture.stats,null,2));
 const sourceStats=inputFixture.stats;
 assert(sourceStats.firstFrameMeanLuma>40,'independent source first frame: '+JSON.stringify(sourceStats));
 assert(sourceStats.stripeMeanAbsoluteError<35,'independent source stripe detail: '+JSON.stringify(sourceStats));
 assert(sourceStats.stripeContrast>170,'independent source stripe contrast: '+JSON.stringify(sourceStats));
 const mediaExport=await p.evaluate(async()=>{
  const {file,stats:sourceStats}=window.__ddhubInputFixture,mime=Engine.supportedTypes()[0];
  const [media]=await Store.importFiles([file]);
  app.media.set(media.id,media);const tr=app.project.tracks.find(track=>track.type==='video');
  const clip=EditorModel.clip('video',media.id,tr.id,0,Math.min(.8,media.duration));clip.name='Decoded source fixture';
  app.project.clips=[clip];app.project.width=640;app.project.height=360;app.project.fps=24;app.canvas.width=640;app.canvas.height=360;app.refresh();await app.seek(0);
  const result=await Engine.exportVideo({fps:24,mimeType:mime,quality:'high'});
  const video=document.createElement('video');video.muted=true;video.playsInline=true;const url=URL.createObjectURL(result.blob);video.src=url;
  let decoder;
  try{
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Media export did not decode')),10000);video.onloadeddata=()=>{clearTimeout(timer);resolve();};video.onerror=()=>{clearTimeout(timer);reject(new Error('Media export decode error'));};video.load();});
   const sample=document.createElement('canvas');sample.width=video.videoWidth;sample.height=video.videoHeight;sample.getContext('2d').drawImage(video,0,0);
   const pixels=sample.getContext('2d').getImageData(0,0,sample.width,sample.height).data;let luma=0;for(let i=0;i<pixels.length;i+=4)luma+=pixels[i];luma/=pixels.length/4;
   // Four-pixel monochrome bars are unchanged in this region by the caption
   // and moving box. Compare the actual decoded output with the known source.
   let stripeError=0,stripeCount=0,blackSum=0,whiteSum=0,blackCount=0,whiteCount=0;
   for(let y=256;y<512;y++)for(let x=256;x<1024;x++){
    const i=(y*sample.width+x)*4,value=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722,expected=x%8<4?0:255;
    stripeError+=Math.abs(value-expected);stripeCount++;
    if(expected===0){blackSum+=value;blackCount++;}else{whiteSum+=value;whiteCount++;}
   }
   const stripeMeanAbsoluteError=stripeError/stripeCount,stripeContrast=whiteSum/whiteCount-blackSum/blackCount;
   let decodedFrames=0,frameHandle;const count=()=>{decodedFrames++;frameHandle=video.requestVideoFrameCallback(count);};if(video.requestVideoFrameCallback)frameHandle=video.requestVideoFrameCallback(count);
   await video.play();await new Promise(resolve=>setTimeout(resolve,600));video.pause();if(frameHandle!==undefined)video.cancelVideoFrameCallback(frameHandle);
   decoder=new AudioContext();const audioData=await decoder.decodeAudioData(await result.blob.arrayBuffer()),samples=audioData.getChannelData(0);let power=0;for(const sample of samples)power+=sample*sample;const rms=Math.sqrt(power/samples.length);
   return {metadata:{width:video.videoWidth,height:video.videoHeight,duration:Number.isFinite(video.duration)?video.duration:null,mime:result.mimeType,sourceWidth:media.width,sourceHeight:media.height,projectWidth:app.project.width,projectHeight:app.project.height,firstFrameMeanLuma:luma,stripeMeanAbsoluteError,stripeContrast,sourceFirstFrameMeanLuma:sourceStats.firstFrameMeanLuma,sourceStripeMeanAbsoluteError:sourceStats.stripeMeanAbsoluteError,sourceStripeContrast:sourceStats.stripeContrast,firstPixels:Array.from(pixels.slice((256*sample.width+256)*4,(256*sample.width+272)*4)),decodedFrames,audioChannels:audioData.numberOfChannels,audioDuration:audioData.duration,audioRms:rms,framesDrawn:result.framesDrawn,droppedFrames:result.droppedFrames},bytes:Array.from(new Uint8Array(await result.blob.arrayBuffer())),extension:result.extension};
  }finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);if(decoder)await decoder.close();}
 });
 const mediaStats=mediaExport.metadata;
 fs.writeFileSync(path.join(artifacts,'video-export-sample.'+mediaExport.extension),Buffer.from(mediaExport.bytes));
 fs.writeFileSync(path.join(artifacts,'video-export-metadata.json'),JSON.stringify(mediaStats,null,2));
 assert(mediaStats.stripeMeanAbsoluteError<35,'decoded stripe detail: '+JSON.stringify(mediaStats));
 assert(mediaStats.stripeContrast>170,'decoded stripe contrast: '+JSON.stringify(mediaStats));
 assert.equal(mediaStats.width,1280,'auto export retains native source width above old project width');assert.equal(mediaStats.height,720);assert.equal(mediaStats.projectWidth,640,'saved composition is not migrated');assert(mediaStats.firstFrameMeanLuma>40,'first decoded frame contains source image');assert(mediaStats.audioChannels>=1);assert(mediaStats.audioRms>.01,'mixed audio tone is present');assert(mediaStats.audioDuration>.5);if(mediaStats.decodedFrames)assert(mediaStats.decodedFrames>=8,'export contains a stream of decoded frames');
 await p.screenshot({path:path.join(artifacts,'video-editor-export.png')});assert.deepEqual(errors,[]);console.log(JSON.stringify({actualBrowserMediaAndAudioPassed:true,...mediaStats,scope:'actual source encode/import/composition/output encode/video decode/audio decode; precise A/V synchronization not measured'}));

 }finally{if(browser)await browser.close();server.close();}})().catch(error=>{console.error(error);server.close();process.exit(1)});
