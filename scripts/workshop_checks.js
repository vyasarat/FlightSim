// Behavioral coverage complements (and never replaces) the ordinary-touch tour.
module.exports = async function workshopChecks({newPage,check}) {
  const {page}=await newPage(1024,768);
  const result=await page.evaluate(()=>{
    const L=window.__lp;L.noRender=true;L.api.skipScreens();L.api.setVehicle('helicopter');L.api.placeOnRunway();L.update(1/60);
    const advance=s=>{for(let i=0;i<s*20;i++){toyWorld.clock+=.05;twUpdateCargo(.05);twUpdateWorkshop(.05);twUpdateMagnet(.05);}};
    const release=o=>{o.x=o.yard.slide.x;o.z=o.yard.slide.z;o.y=o.yard.y+TW.slide.height+o.h/2+8;o.vy=-2;o.lock=true;o.dropped=true;o.cooldown=2;o.delivering=false;};
    const cases=[];
    for(const yard of toyWorld.yards)for(const o of toyWorld.objects.filter(o=>o.yard===yard).slice(0,3)){
      const slides=yard.slide.completed,builds=yard.built;release(o);advance(16);
      cases.push({airport:yard.idx,kind:o.kind,slide:yard.slide.completed===slides+1,build:yard.built===builds+1,returned:Math.hypot(o.x-o.homeX,o.z-o.homeZ)<.01&&!o.delivering});
    }
    // A second dropped toy waits safely if the ramp is occupied, then gets its
    // own turn. No cargo disappears and neither activity overwrites an owner.
    const y=toyWorld.yards[0],a=toyWorld.objects[0],b=toyWorld.objects[1],before=y.slide.completed;
    release(a);advance(1);release(b);advance(30);
    const queued=y.slide.completed===before+2&&[a,b].every(o=>!o.delivering&&Math.hypot(o.x-o.homeX,o.z-o.homeZ)<.01);
    // Switching the player's vehicle cannot strand a cargo-owned animation.
    release(a);advance(1);L.api.setVehicle('prop');L.api.placeOnRunway();L.update(1/60);advance(16);
    const switchSafe=!y.slide.run&&!y.delivery&&!a.delivering&&Math.hypot(a.x-a.homeX,a.z-a.homeZ)<.01;
    // A real release records delivery intent separately from the pickup lock.
    // Leaving early clears the latter, but must not strand a falling toy.
    const edgeStart=y.slide.completed;
    release(a);a.y+=100;advance(20);
    const highDrop=y.slide.completed===edgeStart+1&&!a.delivering&&Math.hypot(a.x-a.homeX,a.z-a.homeZ)<.01;
    twObjectHome(a);twObjectHome(b);y.delivery=null;y.slide.run=null;
    const busyStart=y.slide.completed,builtStart=y.built;
    release(a);advance(3);
    b.x=y.pad.x;b.z=y.pad.z;b.y=y.y+b.h/2;b.vy=0;b.lock=true;b.dropped=true;b.cooldown=2;
    advance(20);
    const busyCrane=y.slide.completed===busyStart+1&&y.built===builtStart+2&&[a,b].every(o=>!o.delivering&&Math.hypot(o.x-o.homeX,o.z-o.homeZ)<.01);
    const wind=[];
    L.api.setVehicle('helicopter');L.api.placeOnRunway();L.update(1/60);
    for(const yard of toyWorld.yards)for(const w of yard.windmills){
      state.phase='AIRBORNE';state.x=w.x;state.z=w.z;state.y=w.y+45;
      const start=w.plays;twUpdateWindGarden(yard,.1);
      for(let i=0;i<100;i++)twUpdateWindGarden(yard,.05);
      const once=w.plays===start+1&&w.speed>6&&!w.ring.visible;
      state.x=w.x+TW.garden.leave+1;twUpdateWindGarden(yard,.1);
      state.x=w.x;twUpdateWindGarden(yard,.1);const replay=w.plays===start+2;
      state.y=w.y+TW.garden.maxHeight+10;twUpdateWindGarden(yard,.1);
      const high=!w.inside&&w.plays===start+2;
      wind.push({airport:yard.idx,once,replay,high});
    }
    L.api.setVehicle('prop');L.api.placeOnRunway();L.update(1/60);
    for(const yard of toyWorld.yards)twUpdateWindGarden(yard,1);
    const noPlaneNotes=toyWorld.yards.every(y=>y.windmills.every(w=>!w.inside));
    const count=()=>{let objects=0;toyWorld.root.traverse(()=>objects++);return{objects,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs.length,materials:twMats.size};};
    const samples=[];
    for(let k=0;k<6;k++){
      for(const yard of toyWorld.yards){release(toyWorld.objects.find(o=>o.yard===yard));advance(16);}
      renderer.render(scene,camera);samples.push(count());
    }
    return{cases,queued,switchSafe,highDrop,busyCrane,wind,noPlaneNotes,samples};
  });
  check('workshop: blocks, cars and containers ride, build and replenish at both airports',result.cases.every(c=>c.slide&&c.build&&c.returned),JSON.stringify(result.cases));
  check('workshop: queued cargo and switching vehicles cannot strand a toy',result.queued&&result.switchSafe,JSON.stringify({queued:result.queued,switchSafe:result.switchSafe}));
  check('workshop: leaving during a high drop and a busy crane preserve the delivery',result.highDrop&&result.busyCrane,JSON.stringify({highDrop:result.highDrop,busyCrane:result.busyCrane}));
  check('workshop: wind notes re-arm on leaving, stay quiet in a hover, and ignore high flight and planes',result.wind.every(w=>w.once&&w.replay&&w.high)&&result.noPlaneNotes,JSON.stringify(result.wind));
  check('workshop: repeated ramp/build cycles keep scene and GPU resources bounded',result.samples.slice(2).every(s=>JSON.stringify(s)===JSON.stringify(result.samples[1])),JSON.stringify(result.samples));
  await page.close();
};
