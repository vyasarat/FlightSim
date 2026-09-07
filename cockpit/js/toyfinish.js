"use strict";
// Toy finish helpers. Geometry is created once per owning pool; no frame allocations.
// A bevelled unit cube keeps its exact +/- .5 bounds, including the pickup face.
function toyBevelGeometry() {
  const positions=[],normals=[],core=.42;
  const point=(axis,sign,a,b)=>{const v=[0,0,0];v[axis]=sign*.5;v[(axis+1)%3]=a;v[(axis+2)%3]=b;return v;};
  const face=vertices=>{
    // Orient triangles outwards, keeping the broad face normal exactly axial.
    const a=new THREE.Vector3(...vertices[0]),b=new THREE.Vector3(...vertices[1]),c=new THREE.Vector3(...vertices[2]);
    if(b.sub(a).cross(c.sub(a)).dot(a)<0)vertices.reverse();
    for(let i=1;i<vertices.length-1;i++)for(const v of [vertices[0],vertices[i],vertices[i+1]]){
      positions.push(...v);const n=v.map(x=>Math.abs(x)>.49?Math.sign(x):0);normals.push(...n);
    }
  };
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1])face([point(axis,sign,-core,-core),point(axis,sign,core,-core),point(axis,sign,core,core),point(axis,sign,-core,core)]);
  for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)for(const sa of [-1,1])for(const sb of [-1,1]){
    const free=3-a-b,verts=[];
    for(const [dominant,end] of [[a,-1],[b,-1],[b,1],[a,1]]){const v=[0,0,0];v[a]=sa*(dominant===a?.5:core);v[b]=sb*(dominant===b?.5:core);v[free]=end*core;verts.push(v);}face(verts);
  }
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])face([[x*.5,y*core,z*core],[x*core,y*.5,z*core],[x*core,y*core,z*.5]]);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return geo;
}

