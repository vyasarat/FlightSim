// Geometry bounds and lifecycle tests complement the rendered touch tours.
module.exports=async function toyFinishChecks({newPage,check}){
 const {page}=await newPage(1024,768);
 const result=await page.evaluate(()=>{
  __lp.api.skipScreens();__lp.noRender=true;
  const tops=toyWorld.objects.map(o=>({kind:o.kind,top:Math.max(...ejectSupportPoints(o.g).map(v=>v.y))+o.y,expected:twCargoTop(o)}));
  const fixture=new THREE.Group(),fm=new THREE.MeshBasicMaterial();
  for(const p of [[-2,1,3],[3,-2,-1]]){const m=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),fm);m.position.set(...p);m.rotation.z=.3;fixture.add(m);}
  const supportBefore=ejectSupportPoints(fixture).map(v=>v.toArray().map(n=>n.toFixed(5)).join(',')).sort();
  toyMergeFittings(fixture);
  const supportAfter=ejectSupportPoints(fixture).map(v=>v.toArray().map(n=>n.toFixed(5)).join(',')).sort();
  const mergedSupports=JSON.stringify(supportBefore)===JSON.stringify(supportAfter);
  fixture.traverse(o=>{if(o.geometry)o.geometry.dispose();});fm.dispose();
  const samples=[];let contact=true,cleared=true,once=true,grounded=true;
  for(let cycle=0;cycle<8;cycle++){
    __lp.api.setVehicle('helicopter');__lp.api.placeOnRunway();for(let i=0;i<120;i++)__lp.update(1/60);
    const bottom=Math.min(...ejectSupportPoints(vehicleModel).map(v=>v.applyMatrix4(vehicleModel.matrixWorld).y));
    grounded=grounded&&Math.abs(bottom-(state.y-TUNE.gearHeight))<.01;
    const yard=toyWorld.yards[0];state.x=yard.x;state.z=yard.z;state.y=yard.y+20;state.phase='AIRBORNE';heliReset();
    for(let i=0;i<90;i++)__lp.update(1/60);
    const dusty=toyWorld.downwash.visible;
    const old=vehicleModel,disposals=new Map();old.traverse(o=>{for(const r of [o.geometry,...(Array.isArray(o.material)?o.material:[o.material])])if(r&&!disposals.has(r)){disposals.set(r,0);r.addEventListener('dispose',()=>disposals.set(r,disposals.get(r)+1));}});
    // Batched skid geometry must contribute its transformed bounds to rescue contact.
    const support=ejectSupportPoints(old);contact=contact&&Math.min(...support.map(v=>v.y))< -1.69;
    ejectStart();cleared=cleared&&dusty&&!toyWorld.downwash.visible&&old.userData.rotorBlur.material.opacity===0;
    for(let i=0;i<60*40&&eject.active;i++)__lp.update(1/60);
    __lp.api.setVehicle('prop');__lp.api.placeOnRunway();for(let i=0;i<150;i++)__lp.update(1/60);
    once=once&&[...disposals.values()].every(n=>n===1);
    // Scope the GPU draw to this lifecycle's pools. Ambient aircraft/birds
    // lazily upload geometry as they enter view over time; that is not a leak
    // from selecting/releasing a helicopter. Shared-world cycles are tested separately.
    const hidden=[];for(const child of scene.children)if(child!==toyWorld.root&&child!==vehicleModel&&child!==eject.pool.root&&!child.isLight&&!child.isCamera){hidden.push([child,child.visible]);child.visible=false;}
    renderer.render(scene,camera);for(const [child,visible] of hidden)child.visible=visible;
    samples.push({...renderer.info.memory,programs:renderer.info.programs.length});
  }
  twGeo.round.computeBoundingBox();const b=twGeo.round.boundingBox;
  return{mergedSupports,grounded,tops,samples,contact,cleared,once,bounds:[...b.min.toArray(),...b.max.toArray()]};
 });
 check('toy finish: repeated rescues and vehicle changes release owned resources exactly once',result.once&&result.samples.slice(4).every(s=>JSON.stringify(s)===JSON.stringify(result.samples[3])),JSON.stringify(result));
 check('toy finish: merged fittings retain constituent support bounds',result.mergedSupports);
 check('toy finish: parked/rescue skids meet the ground and rescue clears downwash/rotor blur',result.grounded&&result.contact&&result.cleared,JSON.stringify({grounded:result.grounded,contact:result.contact,cleared:result.cleared}));
 check('toy finish: softened cargo and cabin roofs match attachment surfaces',result.tops.every(o=>Math.abs(o.top-o.expected)<.01)&&result.bounds.every((v,i)=>Math.abs(v-(i<3?-.5:.5))<1e-6),JSON.stringify({bounds:result.bounds,tops:result.tops}));
 await page.close();
};
