// Exact review repro: touch hop into car → picker → prop → hop, eight times.
// No movement writes or action API calls. Sample the same rendered car pose.
const fs=require('fs'),path=require('path');
module.exports=async({newPage,check})=>{
 const out=path.resolve(__dirname,'../evidence/connected-world');fs.mkdirSync(out,{recursive:true});
 for(const [w,h] of [[390,844],[844,390]])for(const chase of [true,false]){
  const {page,ctx,errors}=await newPage(w,h),samples=[];
  const cdp=await page.context().newCDPSession(page);
  const tap=async selector=>{const r=await page.locator(selector).boundingBox();if(!r)throw Error('Missing '+selector);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
  const step=()=>page.evaluate(()=>{__lp.noRender=true;for(let i=0;i<60;i++)update(1/60);renderer.render(scene,camera);});
  try{
   if(await page.locator('#screenVehicle').evaluate(e=>e.classList.contains('hiddenS')))await tap('#menuBtn');
   await tap('[data-v="prop"]');await tap('[data-d="1"]');await step();
   if(await page.evaluate(()=>state.viewChase)!==chase){await tap('#viewBtn');await step();}
   for(let cycle=0;cycle<8;cycle++){
    await tap('#hopBtn');await step();
    samples.push(await page.evaluate(()=>({ownedGeometries:(()=>{const g=new Set();for(const p of hop.fleet)for(const root of [p.g,p.ring])if(root)root.traverse(o=>{if(o.geometry)g.add(o.geometry);});return g.size;})(),fleet:hop.fleet.length,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,active:hop.active?.id,returnTo:hop.returnTo?.id,key:state.vehicleKey,crashed:state.exploding,frameErrors:__lp.frameErrors||0})));
    if(cycle<7){await tap('#menuBtn');await tap('[data-v="prop"]');await tap('[data-d="1"]');await step();}
   }
   const label=`hop picker repeat ${w} ${chase}`,first=samples[0];
   check(label+' completes eight touch loops',samples.every(s=>s.key==='car'&&!s.crashed&&!s.frameErrors)&&!errors.length);
   check(label+' fleet is bounded',samples.every(s=>s.fleet===first.fleet),JSON.stringify(samples.map(s=>s.fleet)));
   // Ambient scenery changes GPU residency by up to three geometries in this
   // deterministic loop. Owned geometry must be exact; total spread is bounded.
   check(label+' GPU resources are bounded',samples.every(s=>s.ownedGeometries===first.ownedGeometries&&s.textures===first.textures)&&Math.max(...samples.map(s=>s.geometries))-Math.min(...samples.map(s=>s.geometries))<=4,JSON.stringify(samples.map(s=>s.geometries)));
   check(label+' returns to the same owned aircraft',samples.every(s=>s.active===first.active&&s.returnTo===first.returnTo));
   await page.screenshot({path:path.join(out,`repeat-${w}-${chase}.png`)});
   fs.writeFileSync(path.join(out,`repeat-${w}-${chase}.json`),JSON.stringify(samples,null,2));
  }finally{await ctx.close();}
 }
};
