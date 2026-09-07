// Interleaved baseline/candidate measurements avoid drift from separate long runs.
// Both players travel through UI touch controls; state is only read for targeting.
const {chromium}=require('playwright-core'),{serve}=require('./polish_check'),{once}=require('events');
const fs=require('fs'),path=require('path');
(async()=>{
 if(!process.env.LP_POLISH_ROOT)throw Error('LP_POLISH_ROOT must contain the released baseline cockpit/');
 const servers=[serve(process.env.LP_POLISH_ROOT,0),serve(path.resolve(__dirname,'..'),0)];await Promise.all(servers.map(s=>once(s,'listening')));
 const browser=await chromium.launch({executablePath:process.env.CHROME_HEADLESS_SHELL,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const rows=[];
 try{
 for(const [width,height] of [[1024,768]]){
  const players=[];
  for(const server of servers){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,hasTouch:true});
   page.on('pageerror',e=>{throw e;});
   await page.addInitScript(()=>{let seed=0x2F6E2B1;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};localStorage.clear();requestAnimationFrame=()=>0;});
   await page.goto(`http://127.0.0.1:${server.address().port}/cockpit/`);await page.waitForFunction(()=>__lp);
   const cdp=await page.context().newCDPSession(page),touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{...p,id:1}]:[]});
   const center=selector=>page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
   const tap=async p=>{await touch('touchStart',p);await touch('touchEnd');};
   const step=s=>page.evaluate(s=>{__lp.noRender=true;for(let i=0;i<s*60;i++)__lp.update(1/60);renderer.render(scene,camera);},s);
   const button=async sel=>tap(await center(sel));
   const hold=async(sel,s)=>{await touch('touchStart',await center(sel));await step(s);await touch('touchEnd');await step(.1);};
   const project=kind=>page.evaluate(kind=>{const y=toyWorld.yards[0],o=toyWorld.objects[0];let v=kind==='cargo'?new THREE.Vector3(o.x,twCargoTop(o),o.z):kind==='pad'?new THREE.Vector3(y.pad.x,y.y+1,y.pad.z):kind==='slide'?new THREE.Vector3(y.slide.x,y.y+TW.slide.height,y.slide.z):kind==='wind'?new THREE.Vector3(y.windmills[0].x,y.windmills[0].y+TW.garden.height,y.windmills[0].z):new THREE.Vector3(state.x+Math.sin(state.heading)*15,y.y,state.z+Math.cos(state.heading)*15);v.project(camera);const p={x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};return{...p,visible:v.z<1&&p.x>0&&p.x<innerWidth&&p.y>0&&p.y<innerHeight&&document.elementFromPoint(p.x,p.y)?.id==='gl'};},kind);
   const aim=async kind=>{let p=await project(kind);if(!p.visible){const back=await project('back');if(back.visible){await tap(back);await step(5);}p=await project(kind);}if(!p.visible)throw Error(`Invisible ${kind}`);await tap({x:p.x,y:p.y});};
   await button('[data-v="helicopter"]');await button('[data-d="0"]');await step(2);await hold('#heliUpBtn',4);await step(1);
   players.push({page,step,button,hold,aim});
  }
  const both=async fn=>{for(const p of players)await fn(p);};
  const measure=async name=>{
   if(process.argv.includes("--ablate-only")){await both(p=>p.step(.4));return;}
   const samples=[[],[]];
   for(let i=0;i<24;i++)for(const j of (i%2?[1,0]:[0,1])){
    const value=await players[j].page.evaluate(()=>{
     const gl=renderer.getContext(),pixel=new Uint8Array(4);renderer.info.autoReset=false;renderer.info.reset();
     const t=performance.now();__lp.noRender=true;__lp.update(1/60);const updated=performance.now();renderer.render(scene,camera);const submitted=performance.now();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
     const frameMs=performance.now()-t,ext=gl.getExtension('WEBGL_debug_renderer_info');
     return{frameMs,cpuMs:submitted-t,updateMs:updated-t,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,...renderer.info.memory,programs:renderer.info.programs.length,resolution:[gl.drawingBufferWidth,gl.drawingBufferHeight],renderer:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)};
    });if(i>=4)samples[j].push(value);
   }
   const summarize=a=>{const v={...a[0]};for(const key of ['frameMs','cpuMs','updateMs']){const sorted=a.map(x=>x[key]).sort((a,b)=>a-b);v[key]={median:sorted[10],p95:sorted[19]};}v.calls=Math.max(...a.map(x=>x.calls));v.triangles=Math.max(...a.map(x=>x.triangles));return v;};
   const row={viewport:[width,height],name,before:summarize(samples[0]),after:summarize(samples[1])};rows.push(row);console.log(JSON.stringify(row));
  };
  await measure('spawn');
  await both(async p=>{await p.aim('cargo');await p.step(5);});await measure('winch');
  await both(p=>p.step(11));await measure('pickup');
  await both(async p=>{await p.aim('pad');await p.step(5);});await measure('carry');
  await both(async p=>{await p.step(7);await p.button('#magnetBtn');await p.step(9);});await measure('robot');
  await both(async p=>{await p.aim('back');await p.step(5);await p.aim('cargo');await p.step(16);await p.aim('slide');await p.step(12);await p.button('#magnetBtn');await p.step(4.2);});await measure('ramp');
  const ablation=await players[1].page.evaluate(()=>{
   const gl=renderer.getContext(),pixel=new Uint8Array(4),floor=twGeo.floorMaterial,map=floor.map,contact=toyWorld.contacts.visible,results={};
   for(const variant of ['full','trim-contact-edges','without-contacts','without-mat-texture','full-repeat']){
    toyWorld.contacts.material.alphaTest=variant==='trim-contact-edges'?.001:0;toyWorld.contacts.material.needsUpdate=true;
    toyWorld.contacts.visible=variant!=='without-contacts'&&contact;floor.map=variant==='without-mat-texture'?null:map;floor.needsUpdate=true;
    const samples=[];for(let i=0;i<36;i++){renderer.info.reset();const t=performance.now();renderer.render(scene,camera);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);if(i>=12)samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);results[variant]={medianMs:samples[12],p95Ms:samples[22],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
   }return results;
  });console.log('ABLATION',JSON.stringify(ablation));rows.push({name:'ramp-frozen-ablation',after:ablation});
  await both(async p=>{await p.step(30);await p.page.close();});
 }
 }finally{fs.writeFileSync(path.resolve(__dirname,'../docs/helicopter-polish/'+(process.argv.includes('--ablate-only')?'performance-edge-check.json':'performance-cost-check.json')),JSON.stringify({environment:{platform:process.platform,arch:process.arch,chrome:await browser.version(),baseline:'cb42b8b',method:'Alternating baseline/candidate order each sample. 4 warmups + 20 frames per scene. CPU includes update + submission; frame includes blocking pixel readback. Total calls/tris include shadow pass. SwiftShader, not physical iPad.'},rows},null,2));await browser.close();for(const server of servers)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
