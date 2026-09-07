// Reproducible touch tours and frozen-scene render costs. No player teleports.
const {chromium}=require('playwright-core'),{serve}=require('./polish_check');
const {once}=require('events'),fs=require('fs'),path=require('path');
(async()=>{
 const countsOnly=process.argv.includes('--counts-only'),captureOnly=process.argv.includes('--capture-only');
 const tag=process.argv[2]||'scratch',out=path.resolve(__dirname,'../docs/helicopter-polish',tag);fs.mkdirSync(out,{recursive:true});
 const server=serve(process.env.LP_POLISH_ROOT||path.resolve(__dirname,'..'),0);await once(server,'listening');
 const browser=await chromium.launch({executablePath:process.env.CHROME_HEADLESS_SHELL,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const prior=process.argv.includes('--rescue-only')?JSON.parse(fs.readFileSync(path.join(out,'metrics.json'))):{results:[],samples:[]}; const results=prior.results,samples=prior.samples.filter(s=>!s.name.startsWith('eject-'));
 try{
 const newPage=async(width,height)=>{
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.clear();let seed=0x2F6E2B1;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};window.requestAnimationFrame=()=>0;});
  await page.goto(`http://127.0.0.1:${server.address().port}/cockpit/`);await page.waitForFunction(()=>window.__lp);
  const screenshot=page.screenshot.bind(page);
  page.screenshot=async options=>{
   const sample=await page.evaluate(countsOnly=>{
    const gl=renderer.getContext(),times=[],submit=[],pixel=new Uint8Array(4);
    for(let i=0;i<(countsOnly?1:24);i++){const t=performance.now();renderer.render(scene,camera);const s=performance.now();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);if(i>=(countsOnly?0:4)){submit.push(s-t);times.push(performance.now()-t);}}
    const stats=a=>{a.sort((a,b)=>a-b);return {median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)]};};
    const mainCalls=renderer.info.render.calls,mainTriangles=renderer.info.render.triangles;
    renderer.info.autoReset=false;renderer.info.reset();renderer.render(scene,camera);
    const totalCalls=renderer.info.render.calls,totalTriangles=renderer.info.render.triangles;renderer.info.autoReset=true;
    const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {viewport:[innerWidth,innerHeight],resolution:[gl.drawingBufferWidth,gl.drawingBufferHeight],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),renderMs:stats(times),submissionMs:stats(submit),calls:mainCalls,triangles:mainTriangles,totalCalls,totalTriangles,shadowCalls:totalCalls-mainCalls,shadowTriangles:totalTriangles-mainTriangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs.length,state:{x:state.x,y:state.y,z:state.z,held:!!toyWorld.held,built:toyWorld.yards[0].built,slides:toyWorld.yards[0].slide.completed}};
   },countsOnly||captureOnly);sample.name=path.basename(options.path);samples.push(sample);if(/1024x768-(spawn|pickup|delivery)|390x844-(pickup|delivery)/.test(sample.name))console.log('METRIC',JSON.stringify(sample));return countsOnly?Buffer.alloc(0):screenshot(options);
  };
  return {page,errors};
 };
 const check=(name,ok,details)=>{results.push({name,ok});console.log(`${ok?'PASS':'FAIL'} ${name} ${details||''}`);};
 for(const file of (process.argv.includes('--rescue-only')?[]:['heli_play_checks','workshop_play_checks','garden_play_checks']))await require('./'+file)({newPage,check,shots:out});
 for(const [w,h] of [[1024,768],[390,844]]){
  const {page,errors}=await newPage(w,h);
  // With a paused clock use dispatched pointer events (Playwright tap waits for rAF).
  const tap=async sel=>page.locator(sel).tap();
  await tap('[data-v="helicopter"]');await tap('[data-d="0"]');
  const step=s=>page.evaluate(s=>{__lp.noRender=true;for(let i=0;i<s*60;i++)__lp.update(1/60);},s);
  await step(1);await tap('#ejectBtn');await step(2.5);await page.screenshot({path:path.join(out,`eject-${w}x${h}-launch.png`)});await step(2);await page.screenshot({path:path.join(out,`eject-${w}x${h}-canopy.png`)});await step(22);
  check(`ejection ${w}x${h} returns`,await page.evaluate(()=>!eject.active&&eject.last.returned)&&!errors.length);await page.close();
 }
 }finally{fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({environment:{platform:process.platform,arch:process.arch,chrome:await browser.version(),baseline:'cb42b8b',clock:'fixed 60 Hz simulation; frozen scene render + blocking pixel readback, 4 warmups + 20 samples (counts-only/capture-only: 1); calls/tris main pass; totals explicitly include shadow pass; not actual iPad FPS'},results,samples},null,2));await browser.close();await new Promise(r=>server.close(r));}
 if(results.some(r=>!r.ok))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
