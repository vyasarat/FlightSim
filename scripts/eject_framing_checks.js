// Real altitude controls reproduce the landscape canopy clipping seen in video.
module.exports=async function ejectFramingChecks({newPage,check,shots}){
 for(const [w,h] of [[844,390],[390,844],[1024,768],[768,1024]]){
  const {page}=await newPage(w,h);
  await page.reload();await page.waitForFunction(()=>window.__lp);
  const step=s=>page.evaluate(s=>{__lp.noRender=true;for(let i=0;i<s*60;i++)__lp.update(1/60);},s);
  const cdp=await page.context().newCDPSession(page),touch=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{...p,id:1}]:[]});
  const centre=sel=>page.locator(sel).evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
  const tap=async sel=>{await touch('touchStart',await centre(sel));await touch('touchEnd');};
  await tap('[data-v="helicopter"]');await tap('[data-d="0"]');
  const hold=async(sel,s)=>{await touch('touchStart',await centre(sel));await step(s);await touch('touchEnd');await step(1);};
  await step(1);await hold('#heliUpBtn',4);await hold('#heliDownBtn',1.3);
  await tap('#ejectBtn');
  const result=await page.evaluate(()=>{
   const clips=[];let clipped=0,samples=0,impactVisible=false,worstTop=Infinity,worstBottom=-Infinity;
   const v=new THREE.Vector3(),bottom=el.dash.getBoundingClientRect().top;
   for(let frame=0;frame<60*30&&eject.active;frame++){
    __lp.update(1/60);camera.updateMatrixWorld(true);
    if(eject.canopyOpen&&eject.pool.root.visible&&eject.pool.canopy.visible&&frame%6===0){
     eject.pool.seat.updateMatrixWorld(true);let top=Infinity,low=-Infinity,left=Infinity,right=-Infinity;
     eject.pool.canopy.traverseVisible(o=>{if(!o.geometry)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).project(camera);const x=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2;top=Math.min(top,y);low=Math.max(low,y);left=Math.min(left,x);right=Math.max(right,x);}});
     samples++;worstTop=Math.min(worstTop,top);worstBottom=Math.max(worstBottom,low);if(top<2||low>bottom-2||left<2||right>innerWidth-2){clipped++;if(clips.length<8)clips.push({phase:eject.phase,t:eject.t,top,left,right,bounds:eject.pool.canopyBounds?.max.toArray()});}
    }
    if(eject.impact&&!impactVisible){v.fromArray(eject.events.contactPoint).project(camera);const x=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2;impactVisible=v.z<1&&x>2&&x<innerWidth-2&&y>2&&y<bottom-2;}
   }
   return{clips,clipped,samples,worstTop,worstBottom,bottom,impactVisible,returned:eject.last?.returned};
  });
  check(`rescue framing ${w}x${h}: full canopy and ground contact remain visible after an altitude-control flight`,result.clipped===0&&result.samples>20&&result.impactVisible&&result.returned,JSON.stringify(result));
  await page.close();
 }
};
