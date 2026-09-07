// Normal-clock touch demonstration: no state writes, teleports or update calls.
const {chromium}=require('playwright-core'),{serve}=require('./polish_check'),{once}=require('events'),path=require('path');
(async()=>{const server=serve(path.resolve(__dirname,'..'),0);await once(server,'listening');const browser=await chromium.launch({executablePath:process.env.CHROME_HEADLESS_SHELL,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,recordVideo:{dir:path.resolve(__dirname,'../qa-screenshots/eject-video'),size:{width:390,height:844}}});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/cockpit/`);await page.waitForFunction(()=>window.__lp);
for(const key of ['prop','helicopter','fighter','starship']){
 if(key!=='prop')await page.locator('#vehBtn').tap();await page.locator(`[data-v="${key}"]`).tap();await page.locator('[data-d="0"]').tap();if(key==='starship')await page.locator('[data-dest="moon"]').tap();await page.waitForTimeout(800);
 await page.locator('#ejectBtn').tap();await page.waitForFunction(()=>eject.phase==='open',null,{polling:50});await page.waitForTimeout(450);await page.screenshot({path:`qa-screenshots/eject-realtime-${key}-open.png`});
 await page.waitForFunction(()=>eject.canopyOpen,null,{polling:50});await page.screenshot({path:`qa-screenshots/eject-realtime-${key}-canopy.png`});
 await page.waitForFunction(()=>eject.impact,null,{polling:50});await page.screenshot({path:`qa-screenshots/eject-realtime-${key}-impact.png`});
 await page.waitForFunction(()=>!eject.active,null,{polling:100,timeout:60000});const result=await page.evaluate(()=>({last:eject.last,key:state.vehicleKey,phase:state.phase,frameErrors:__lp.frameErrors||0}));console.log(key,JSON.stringify(result));if(!result.last.returned||!result.last.canopyAtImpact||result.frameErrors)throw Error('Incomplete rescue');
}
console.log('VIDEO',await page.video().path(),'ERRORS',JSON.stringify(errors));await context.close();if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
