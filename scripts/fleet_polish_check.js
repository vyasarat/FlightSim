// Matched artwork fixtures, not gameplay: fixed camera, lights, seed and viewports.
const {chromium}=require('playwright-core'),{serve}=require('./polish_check');
const {once}=require('events'),fs=require('fs'),path=require('path');
(async()=>{
 const tag=process.argv[2]||'after',out=path.resolve(__dirname,'../docs/helicopter-polish',tag,'fleet');fs.mkdirSync(out,{recursive:true});
 const server=serve(process.env.LP_POLISH_ROOT||path.resolve(__dirname,'..'),0);await once(server,'listening');
 const browser=await chromium.launch({executablePath:process.env.CHROME_HEADLESS_SHELL,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const samples=[];
 try{for(const [width,height] of [[1024,768],[390,844]])for(const key of ['prop','fighter','airlinerDelta','airlinerEmirates','rocket','starship','rover','drone']){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;localStorage.clear();});
 await page.goto(`http://127.0.0.1:${server.address().port}/cockpit/`);await page.waitForFunction(()=>window.__lp);
 const sample=await page.evaluate(key=>{
 let model;
 if(key==='rover'){buildRover();model=rover.mesh;}
 else if(key==='drone'){mars.body={x:0,y:-1000,z:0,r:1000};mars.n.set(0,1,0);mars.x=0;mars.y=0;mars.z=0;marsBuildDrone(new THREE.Group());model=mars.drone.g;}
 else{buildVehicleModel(key);model=vehicleModel;if(model.userData.flame)model.userData.flame.visible=false;}
 model.parent.remove(model);model.visible=true;model.position.set(0,0,0);model.rotation.set(0,0,0);model.scale.setScalar(1);
 if(model.userData.rocket){model.rotation.x=Math.PI/2;for(const k of ['engineGlow','padHeat'])if(model.userData[k])model.userData[k].visible=false;}
 const art=new THREE.Scene();art.background=new THREE.Color(TUNE.palette.sand);art.add(model);
 const bounds=new THREE.Box3();model.updateMatrixWorld(true);model.traverse(o=>{if(o.isMesh&&o.visible&&!o.material.transparent){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});
 const size=bounds.getSize(new THREE.Vector3()),ctr=bounds.getCenter(new THREE.Vector3());model.position.sub(ctr);model.position.y+=size.y/2;
 const light=new THREE.DirectionalLight(0xfff0d8,1);light.position.set(-10,16,-10);art.add(light,new THREE.HemisphereLight(0xd9edff,0xb6a080,.8));
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshPhongMaterial({color:TUNE.palette.sand}));floor.rotation.x=-Math.PI/2;floor.position.y=-.03;art.add(floor);
 const cam=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.1,500);const span=key==='rocket'?18:key==='starship'?22:key==='rover'?6.5:key==='drone'?9:20;
 const dist=span*1.7*Math.max(1,.9/cam.aspect);cam.position.set(dist*.55,dist*.43,dist*-.76);cam.lookAt(0,size.y*.48,0);
 document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.display='none');
 const gl=renderer.getContext(),pixel=new Uint8Array(4),times=[];for(let i=0;i<24;i++){const t=performance.now();renderer.render(art,cam);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);if(i>=4)times.push(performance.now()-t);}times.sort((a,b)=>a-b);
 return {key,viewport:[innerWidth,innerHeight],resolution:[gl.drawingBufferWidth,gl.drawingBufferHeight],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs.length,medianMs:times[10],p95Ms:times[19],bounds:size.toArray()};
 },key);await page.screenshot({path:path.join(out,`${key}-${width}x${height}.png`)});samples.push(sample);console.log(JSON.stringify(sample));await page.close();
 }}finally{fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({environment:'SwiftShader, macOS arm64, fixed artwork fixtures; not gameplay FPS or physical iPad',samples},null,2));await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