function toyHelicopter(g, colors) {
  const C = TUNE.palette;
  const paint = new THREE.MeshPhongMaterial({color:colors[0],shininess:65,specular:C.ink,flatShading:false});
  const cream = new THREE.MeshPhongMaterial({color:C.white,shininess:40,flatShading:false});
  const rubber = new THREE.MeshPhongMaterial({color:C.ink,shininess:12,flatShading:false});
  const glass = new THREE.MeshPhongMaterial({color:C.sea,shininess:100,specular:C.white,flatShading:false});
  const metal = new THREE.MeshPhongMaterial({color:C.steel,shininess:80,flatShading:false});
  const gold = new THREE.MeshPhongMaterial({color:C.warning,shininess:50,flatShading:false});
  const ball = new THREE.SphereGeometry(1,12,8), box=toyBevelGeometry(), thinBox=new THREE.BoxGeometry(1,1,1), tube=new THREE.CylinderGeometry(1,1,1,12);
  const part=(parent,geo,mat,x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(geo===box&&Math.min(sx,sy,sz)<.3?thinBox:geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;};
  part(g,ball,paint,0,0,-.35,1.72,1.57,2.55).userData.toyCaster=true;
  part(g,ball,cream,0,-.67,-.45,1.62,.84,2.31);
  // Broad blue glazing is opaque: no sorting seams or background through the cabin.
  part(g,ball,glass,0,.38,-1.38,1.5,1.13,1.48);
  part(g,box,cream,0,.5,-2.76,.09,1.22,.07).rotation.x=-.23;
  for(const s of [-1,1]){
    part(g,box,paint,s*1.57,.2,-.25,.12,1.8,.15).rotation.x=-.12;
    part(g,box,metal,s*1.67,-.22,-.18,.1,.1,.46);
    part(g,tube,metal,s*1.27,-1.2,-.85,.09,.85,.09).rotation.z=s*.3;
    part(g,tube,metal,s*1.27,-1.2,1,.09,.85,.09).rotation.z=s*.3;
    part(g,box,rubber,s*1.42,-1.6,.1,.24,.22,4.05);
    part(g,ball,rubber,s*1.42,-1.5,-1.85,.12,.2,.3);
  }
  part(g,tube,paint,0,.1,2.9,.25,4.4,.25).rotation.x=Math.PI/2;
  part(g,box,paint,0,.74,4.72,.2,1.65,1.05).rotation.x=-.25;
  part(g,box,cream,0,.13,4,2.05,.12,.66);
  part(g,ball,paint,0,1.32,.25,.83,.6,1.16);
  part(g,box,rubber,0,1.55,.76,.66,.14,.5);
  const rotor=new THREE.Group();rotor.position.y=2.05;g.add(rotor);g.userData.rotor=rotor;
  part(rotor,tube,metal,0,-.1,0,.12,.65,.12);
  part(rotor,ball,gold,0,.18,0,.3,.18,.3);
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2;
    part(rotor,box,rubber,Math.cos(a)*2.5,0,Math.sin(a)*2.5,4.5,.065,.34).rotation.y=-a;
    part(rotor,box,gold,Math.cos(a)*4.53,.005,Math.sin(a)*4.53,.42,.075,.35).rotation.y=-a;
  }
  // Casters use the readable shell and blades. Small fittings share that shadow.
  for(const m of rotor.children)if(m.isMesh&&m.material===rubber)m.userData.toyCaster=true;
  const tr=new THREE.Group();tr.position.set(.3,.8,4.72);g.add(tr);g.userData.tailRotor=tr;
  part(tr,box,rubber,0,0,0,.08,1.85,.2);
  part(tr,box,rubber,0,0,0,.08,.2,1.85);
  part(tr,ball,gold,.08,0,0,.13,.18,.18);
  // Very faint annulus suggests motion without hiding the cable or cargo.
  const blur=new THREE.Mesh(new THREE.RingGeometry(.8,4.7,40),new THREE.MeshBasicMaterial({color:C.steel,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
  blur.rotation.x=-Math.PI/2;rotor.add(blur);g.userData.rotorBlur=blur;g.userData.rotorSpeed=0;
}

function twFinishYard(yard) {
  const C=TUNE.palette, g=yard.g;
  // A single reusable stipple texture gives the mat a tactile surface at every angle.
  if (!twGeo.matTexture) {
    const size=128,data=new Uint8Array(size*size*4),c=new THREE.Color(C.sand);
    for(let i=0;i<size*size;i++){
      const f=.94+((i*73^(i>>3)*151)&255)/255*.06;
      data[i*4]=c.r*255*f;data[i*4+1]=c.g*255*f;data[i*4+2]=c.b*255*f;data[i*4+3]=255;
    }
    const tex=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(12,12);tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;
    twGeo.matTexture=tex;
    twGeo.floorMaterial=new THREE.MeshPhongMaterial({color:C.white,map:tex,shininess:5,flatShading:false});
  }
  const floor=g.children[0];floor.geometry=twGeo.disc;floor.material=twGeo.floorMaterial;floor.receiveShadow=false;
  // Keep large planar faces quiet; edge radii and highlights describe the toy.
  g.traverse(m=>{
    if(!m.isMesh)return;
    if(m.geometry===twGeo.box && m.scale.y>2 && m.scale.x>2 && m.scale.z>2)m.geometry=twGeo.round;
    if(m.geometry===twGeo.cylinder && m.scale.x>8){
      m.geometry=twGeo.disc;
      if(m.material.color.getHex()!==C.warning)return;
      const key='matte:'+m.material.color.getHex();
      if(!twMats.has(key))twMats.set(key,new THREE.MeshPhongMaterial({color:m.material.color,shininess:0,specular:0x000000,flatShading:false}));
      m.material=twMats.get(key);
    }
  });
  // A quiet landing symbol at the open entrance, outside every cargo footprint.
  const hx=-yard.side*38,hz=yard.side*75;
  twPart(g,'disc',C.blue,hx,.1,hz,14,.2,14);
  for(const x of [-4,4])twPart(g,'round',C.white,hx+x,.23,hz,2,.15,13);
  twPart(g,'round',C.white,hx,.23,hz,8,.15,2);
  for(let i=1;i<=12;i++) {const edge=g.children[i];edge.geometry=twGeo.round;edge.rotation.y=-Math.atan2(edge.position.z,edge.position.x)+Math.PI/2;}
  // Grounding uses the shared contact pool; no extra sun-map passes for toys.
  // An inset target and four white docking marks read as delivery, not loose cargo.
  const px=yard.side*48,pz=-yard.side*45;
  twPart(g,'disc',C.sea,px,.64,pz,TW.playground.deliveryR-2,.12,TW.playground.deliveryR-2);
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2,m=twPart(g,'round',C.white,px+Math.cos(a)*16,.77,pz+Math.sin(a)*16,5,.15,1.2);m.rotation.y=-a+Math.PI/2;
  }
  // Rubber feet ground the machinery; nothing added to the target's approach path.
  const crane=yard.arm.parent;
  twPart(crane,'round',C.slate,0,1,0,13,2,13);
  twPart(crane,'round',C.warning,0,4,0,9,5,9);
  twPart(crane,'round',C.blue,-yard.side*7,9,0,8,9,9);
  twPart(crane,'round',C.sea,-yard.side*7,10,4.55,6,5,.15);
  for(const z of [-3,3])twPart(crane,'disc',C.steel,-yard.side*11.1,6,z,1,.2,1).rotation.z=Math.PI/2;
  yard.lamp.userData.twDynamic=true;
  toyMergeFittings(g, false);
  for(const o of toyWorld.objects.filter(o=>o.yard===yard)){
    o.g.children[0].geometry=twGeo.round;o.g.children[0];
    if(o.kind===1){
      o.g.children[1].geometry=twGeo.round; o.g.children[1].position.y=o.h/2+1.5;
      // Keep the cabin's existing top exactly at twCargoTop(o).
      for(const sx of [-1,1])twPart(o.g,'round',C.white,sx*2.7,.4,-6.05,1.4,1.2,.2);
    }
  }
}

function twBuildDownwash() {
  const size=32,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1);
    data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.pow(Math.max(0,1-r),2)*255;
  }
  const tex=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);tex.magFilter=THREE.LinearFilter;tex.needsUpdate=true;
  toyWorld.softTexture=tex;
  const mat=new THREE.MeshBasicMaterial({color:TUNE.palette.sand,map:tex,transparent:true,opacity:0,depthWrite:false});
  toyWorld.downwash=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),mat,8);toyWorld.downwash.instanceMatrix.setUsage(THREE.DynamicDrawUsage);toyWorld.downwash.frustumCulled=false;toyWorld.downwash.visible=false;
  toyWorld.downwashDummy=new THREE.Object3D();toyWorld.root.add(toyWorld.downwash);
}
function twUpdateFinish(dt) {
  twUpdateContacts();
  const F=TW.finish,dust=toyWorld.downwash,yard=heliActive()&&twNearYard();
  const height=yard?state.y-yard.y:1000;
  const want=yard&&state.phase==='AIRBORNE'&&!state.exploding&&!menuOpen()&&height<F.dustHeight ? F.dustOpacity*(1-height/(F.dustHeight+4)) : 0;
  dust.material.opacity+=(want-dust.material.opacity)*(1-Math.exp(-dt*F.dustResponse));dust.visible=dust.material.opacity>.004;
  if(!dust.visible)return;
  const d=toyWorld.downwashDummy;
  for(let i=0;i<8;i++){
    const f=(toyWorld.clock*.55+i/8)%1,a=i*2.4+toyWorld.clock*.18,r=3+f*13;
    d.position.set(state.x+Math.cos(a)*r,(yard?yard.y:twFloor(state.x,state.z))+.18+f*.5,state.z+Math.sin(a)*r);
    d.rotation.set(-Math.PI/2,0,a);d.scale.setScalar(Math.sin(f*Math.PI)*9);d.updateMatrix();dust.setMatrixAt(i,d.matrix);
  }
  dust.instanceMatrix.needsUpdate=true;
}

