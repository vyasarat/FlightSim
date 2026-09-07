"use strict";
// Optional workshop toys. Fixed meshes and cargo records, no new controls.
// Loaded before toyworld.js; functions run only after its shared helpers exist.
function twBuildWorkshop(yard) {
  const S = TW.slide, C = TUNE.palette, side = yard.side;
  const g = new THREE.Group(); yard.g.add(g);
  const s = yard.slide = {g, x:yard.x+side*S.x,z:yard.z+side*S.z,
    exitX:yard.x+side*S.exitX,exitZ:yard.z+side*S.exitZ,run:null,completed:0,
    pos:new THREE.Vector3(),demoClock:0};
  // The bright open cup is both a generous catch area and a visible target.
  twPart(g,'cylinder',C.warning,side*S.x,S.height-1,side*S.z,S.radius,2,S.radius);
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;if(Math.cos(a)>.65)continue;
    const rim=twPart(g,'box',C.red,side*(S.x+Math.cos(a)*S.radius),S.height+1,side*(S.z+Math.sin(a)*S.radius),S.radius*.4,3,2);rim.rotation.y=-a+Math.PI/2;
  }
  for(const dx of [-15,15])twPart(g,'box',C.blue,side*(S.x+dx),(S.height-2)/2,side*S.z,3,S.height-2,3);
  // Segmented chute and raised rails batch into a handful of instanced draws.
  const a=new THREE.Vector3(),b=new THREE.Vector3();
  for(let i=5;i<S.segments;i++) {
    twSlidePoint(yard,i/S.segments,a);twSlidePoint(yard,(i+1)/S.segments,b);
    const dz=b.z-a.z,dy=b.y-a.y,dx=b.x-a.x,length=Math.hypot(dx,dy,dz);
    const segment=new THREE.Group();segment.position.copy(a).add(b).multiplyScalar(.5);
    segment.position.x-=yard.x;segment.position.y-=yard.y;segment.position.z-=yard.z;
    segment.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(dx,dy,dz).normalize());
    // Keep siblings under g so the existing batcher combines all chute sections.
    for(const [offset,w,h,color] of [[0,S.width,1.2,C.warning],[-S.width/2,2,4,C.red],[S.width/2,2,4,C.red]]){
      const p=twPart(g,'box',color,0,0,0,w,h,length+1);
      p.position.set(offset,h/2,0).applyQuaternion(segment.quaternion).add(segment.position);p.quaternion.copy(segment.quaternion);
    }
  }
  s.demo=twPart(g,'ball',C.blue,side*S.x,S.height+4,side*S.z,4,4,4);
  s.demo.userData.twDynamic=true;
  twBuildWindGarden(yard);
}
function twSlidePoint(yard,t,out) {
  const S=TW.slide;
  return out.set(yard.x+yard.side*(lerp(S.x,S.exitX,t)+Math.sin(t*Math.PI)*S.bend),yard.y+S.height*Math.pow(1-clamp((t-S.lip)/(1-S.lip),0,1),2)+1,yard.z+yard.side*lerp(S.z,S.exitZ,t));
}
function twSlideCatch(o) {
  const s=o.yard.slide,S=TW.slide;
  if(!s||s.run||!(o.lock||o.dropped)||o.vy>0||Math.hypot(o.x-s.x,o.z-s.z)>S.radius||o.y-o.h/2>o.yard.y+S.height+1)return false;
  s.run={o,t:0,x:o.x,y:o.y,z:o.z};o.delivering=true;o.vx=o.vy=o.vz=0;
  flags.slideEntries=(flags.slideEntries||0)+1;twSound(420);return true;
}
function twUpdateWorkshop(dt) {
  const S=TW.slide;
  for(const yard of toyWorld.yards) {
    twUpdateWindGarden(yard,dt);
    const s=yard.slide;
    if(!s)continue;
    const run=s.run;
    if(run){
      run.t+=dt;const t=clamp((run.t-S.settle)/S.duration,0,1),o=run.o;
      twSlidePoint(yard,t,s.pos);s.pos.y+=o.h/2;
      const gather=clamp(run.t/S.settle,0,1);
      o.x=lerp(run.x,s.pos.x,gather);o.y=lerp(run.y,s.pos.y,gather);o.z=lerp(run.z,s.pos.z,gather);
      o.g.position.set(o.x,o.y,o.z);o.g.rotation.set(0,yard.side===1?0:Math.PI,Math.sin(t*Math.PI*4)*.12);
      if(t>=1){
        o.x=s.exitX;o.z=s.exitZ;o.y=yard.y+o.h/2;o.g.position.set(o.x,o.y,o.z);o.g.rotation.set(0,0,0);
        o.delivering=false;o.lock=true;o.dropped=true;o.cooldown=S.exitCooldown;o.away=0;o.tilt=0;
        s.run=null;s.completed++;flags.slideCompletions=(flags.slideCompletions||0)+1;twSound(660);
      }
    }
    // A single demonstration ball rolls while the playground is nearby. It
    // travels back along a gentle arc, so its reset is visible and repeatable.
    s.demo.visible=!s.run;
    if(yard.g.visible&&!menuOpen())s.demoClock=(s.demoClock+dt)%S.demoPeriod;
    const t=s.demoClock/S.demoPeriod;
    if(t<.5)twSlidePoint(yard,clamp(t*2,0,1),s.pos);
    else if(t<.8){const f=(t-.5)/.3;twSlidePoint(yard,1-f,s.pos);s.pos.y+=Math.sin(f*Math.PI)*S.demoHop;}
    else twSlidePoint(yard,0,s.pos);
    s.demo.position.set(s.pos.x-yard.x,s.pos.y-yard.y+4,s.pos.z-yard.z);
  }
}

