// Normal-camera discovery renders, then move the inspection camera to verify
// that the same cue follows its target and yields to the existing world ring.
const fs=require('fs'),path=require('path');
module.exports=async({newPage,check})=>{
 const out=path.resolve(__dirname,'../evidence/connected-world');fs.mkdirSync(out,{recursive:true});
 for(const [w,h] of [[390,844],[844,390]])for(const chase of [true,false]){
  const {page,ctx,errors}=await newPage(w,h);
  try{for(const place of ['airport','harbor','fire']){
   const before=await page.evaluate(({place,chase})=>{
    __lp.api.skipScreens();applyVehicle(place==='airport'?'prop':'car');spawnForTakeoff(1,1);
    if(place!=='airport'){
     const at=place==='harbor'?[1680,-6685]:[CW.fireCar[0]+12,CW.fireCar[1]+2];
     Object.assign(state,{x:at[0],z:at[1],y:cwRoadPoint(...at).y,heading:place==='harbor'?-Math.PI/2:0});carBuildCabin();if(place==='fire')state.heading=Math.atan2(-(fire.x-state.x),-(fire.z-state.z));
    }
    state.viewChase=chase;el.hud.classList.toggle('chase',chase);state.speed=0;
    for(let i=0;i<60;i++)update(1/60);
    applyCamera(5);updateVehicleModel(0);btnUpdateAll();renderer.render(scene,camera);const p=hopTarget();
    return{target:p?.id,guide:hop.guide,clashes:btnSlotClashes(),obstructions:btnObstructions()};
   },{place,chase});
   const expected=place==='airport'?'airport-car-1':place==='harbor'?'harbor-boat':'fire-speedboat';
   const label=`hop discovery ${place} ${w} ${chase}`;
   check(label+' offers the nearby vehicle',before.target===expected,JSON.stringify(before));
   await page.screenshot({path:path.join(out,`discovery-${place}-${w}-${chase}.png`)});
   const follow=await page.evaluate(()=>{
    const p=hopTarget(),target=new THREE.Vector3(p.x,p.y+TUNE.hop.guideLift,p.z);
    camera.lookAt(target);camera.updateMatrixWorld();hopGuide();const found=!hop.guide;
    camera.lookAt(camera.position.clone().multiplyScalar(2).sub(target));camera.updateMatrixWorld();hopGuide();
    return{found,behind:hop.guide?.behind,finite:Number.isFinite(hop.guide?.angle)};
   });
   check(label+' directs from behind and clears when framed',follow.found&&follow.behind&&follow.finite,JSON.stringify(follow));
   check(label+' adds no button obstruction',!before.clashes.length&&!before.obstructions.length,JSON.stringify(before.obstructions));
   await page.locator('#hopBtn').tap({force:true});await page.evaluate(()=>{for(let i=0;i<60;i++)update(1/60);});
   check(label+' still enters through the same control',await page.evaluate(expected=>hop.active?.id===expected&&!state.touching&&!state.throttleHeld&&!state.exploding,expected));
  }
  if(errors.length)throw Error(errors.join('\n'));
  }finally{await ctx.close();}
 }
};
