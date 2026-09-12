"use strict";
// WORKING RULES — optional world connections, never movement models. All roads
// use the existing guidance and corridor. Transport moves a support surface;
// the car keeps its own controls on it. Boarding starts an announced round trip,
// returns to the same ramp and re-arms after departure. A hop can interrupt it.
// The chase follows a bounded trail, waits at a raised bridge, then resumes.
const connections={built:false,clock:0,roads:[],trail:[],bridge:null,lastX:null,
  carrier:{phase:'ready',t:0,offset:0,rider:false,trips:0},
  cargo:{phase:'ready',t:0,height:0,rider:false,trips:0,g:null},
  crossings:0,trackVisits:0,onTrack:false};
const CW=TUNE.connections;
function cwPath(points,height) {
  const pts=[];
  points.forEach((b,i)=>{
    const a=points[Math.max(0,i-1)],n=i?Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/CW.roadStep)):1;
    for(let j=i?1:0;j<=n;j++) {
      if(!i&&j)continue;
      const x=lerp(a[0],b[0],j/n),z=lerp(a[1],b[1],j/n);
      pts.push({x,z,y:height?height(x,z):Math.max(terrainEff(x,z),seaLevelAt(x,z))+CW.groundClearance});
    }
  });return pts;
}
function cwAddRoad(id,points,height,railed) {
  const r=hopRoad(id,cwPath(points,height));r.railed=!!railed;connections.roads.push(r);
  r.line=hwyStrip(r.spur,-CW.lineWidth,CW.lineWidth,CW.lineLift,mattMat(TUNE.palette.warning));scene.add(r.line);
  return r;
}
function cwBuild() {
  if(connections.built||!hop.built)return;
  connections.built=true;
  cwAddRoad('airport-harbor',CW.airportLink);
  const route=CW.carrierRoad, first=route[0],last=route[route.length-1];
  connections.carrierRoad=cwAddRoad('carrier-ramp',route,(x,z)=>lerp(terrainEff(...first)+CW.groundClearance,carrier.deck,clamp((z-first[1])/(last[1]-first[1]),0,1)),true);
  connections.deckRoad=cwAddRoad('carrier-deck',[[carrier.x,carrier.z+CV.deckL/2],[carrier.x,carrier.z-CV.deckL/2]],()=>carrier.deck,true);
  cwAddRoad('cargo-bay',CW.cargo.road);
  cwAddRoad('dock-return',CW.dockReturn);
  const track=CW.track,points=[...track.join];
  for(let i=0;i<=track.steps;i++){const a=Math.PI+i/track.steps*Math.PI*2;points.push([track.cx+Math.cos(a)*track.rx,track.cz+Math.sin(a)*track.rz]);}
  connections.track=cwAddRoad('toy-track',points);
  // Bold alternating edge paint makes the track visible from its connecting spur.
  const edges=[[],[]];
  for(let i=1;i<connections.track.spur.length;i++) {
    const pair=connections.track.spur.slice(i-1,i+1),col=i%2?TUNE.palette.red:TUNE.palette.warning;
    for(const side of [-1,1]){
      const a=side*(HW.spurW-CW.lineWidth),b=side*HW.spurW;
      edges[i%2].push(hwyStrip(pair,Math.min(a,b),Math.max(a,b),CW.lineLift,mattMat(col)));
    }
  }
  edges.forEach(cwMergeStrips);
  cwAddRoad('fire-dock',CW.fireRoad,(x,z)=>Math.max(terrainEff(x,z)+CW.groundClearance,HB.spit.y));
  const [bx,bz]=CW.fireBoat,[cx,cz]=CW.fireCar;
  hopAdd('fire-speedboat','speedboat',bx,seaLevelAt(bx,bz),bz,Math.atan2(-(fire.x-bx),-(fire.z-bz)));
  hopAdd('fire-car','car',cx,cwRoadPoint(cx,cz).y,cz,0);
  const C=CW.cargo,cg=marsBuildCargo();cg.remove(cg.children[0]);
  const hull=new THREE.Mesh(new THREE.CylinderGeometry(C.hullR,C.hullR,C.hullH-C.bayH,C.segments),lam(TUNE.palette.steel));
  hull.position.y=C.bayH+(C.hullH-C.bayH)/2;cg.add(hull);
  // An open drive-through bay under the reused cargo hull; no door can trap him.
  for(const side of [-1,1]) {
    const wall=new THREE.Mesh(new THREE.BoxGeometry(C.wall,C.bayH,C.bayHalf*2),lam(TUNE.palette.steel));
    wall.position.set(side*C.hullR,C.bayH/2,0);cg.add(wall);
  }
  const floor=new THREE.Mesh(new THREE.BoxGeometry(C.hullR*2,C.floor,C.bayHalf*2),lam(TUNE.palette.steel));floor.position.y=-C.floor/2;cg.add(floor);
  cg.userData.glow.position.y=-C.plumeDrop;
  cg.scale.setScalar(C.scale);cg.position.set(C.x,terrainEff(C.x,C.z),C.z);scene.add(cg);
  cg.userData.noSolid=true;cg.userData.noShatter=true;
  connections.cargo.g=cg;connections.cargo.ground=cg.position.y;cg.userData.glow.visible=false;
}
function cwDeckContains(x,z) {return Math.abs(x-carrier.x)<CV.deckW/2-CW.carrier.inset&&Math.abs(z-carrier.z)<CV.deckL/2-CW.carrier.inset;}
function cwCargoContains(x,z) {return Math.abs(x-CW.cargo.x)<=CW.cargo.bayHalf&&Math.abs(z-CW.cargo.z)<=CW.cargo.bayHalf;}
function cwTransportStart(r) {r.phase='warning';r.t=0;r.rider=true;r.trips++;hbBridgeBells();}
function cwTransportClock(r,tune,inside,dt) {
  if(r.phase==='ready'&&inside&&carActive()&&!state.exploding)cwTransportStart(r);
  if(r.phase==='warning') {r.t+=dt;countdownTo(tune.warning-r.t,tune.warning);if(r.t>=tune.warning){r.phase='ride';r.t=0;countdownClear();}}
  else if(r.phase==='ride'){r.t+=dt;if(r.t>=tune.duration){r.t=tune.duration;r.phase='returned';chirp();}}
  else if(r.phase==='returned'&&!inside){r.phase='ready';r.rider=false;r.t=0;}
  return r.phase==='ride'?Math.sin(Math.PI*r.t/tune.duration)**2:0;
}
function cwUpdate(dt) {
  cwBuild();if(!connections.built)return;connections.clock+=dt;
  // Capture the occupied support before moving it; other vehicles never inherit it.
  const ship=connections.carrier,old=ship.offset;
  const onDeck=carActive()&&cwDeckContains(state.x,state.z)&&Math.abs(state.y-carrier.deck)<CW.carrier.inset;
  const board=onDeck&&Math.abs(state.z-(carrier.z+CW.carrier.boardZ))<CW.carrier.boardR;
  const k=cwTransportClock(ship,CW.carrier,ship.phase==='ready'?board:onDeck,dt);
  ship.offset=-k*CW.carrier.distance;const dz=ship.offset-old;
  carrier.z=CV.at.z+ship.offset;carrier.g.position.z=ship.offset;
  if(onDeck){state.z+=dz;ship.rider=true;}else ship.rider=false;
  for(const p of hop.fleet)if(p.anchor==='carrier'&&p!==hop.active)p.z+=dz;
  if(heliActive()&&state.phase==='TAXI'&&hopCarrierSurface(state.x,state.z-dz))state.z+=dz;
  if(heliActive()&&heli.target&&(connections.heliTarget===heli.target||hopCarrierSurface(heli.target.x,heli.target.z-dz))) {
    connections.heliTarget=heli.target;heli.target.z+=dz;
  }
  // The deck's guide travels with it; the shore ramp remains a visible pier.
  // No parked vehicle is removed during the trip.
  const deck=connections.deckRoad;
  for(const p of deck.spur)p.z+=dz;deck.mesh.position.z=ship.offset;deck.line.position.z=ship.offset;
  connections.carrierRoad.mesh.visible=true;
  const cargo=connections.cargo,aboard=carActive()&&((cwCargoContains(state.x,state.z)&&Math.abs(state.y-cargo.g.position.y)<CW.cargo.boardHeight)||(cargo.rider&&['warning','ride'].includes(cargo.phase))); 
  const oldHeight=cargo.height,c=cwTransportClock(cargo,CW.cargo,aboard,dt);cargo.height=c*CW.cargo.height;
  for(const p of hop.fleet)if(p.anchor==='cargo'&&p!==hop.active)p.y+=cargo.height-oldHeight;
  cargo.g.position.y=cargo.ground+cargo.height;cargo.g.userData.glow.visible=cargo.phase==='ride';
  cargo.rider=aboard;
  cwBridge(dt);cwTrail();
}
function cwLate() {
  if(!connections.built||!carActive()||state.exploding)return;
  const ship=connections.carrier,cargo=connections.cargo;
  if(ship.rider&&ship.phase!=='ready') {
    state.x=clamp(state.x,carrier.x-CV.deckW/2+CW.carrier.inset,carrier.x+CV.deckW/2-CW.carrier.inset);
    state.z=clamp(state.z,carrier.z-CV.deckL/2+CW.carrier.inset,carrier.z+CV.deckL/2-CW.carrier.inset);state.y=carrier.deck;
  }
  if(cargo.rider&&['warning','ride'].includes(cargo.phase)) {
    state.x=clamp(state.x,CW.cargo.x-CW.cargo.bayHalf,CW.cargo.x+CW.cargo.bayHalf);
    state.z=clamp(state.z,CW.cargo.z-CW.cargo.bayHalf,CW.cargo.z+CW.cargo.bayHalf);
    state.y=cargo.g.position.y;
  }
}
function cwTrail() {
  if(!carActive()||state.exploding)return;
  const t=connections.trail,last=t.at(-1);
  // A relocation or recovery is not a road segment to drive backwards along.
  if(last&&Math.hypot(state.x-last.x,state.z-last.z)>CW.trailResetDistance)t.length=0;
  if(!last||Math.hypot(state.x-last.x,state.z-last.z)>=CW.trailStep){t.push({x:state.x,z:state.z,y:state.y});if(t.length>CW.trailLimit)t.shift();}
  const n=cwRoadPoint(state.x,state.z),on=!!n&&n.road===connections.track&&n.distance<HW.spurW;
  if(on&&!connections.onTrack)connections.trackVisits++;
  connections.onTrack=on;
}
function cwRoadPoint(x,z) {
  let best=null;
  for(const road of highway.exits)for(let i=1;i<road.spur.length;i++) {
    const a=road.spur[i-1],b=road.spur[i],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz||1;
    const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/l2,0,1),px=a.x+t*dx,pz=a.z+t*dz,d=Math.hypot(x-px,z-pz);
    if(!best||d<best.distance)best={x:px,z:pz,y:lerp(a.y,b.y,t),distance:d,road};
  }return best;
}
function cwPoliceAim(c,i) {
  if(!connections.built||!connections.trail.length)return null;
  const t=connections.trail;let d=0;
  for(let j=t.length-1;j>0;j--){d+=Math.hypot(t[j].x-t[j-1].x,t[j].z-t[j-1].z);if(d>=CW.trailGap*(i+1))return t[j-1];}
  return null;
}
function cwBridge(dt) {
  const B=CW.bridge,b=harbor.bridge;if(!b)return;
  const x=state.x,near=carActive()&&Math.abs(state.z-B.roadZ)<B.radius;
  if(near&&police.active&&!connections.bridge&&connections.lastX!==null&&connections.lastX<=B.east+B.margin&&x>B.east+B.margin) {
    connections.bridge={phase:'warning',t:0};connections.crossings++;hbBridgeBells();
  }
  if(near)connections.lastX=x;
  const c=connections.bridge;if(!c)return;c.t+=dt;
  if(c.phase==='warning'&&c.t>=B.warning){c.phase='hold';c.t=0;b.want=1;hbBridgeHydraulics();}
  if(c.phase==='hold'){b.want=1;if(c.t>=B.hold){c.phase='close';b.want=0;}}
  if(c.phase==='close'){b.want=0;if(b.open<=0)connections.bridge=null;}
}
function cwPoliceWaiting(c,i) {
  const B=CW.bridge;
  const approaching=carActive()&&police.active&&state.x>B.west&&state.x<B.east+B.margin&&Math.abs(state.z-B.roadZ)<B.radius;
  if(!connections.bridge&&!approaching)return false;
  if(Math.abs(c.z-B.roadZ)>B.radius*2||c.x>B.east+B.margin)return false;
  c.x=Math.min(c.x,B.west-B.queue*(i+1));c.z=B.roadZ;c.y=hbRoadY(c.x);c.speed=0;
  return true;
}

const CONNECTION_POOL=evpRegister({name:'connections',policy:'standing',members:['carrier','cargo'].map(key=>({key,state:connections[key],force:()=>cwTransportStart(connections[key])}))});

function cwMergeStrips(meshes) {
  if(!meshes.length)return;
  const positions=[],normals=[];
  for(const m of meshes){const g=m.geometry.toNonIndexed();positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);g.dispose();m.geometry.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  const mesh=new THREE.Mesh(g,meshes[0].material);mesh.receiveShadow=true;scene.add(mesh);
}
function cwBeforeSwitch() {connections.carrier.rider=false;connections.cargo.rider=false;connections.trail=[];}
function cwRiding() {return carActive()&&[connections.carrier,connections.cargo].some(r=>r.rider&&['warning','ride'].includes(r.phase));}
