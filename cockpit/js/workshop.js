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
}
function twSlidePoint(yard,t,out) {
  const S=TW.slide;
  return out.set(yard.x+yard.side*(lerp(S.x,S.exitX,t)+Math.sin(t*Math.PI)*S.bend),yard.y+S.height*Math.pow(1-clamp((t-S.lip)/(1-S.lip),0,1),2)+1,yard.z+yard.side*lerp(S.z,S.exitZ,t));
}
function twSlideCatch(o) {
  const s=o.yard.slide,S=TW.slide;
  if(!s||s.run||!o.lock||o.vy>0||Math.hypot(o.x-s.x,o.z-s.z)>S.radius||o.y-o.h/2>o.yard.y+S.height+1)return false;
  s.run={o,t:0,x:o.x,y:o.y,z:o.z};o.delivering=true;o.vx=o.vy=o.vz=0;
  flags.slideEntries=(flags.slideEntries||0)+1;twSound(420);return true;
}
function twUpdateWorkshop(dt) {
  const S=TW.slide;
  for(const yard of toyWorld.yards) {
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
        o.delivering=false;o.lock=true;o.cooldown=S.exitCooldown;o.away=0;o.tilt=0;
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