function twBuildContacts() {
  const geo=new THREE.PlaneGeometry(1,1),count=toyWorld.objects.length+1+toyWorld.yards.length*2;
  geo.setAttribute('instanceOpacity',new THREE.InstancedBufferAttribute(new Float32Array(count),1).setUsage(THREE.DynamicDrawUsage));
  const mat=new THREE.MeshBasicMaterial({color:TUNE.palette.ink,map:toyWorld.softTexture,transparent:true,opacity:.65,depthWrite:false});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float instanceOpacity; varying float toyOpacity;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n toyOpacity=instanceOpacity;');
    shader.fragmentShader='varying float toyOpacity;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.a *= toyOpacity;');
  };
  const mesh=toyWorld.contacts=new THREE.InstancedMesh(geo,mat,count);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.renderOrder=1;toyWorld.root.add(mesh);
  toyWorld.contactDummy=new THREE.Object3D();
}
function twUpdateContacts() {
  const mesh=toyWorld.contacts,d=toyWorld.contactDummy,alpha=mesh.geometry.attributes.instanceOpacity;
  mesh.visible=!eject.active;
  for(let i=0;i<=toyWorld.objects.length;i++){
    const o=toyWorld.objects[i],x=o?o.x:state.x,z=o?o.z:state.z,y=o?o.y-o.h/2:state.y;
    const floor=twFloor(x,z),height=Math.max(0,y-floor),spread=1+Math.min(height,60)*.012;
    d.position.set(x,floor+.12,z);d.rotation.set(-Math.PI/2,0,o?-o.g.rotation.y:0);
    d.scale.set((o?o.w+5:12)*spread,(o?o.d+5:12)*spread,1);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);
    const visible=o?o.g.visible&&o.yard.g.visible:heliActive()&&!!twNearYard()&&!state.exploding&&!eject.active;
    alpha.setX(i,visible?Math.exp(-height*.045):0);
  }
  let i=toyWorld.objects.length+1;
  for(const yard of toyWorld.yards)for(const [x,z,w,h] of [[TW.playground.craneX,TW.playground.craneZ,24,24],[TW.playground.displayX,TW.playground.displayZ,40,25]]){
    d.position.set(yard.x+yard.side*x,yard.y+.14,yard.z+yard.side*z);d.rotation.set(-Math.PI/2,0,0);d.scale.set(w,h,1);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);alpha.setX(i++,yard.g.visible?.8:0);
  }
  alpha.needsUpdate=true;mesh.instanceMatrix.needsUpdate=true;
}

