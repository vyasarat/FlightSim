// Alternating A/B frames, two complete runs, both orientations and camera views.
// Run only with no competing harness/browser workloads. SwiftShader, not an iPad.
const {chromium}=require('playwright-core'),{serve}=require('./polish_check'),{once}=require('events');
const fs=require('fs'),path=require('path');
(async()=>{
 if(!process.env.LP_POLISH_ROOT)throw Error('LP_POLISH_ROOT must be a clean deployed baseline checkout');
 const out=path.resolve(__dirname,'../evidence/connected-world');fs.mkdirSync(out,{recursive:true});
 const servers=[serve(process.env.LP_POLISH_ROOT,0),serve(path.resolve(__dirname,'..'),0)];await Promise.all(servers.map(s=>once(s,'listening')));
 const browser=await chromium.launch({executablePath:process.env.CHROME_HEADLESS_SHELL,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const rows=[];
 try{
 for(let run=0;run<2;run++)for(const [width,height] of [[390,844],[844,390]]){
  const pages=[];
  for(const server of servers){const p=await browser.newPage({viewport:{width,height}});await p.addInitScript(()=>{requestAnimationFrame=()=>0;localStorage.clear();let s=0x2F6E2B1;Math.random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};});await p.goto(`http://127.0.0.1:${server.address().port}/cockpit/`);await p.waitForFunction(()=>window.__lp&&Object.values(modelState).every(s=>s!=='loading'));pages.push(p);}
  for(const chase of [true,false])for(const sceneName of ['airport','harbor','carrier','cargo']){
   for(const p of pages)await p.evaluate(({chase,sceneName})=>{
    __lp.noRender=true;__lp.api.skipScreens();__lp.api.setVehicle(sceneName==='harbor'?'car':'helicopter');__lp.api.spawnAt(1,1);
    const poses={airport:[50,45,-6500,0],harbor:[1500,hbRoadY(1500),-6745,-Math.PI/2],carrier:[-850,65,-8260,Math.PI],cargo:[-180,90,-6650,Math.PI]};
    const [x,y,z,heading]=poses[sceneName];Object.assign(state,{x,y,z,heading,speed:0,phase:sceneName==='harbor'?'TAXI':'AIRBORNE',viewChase:chase});el.hud.classList.toggle('chase',chase);heliReset();heli.altitude=y;if(sceneName==='harbor'){carBuildCabin();policeStop(false);policeStart();}
    for(let i=0;i<60;i++)update(1/60);renderer.render(scene,camera);
   },{chase,sceneName});
   const samples=[[],[]];
   for(let frame=0;frame<16;frame++)for(const side of (frame+run)%2?[1,0]:[0,1]){
    const value=await pages[side].evaluate(()=>{const gl=renderer.getContext(),pixel=new Uint8Array(4);renderer.info.autoReset=false;renderer.info.reset();const t=performance.now();update(1/60);const u=performance.now();renderer.render(scene,camera);const submit=performance.now();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);const ext=gl.getExtension('WEBGL_debug_renderer_info');return{frameMs:performance.now()-t,cpuMs:submit-t,updateMs:u-t,calls:renderer.info.render.calls,tris:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,renderer:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)};});if(frame>=4)samples[side].push(value);
   }
   const summarize=a=>{const r={...a[0]};for(const k of ['frameMs','cpuMs','updateMs']){const values=a.map(s=>s[k]).sort((a,b)=>a-b);r[k]={median:values[Math.floor(values.length/2)],p95:values.at(-1)};}r.calls=Math.max(...a.map(s=>s.calls));r.tris=Math.max(...a.map(s=>s.tris));return r;};
   const row={run,viewport:[width,height],view:chase?'chase':'cockpit',scene:sceneName,before:summarize(samples[0]),after:summarize(samples[1])};rows.push(row);console.log(JSON.stringify(row));
  }
  for(const p of pages)await p.close();
 }
 }finally{fs.writeFileSync(path.join(out,'performance-paired.json'),JSON.stringify({baseline:'767ddb7',method:'Two complete runs; alternating A/B then B/A every frame; 4 warmups + 12 measured samples; total calls/triangles include shadow pass. SwiftShader software rendering, not an iPad. cpuMs is update plus submission; frameMs adds blocking pixel readback.',chrome:await browser.version(),rows},null,2));await browser.close();for(const s of servers)await new Promise(r=>s.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