function twBuildWindGarden(yard) {
  const G=TW.garden,C=TUNE.palette;
  yard.windmills=[];
  for(let i=0;i<G.count;i++) {
    const x=yard.side*(G.x+i*G.dx),z=yard.side*(G.z+i*G.dz),color=TW.colors[(i*2)%TW.colors.length];
    const base=Math.max(yard.y,terrainEff(yard.x+x,yard.z+z)+1),lift=base-yard.y;
    twPart(yard.g,'cylinder',C.sand,x,lift-2,z,G.radius,4,G.radius);
    twPart(yard.g,'cylinder',color,x,lift+.3,z,G.radius-2,.6,G.radius-2);
    twPart(yard.g,'cylinder',C.blue,x,lift+G.height/2,z,1.2,G.height,1.2);
    const rotor=new THREE.Group();rotor.position.set(x,lift+G.height,z);yard.g.add(rotor);
    for(let k=0;k<5;k++) {
      const a=k/5*Math.PI*2,p=twPart(rotor,'ball',color,Math.cos(a)*7,0,Math.sin(a)*7,6,1.8,3);
      p.rotation.y=-a+.4;
    }
    twPart(rotor,'ball',C.white,0,1,0,3,2,3);
    const ring=twPart(yard.g,'ring',color,x,lift+.9,z,G.radius,G.radius,G.radius);ring.rotation.x=Math.PI/2;ring.visible=false;ring.userData.twDynamic=true;
    yard.windmills.push({rotor,ring,x:yard.x+x,y:base,z:yard.z+z,speed:0,glow:0,inside:false,plays:0,note:G.notes[i%G.notes.length]});
  }
}
function twUpdateWindGarden(yard,dt) {
  const G=TW.garden;
  for(const w of yard.windmills) {
    const distance=Math.hypot(state.x-w.x,state.z-w.z);
    const eligible=heliActive()&&state.phase==='AIRBORNE'&&!state.exploding&&!menuOpen()&&state.y-w.y<G.maxHeight;
    const near=eligible&&distance<G.reach;
    // Hysteresis: hovering sustains the spin without repeatedly retriggering
    // audio. Leaving the broad outer ring re-arms the note for another visit.
    if(!eligible||distance>G.leave)w.inside=false;
    if(near&&!w.inside){w.inside=true;w.glow=G.glowTime;w.plays++;flags.windNotes=(flags.windNotes||0)+1;twSound(w.note);}
    w.speed+=(near?G.spin-w.speed:-w.speed)*Math.min(1,dt*G.response);
    w.rotor.rotation.y=(w.rotor.rotation.y+w.speed*dt)%(Math.PI*2);
    w.glow=Math.max(0,w.glow-dt);w.ring.visible=w.glow>0;
    w.ring.scale.setScalar(G.radius*(1+(1-w.glow/G.glowTime)*.6));
  }
}

// A visit earns one quiet wave; remaining nearby never loops the greeting.
// The face tracks the helicopter gently, using the shortest turn across ±π.
function twUpdateRobotGreeting(yard, dt) {
  const G = TW.greeting, P = TW.playground;
  const x = yard.x + yard.side * P.displayX, z = yard.z + yard.side * P.displayZ;
  const distance = Math.hypot(state.x - x, state.z - z);
  const eligible = yard.built > 0 && !yard.delivery && heliActive() &&
    state.phase === 'AIRBORNE' && !state.exploding && !menuOpen() && !toyWorld.wash && state.y - yard.y < G.maxHeight;
  if (!eligible || distance > G.leave) { yard.greetNear = false; yard.greetT = 0; }
  if (eligible && distance < G.reach && !yard.greetNear && yard.danceT === 0) {
    yard.greetNear = true; yard.greetT = G.duration; yard.greetings++;
  }
  yard.greetT = Math.max(0, yard.greetT - dt);
  const rest = yard.side === 1 ? -Math.PI / 3 : Math.PI * 2 / 3;
  const angle = yard.buildGroup.rotation.y;
  const target = eligible && yard.greetNear ? (distance > G.faceDeadzone ? Math.atan2(state.x - x, state.z - z) : angle) : rest;
  const next = angle + Math.atan2(Math.sin(target - angle), Math.cos(target - angle)) * Math.min(1, dt * G.turnRate);
  yard.buildGroup.rotation.y = Math.atan2(Math.sin(next), Math.cos(next));
}