// Bake static helicopter fittings by material within each moving group. The
// merged buffers live with the vehicle and are disposed once on vehicle change.
function toyMergeFittings(root, disposeSources = true) {
  const discarded=new Set();
  const merge=parent=>{
    for(const child of parent.children)if(child.isGroup)merge(child);
    const groups=new Map();
    for(const m of parent.children){
      if(!m.isMesh||!m.visible||m.userData.twDynamic||m.material.transparent)continue;
      const key=m.material.id+':'+m.castShadow;
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);
    }
    for(const meshes of groups.values()){
      if(meshes.length<2)continue;
      const positions=[],normals=[],support=[];
      for(const m of meshes){
        m.updateMatrix();
        if(m.userData.toySupportPoints){for(const v of m.userData.toySupportPoints)support.push(new THREE.Vector3(...v).applyMatrix4(m.matrix).toArray());}
        else{m.geometry.computeBoundingBox();const b=m.geometry.boundingBox;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])support.push(new THREE.Vector3(x,y,z).applyMatrix4(m.matrix).toArray());}
        const geo=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();geo.applyMatrix4(m.matrix);
        positions.push(...geo.attributes.position.array);normals.push(...geo.attributes.normal.array);
        geo.dispose();discarded.add(m.geometry);parent.remove(m);
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
      const mesh=new THREE.Mesh(geo,meshes[0].material);mesh.castShadow=meshes[0].castShadow;mesh.userData.toySupportPoints=support;parent.add(mesh);
    }
  };
  merge(root);root.traverse(o=>{if(o.geometry)discarded.delete(o.geometry);});if(disposeSources)discarded.forEach(g=>g.dispose());
}

