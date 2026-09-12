// Focused runner. Evidence only under evidence/, never in the repository.
const {chromium}=require('playwright-core'),{serve}=require('./polish_check'),{once}=require('events');
const fs=require('fs'),path=require('path');
(async()=>{
 const out=path.resolve(__dirname,'../evidence/connected-world');fs.mkdirSync(out,{recursive:true});
 const server=serve(path.resolve(__dirname,'..'),0);await once(server,'listening');
 const browser=await chromium.launch({executablePath:process.env.CHROME_HEADLESS_SHELL,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results=[];
 try{
 const newPage=async(w,h)=>{
  const ctx=await browser.newContext({viewport:{width:w,height:h},hasTouch:true}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.clear();requestAnimationFrame=()=>0;let seed=0x2F6E2B1;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};});
  await page.goto(process.env.LP_PLAY_URL||`http://127.0.0.1:${server.address().port}/cockpit/`);await page.waitForFunction(()=>window.__lp);
  await page.waitForFunction(()=>Object.values(modelState).every(s=>s!=="loading"));await page.evaluate(outing=>{if(!outing)__lp.api.skipScreens();__lp.noRender=true;update(1/60);},process.argv.includes('--outing'));return{ctx,page,errors};
 };
 const check=(name,ok,extra)=>{results.push({name,ok,extra});console.log(`${ok?'PASS':'FAIL'} ${name} ${extra||''}`);};
 if(process.argv.includes('--inspect')){
  const {page}=await newPage(390,844);
  if(process.argv.includes('--dock'))await page.evaluate(()=>{const p=hop.fleet.find(p=>p.id==='harbor-car');applyVehicle('car');Object.assign(state,{x:p.x,y:p.y,z:p.z,heading:Math.PI,viewChase:true});carBuildCabin();for(let i=0;i<60;i++)update(1/60);renderer.render(scene,camera);});
  console.log(await page.evaluate(()=>({models:modelState,fireGround:terrainEff(...CW.fireBoat),fireSea:seaLevelAt(...CW.fireBoat),hop:hop.fleet.map(p=>({id:p.id,x:p.x,y:p.y,z:p.z,model:!!p.g})),target:hopTarget()?.id,ground:TUNE.hop.harborBoat.map(()=>0),boatGround:terrainEff(...TUNE.hop.harborBoat)})));
  await page.screenshot({path:path.join(out,process.argv.includes('--dock')?'dock-m1.png':'initial.png')});
 }else if(process.argv.includes('--discovery'))await require('./hop_discovery_checks')({newPage,check,shots:out});
 else if(process.argv.includes('--repeat'))await require('./hop_repeat_checks')({newPage,check,shots:out});
 else if(process.argv.includes('--outing'))await require('./outing_checks')({newPage,check,shots:out});
 else if(process.argv.includes('--connections'))await require('./connection_checks')({newPage,check,shots:out});
 else await require('./hop_checks')({newPage,check,shots:out});
 const resultName=process.argv.includes('--discovery')?'discovery':process.argv.includes('--repeat')?'repeat':process.argv.includes('--outing')?'outing':process.argv.includes('--connections')?'connections':'hop';
 fs.writeFileSync(path.join(out,resultName+'-results.json'),JSON.stringify(results,null,2));
 if(results.some(r=>!r.ok))process.exitCode=1;
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
