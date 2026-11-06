const { chromium } = require('playwright');
const http = require('http'), fs=require('fs'), path=require('path'), assert=require('assert');
const root=path.join(__dirname,'..'),artifacts=path.join(__dirname,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
const server=http.createServer((req,res)=>{let file=path.join(root,decodeURI(req.url.split('?')[0]));try{let data=fs.readFileSync(file);res.setHeader('content-type',({'.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.js':'text/javascript','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end('missing')}}).listen(8134);
(async()=>{const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required'],...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});try{
 const p=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:8134/tools/video.html');await p.locator('[data-action=new]').first().click();
 const bar=p.locator('#playhead'),ruler=p.locator('#ruler');let b=await bar.boundingBox();
 // A fresh project has no media but its 20-second navigation ruler is draggable.
 assert.equal(await p.evaluate(()=>app.project.clips.length),0);
 await p.mouse.move(b.x+b.width/2,b.y+8);await p.mouse.down();await p.mouse.move(b.x+b.width/2+140,b.y+8,{steps:8});await p.mouse.up();
 await p.waitForTimeout(100);assert.equal(await bar.getAttribute('aria-valuenow'),'2');assert.equal(await bar.getAttribute('aria-valuemax'),'20');
 assert.equal(await p.evaluate(()=>EditorModel.duration(app.project)),0,'scrubbing adds no export duration');
 await bar.focus();await p.keyboard.press('End');await p.waitForTimeout(80);assert.equal(await bar.getAttribute('aria-valuenow'),'20');
 await p.keyboard.press('Home');await p.waitForTimeout(80);assert.equal(await bar.getAttribute('aria-valuenow'),'0');
 await p.evaluate(()=>app.seek(10));
 await p.locator('[data-tab=text]').click();await p.locator('[data-text-style=title]').click();
 assert.equal(await p.evaluate(()=>app.project.clips.length),1);
 assert.equal(await p.evaluate(()=>app.project.clips[0].start),10);
 assert.equal(await p.evaluate(()=>EditorModel.duration(app.project)),15);
 assert.equal(await p.evaluate(()=>app.time),10);
 await p.evaluate(()=>app.seek(0));
 b=await bar.boundingBox();
 await p.mouse.move(b.x+b.width/2,b.y+8);await p.mouse.down();await p.mouse.move(b.x+b.width/2+140,b.y+8,{steps:8});await p.waitForTimeout(120);const during=await p.evaluate(()=>app.time);assert(during>1.8&&during<2.2,`drag during ${during}`);await p.mouse.up();
 await p.waitForTimeout(100);assert.equal(await bar.getAttribute('aria-valuenow'),'2');
 await bar.focus();await p.keyboard.press('Shift+ArrowRight');await p.waitForTimeout(80);assert.equal(await bar.getAttribute('aria-valuenow'),'3');
 await p.keyboard.press('End');await p.waitForTimeout(80);assert.equal(await bar.getAttribute('aria-valuenow'),'15');
 await p.keyboard.press('Home');await p.waitForTimeout(80);assert.equal(await bar.getAttribute('aria-valuenow'),'0');
 // Keyboard focus can retain horizontal scroll after End/Home. Reset it before
 // deriving pointer coordinates so the ruler hit lands in the visible viewport.
 await p.evaluate(()=>{document.querySelector('#timelineScroll').scrollLeft=0;});
 b=await ruler.boundingBox();await p.mouse.move(b.x+144+35,b.y+12);await p.mouse.down();await p.mouse.move(b.x+144+280,b.y+12,{steps:7});await p.mouse.up();await p.waitForTimeout(80);assert.equal(await bar.getAttribute('aria-valuenow'),'4');
 await p.evaluate(()=>{app.zoom=210;app.refresh();document.querySelector('#timelineScroll').scrollLeft=300});
 b=await bar.boundingBox();await p.mouse.move(b.x+b.width/2,b.y+8);await p.mouse.down();await p.mouse.move(b.x+b.width/2-210,b.y+8,{steps:8});await p.mouse.up();await p.waitForTimeout(80);let t=await p.evaluate(()=>app.time);assert(Math.abs(t-3)<.05,`scrolled zoom drag ${t}`);
 await p.screenshot({path:path.join(artifacts,'video-scrub.png')});assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,mouseDragDuring: during,scrolledZoomTime:t,errors}));
 // Touch movement via dispatched pointer events tests capture/cancel and last-value queue.
 await p.evaluate(()=>{const bar=document.querySelector('#playhead');const b=bar.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+8;bar.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:4,pointerType:'touch',button:0,clientX:x,clientY:y}));document.querySelector('#timelineInner').dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:4,pointerType:'touch',clientX:x+105,clientY:y}));document.querySelector('#timelineInner').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:4,pointerType:'touch',clientX:x+105,clientY:y}));});await p.waitForTimeout(100);t=await p.evaluate(()=>app.time);assert(Math.abs(t-3.5)<.05,`touch ${t}`);assert.equal(await p.locator('.playhead.dragging').count(),0);console.log(JSON.stringify({touchCancelPassed:true,time:t}));

 }finally{await browser.close();server.close()}})().catch(e=>{console.error(e);server.close();process.exit(1)});