// The fleet uses the same paint/glazing vocabulary. This touches owned artwork
// only: original transforms, stage groups, wheel/leg references and bounds stay put.
function toyFinishFleet(root, key) {
  const C=TUNE.palette, materials=new Map(), geometries=new Map(), oldGeometries=new Set();
  root.traverse(m=>{
    if(!m.isMesh)return;
    const old=m.material;
    if(old.isMeshLambertMaterial){
      if(!materials.has(old))materials.set(old,new THREE.MeshPhongMaterial({color:old.color,emissive:old.emissive,emissiveIntensity:old.emissiveIntensity,side:old.side,transparent:old.transparent,opacity:old.opacity,depthWrite:old.depthWrite,flatShading:false,shininess:old.color.getHex()===C.ink?12:55,specular:old.color.getHex()===C.ink?C.ink:C.steel}));
      m.material=materials.get(old);
    }
    if(m.geometry.type==='BoxGeometry'){
      const p=m.geometry.parameters,k=[p.width,p.height,p.depth].join(':');
      if(!geometries.has(k)){const geo=toyBevelGeometry();geo.scale(p.width,p.height,p.depth);geometries.set(k,geo);}
      oldGeometries.add(m.geometry);m.geometry=geometries.get(k);
    }
    if(m.userData.leg)m.userData.twDynamic=true;
  });
  materials.forEach((_,old)=>old.dispose());oldGeometries.forEach(geo=>geo.dispose());
  const glass=new THREE.MeshPhongMaterial({color:C.sea,specular:C.white,shininess:100,flatShading:false});
  const cream=new THREE.MeshPhongMaterial({color:C.white,shininess:45,flatShading:false});
  const metal=new THREE.MeshPhongMaterial({color:C.steel,shininess:85,flatShading:false});
  const box=toyBevelGeometry(),sphere=new THREE.SphereGeometry(1,12,8);
  const part=(g,geo,mat,x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m;};
  if(key.startsWith('airliner')){
    // Wide cockpit mask and small, evenly spaced cabin windows read at chase scale.
    part(root,sphere,glass,0,.47,-6.75,.82,.37,.65);
    for(const s of [-1,1])for(let i=0;i<9;i++)part(root,box,glass,s*1.01,.28,-4.7+i*1.05,.08,.3,.36);
    for(const s of [-1,1]){
      part(root,sphere,cream,s*2.6,-.75,-1.35,.48,.48,.85);
      part(root,sphere,glass,s*2.6,-.75,-2,.33,.33,.1);
    }
  }else if(key==='prop'){
    part(root,sphere,glass,0,.73,-.5,.71,.6,1.23);
    part(root,box,cream,0,1.29,-.25,.11,.08,1.35);
    part(root,sphere,cream,0,0,-3.05,.38,.38,.4);
    root.userData.propDisc.material.opacity=.19;
  }else if(key==='fighter'){
    // Replace the bead-like cockpit with an elongated canopy along the fuselage.
    const canopy=root.children.find(m=>m.isMesh&&m.geometry.type==='SphereGeometry');
    if(canopy){canopy.scale.set(.92,.8,2.6);canopy.material.dispose();canopy.material=glass;}
    part(root,box,cream,0,.93,-3.6,.08,.07,1.5);
  }else if(key==='rover'){
    // Camera lenses and panel dividers give the buggy a friendly, readable face.
    for(const x of [.46,.74])part(root,sphere,glass,x,3.16,1.51,.09,.09,.055);
    for(const x of [-.55,0,.55])part(root,box,metal,x,1.646,-.4,.025,.012,2.1);
    for(const z of [-.95,-.4,.15])part(root,box,metal,0,1.646,z,2.1,.012,.025);
    for(const w of rover.wheels)w.userData.twDynamic=true;
  }else if(key==='drone'){
    for(const x of [-.38,.38])part(root,sphere,glass,x,1.78,.85,.21,.21,.1);
    part(root,box,cream,0,1.17,.85,.65,.09,.08);
    for(const x of [-.38,0,.38])part(root,box,metal,x,3.946,0,.018,.012,1.4);
  }else if(root.userData.rocket){
    const p=root.userData.rocket;
    // Shallow collar rings articulate the stages without changing their contact ends.
    const ring=new THREE.TorusGeometry(key==='starship'?1.185:.985,.025,4,18);
    for(const z of (key==='starship'?[1.4,4,7.6]:[.5,3.8,6.6]))part(p.booster,ring,metal,0,0,z,1,1,1);
    for(const z of (key==='starship'?[-4.6,-2.3]:[-2.9]))part(p.stage2,ring,metal,0,0,z,1,1,1);
  }
  if(root.userData.flame)root.userData.flame.userData.twDynamic=true;
  // Shared temporary primitives/materials may be unused by a particular family.
  const usedGeometries=new Set(),usedMaterials=new Set();root.traverse(m=>{if(m.geometry)usedGeometries.add(m.geometry);if(m.material)usedMaterials.add(m.material);});
  for(const geo of [box,sphere])if(!usedGeometries.has(geo))geo.dispose();
  for(const mat of [glass,cream,metal])if(!usedMaterials.has(mat))mat.dispose();
  toyMergeFittings(root);
}
