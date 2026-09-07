// Boundary/reset coverage for the quiet robot greeting; touch tours are separate.
module.exports=async function robotChecks({newPage,check}) {
  const {page}=await newPage(1024,768);
  const r=await page.evaluate(()=>{
    const L=__lp;L.noRender=true;L.api.skipScreens();L.api.setVehicle('helicopter');L.api.placeOnRunway();L.update(1/60);
    const G=TW.greeting,P=TW.playground,results=[];
    const tick=(y,s)=>{for(let i=0;i<s*20;i++)twUpdateRobotGreeting(y,.05);};
    for(const y of toyWorld.yards){
      const x=y.x+y.side*P.displayX,z=y.z+y.side*P.displayZ;
      const place=d=>{state.phase='AIRBORNE';state.x=x+d;state.z=z;state.y=y.y+60;};
      place(40);tick(y,1);const unbuilt=y.greetings===0&&y.greetT===0;
      y.built=1;y.danceT=3;tick(y,1);const danceWait=y.greetings===0;
      y.danceT=0;tick(y,1);const first=y.greetings===1&&y.greetT>2;
      const facing=Math.abs(Math.atan2(Math.sin(y.buildGroup.rotation.y-Math.PI/2),Math.cos(y.buildGroup.rotation.y-Math.PI/2)))<.5;
      tick(y,10);const calm=y.greetings===1&&y.greetT===0;
      for(let i=0;i<20;i++){place(G.reach+(i%2?1:-1));tick(y,.1);}
      const jitter=y.greetings===1;
      place(G.leave+1);tick(y,.1);place(40);tick(y,.1);const replay=y.greetings===2&&y.greetT>0;
      state.y=y.y+G.maxHeight+1;tick(y,.1);const high=!y.greetNear&&y.greetT===0;
      place(40);tick(y,.1);y.delivery={};tick(y,.1);const delivery=!y.greetNear&&y.greetT===0;y.delivery=null;
      place(40);tick(y,.1);state.phase='TAXI';tick(y,.1);const landing=!y.greetNear&&y.greetT===0;
      // Crossing atan2's branch cut must turn only a little, not spin around.
      place(1);state.z=z-40;y.buildGroup.rotation.y=-Math.PI+.02;tick(y,.05);
      const shortTurn=Math.abs(y.buildGroup.rotation.y-(-Math.PI+.02))<.1;
      const before=y.buildGroup.rotation.y;place(1);state.z=z+1;tick(y,1);const overhead=y.buildGroup.rotation.y===before;
      results.push({overhead,airport:y.idx,unbuilt,danceWait,first,facing,calm,jitter,replay,high,delivery,landing,shortTurn});
    }
    L.api.setVehicle('prop');L.api.placeOnRunway();L.update(1/60);
    toyWorld.yards.forEach(y=>tick(y,10));
    return{results,plane:toyWorld.yards.every(y=>!y.greetNear&&y.greetT===0)};
  });
  check('robot: waits for a whole robot and the delivery dance, then faces and greets the helicopter',r.results.every(v=>v.unbuilt&&v.danceWait&&v.first&&v.facing),JSON.stringify(r.results));
  check('robot: hovering and boundary jitter stay quiet; leaving re-arms one greeting',r.results.every(v=>v.calm&&v.jitter&&v.replay),JSON.stringify(r.results));
  check('robot: high flight, rebuilding, landing and vehicle switching clear the greeting',r.results.every(v=>v.high&&v.delivery&&v.landing)&&r.plane,JSON.stringify(r));
  check('robot: turning across the angle boundary follows the short path',r.results.every(v=>v.shortTurn&&v.overhead),JSON.stringify(r.results));
  await page.close();
};
