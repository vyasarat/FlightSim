// Exercise the actual cache on localhost (a secure context), without changing
// production's HTTPS-only automatic service-worker registration.
module.exports = async function workshopOfflineCheck({newPage,check}) {
  const {page,errors=[]}=await newPage(844,390);
  try {
    const cached=await page.evaluate(async()=>{
      await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;
      if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
      const keys=await caches.keys(),cache=await caches.open(keys.find(k=>k.startsWith('little-pilot-cockpit-')));
      return {keys,workshop:!!(await cache.match(new URL('./js/workshop.js',location.href).href))};
    });
    await page.context().setOffline(true);await page.reload();await page.waitForFunction(()=>window.__lp);
    const cdp=await page.context().newCDPSession(page);
    const tap=async p=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
    const center=sel=>page.locator(sel).evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
    const step=seconds=>page.evaluate(s=>{__lp.noRender=true;for(let i=0;i<s*60;i++)__lp.update(1/60);renderer.render(scene,camera);},seconds);
    await tap(await center('[data-v="helicopter"]'));await tap(await center('[data-d="0"]'));await step(2);
    // A target tap itself lifts off; no test API changes the vehicle's position.
    const point=await page.evaluate(()=>{const w=toyWorld.yards[0].windmills[0],v=new THREE.Vector3(w.x,w.y+TW.garden.height,w.z).project(camera);return{x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};});
    await tap(point);await step(18);
    const result=await page.evaluate(()=>({phase:state.phase,notes:toyWorld.yards[0].windmills[0].plays,frameErrors:__lp.frameErrors||0,assets:!!toyWorld.yards[0].slide&&toyWorld.yards[0].windmills.length===3}));
    check('workshop: offline reload serves the new assets and a touch can fly to a musical pinwheel',cached.workshop&&result.assets&&result.phase==='AIRBORNE'&&result.notes>0&&!result.frameErrors&&errors.length===0,JSON.stringify({cached,result,errors}));
  }finally{await page.context().setOffline(false);await page.close();}
};
