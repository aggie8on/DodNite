import * as THREE from 'three'; import './style.css';

const scene=new THREE.Scene(); scene.background=new THREE.Color(0x10141a); scene.fog=new THREE.Fog(0x10141a,35,150);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,300); camera.position.set(0,2,8);
const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xb8d7ff,0x252015,1.5)); const sun=new THREE.DirectionalLight(0xffffff,2); sun.position.set(30,60,20); sun.castShadow=true; scene.add(sun);
const world=new THREE.Group(); scene.add(world);
const mat=(c:number)=>new THREE.MeshToonMaterial({color:c});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),mat(0x343a38)); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; world.add(ground);
function box(x:number,z:number,w:number,h:number,d:number,c=0x56605b){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,h/2,z);m.castShadow=true;m.receiveShadow=true;world.add(m);return m}
for(let i=0;i<55;i++){const x=(Math.random()-.5)*150,z=(Math.random()-.5)*150;if(Math.hypot(x,z)<15)continue;box(x,z,5+Math.random()*8,5+Math.random()*18,5+Math.random()*8,Math.random()<.25?0x25302d:0x4a514e)}
for(let i=0;i<35;i++){const x=(Math.random()-.5)*160,z=(Math.random()-.5)*160;if(Math.hypot(x,z)<25)continue;const trunk=box(x,z,.7,4+Math.random()*3,.7,0x40352b);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(2.5+Math.random()*2,0),mat(0x273f2a));crown.position.set(x,trunk.position.y+3,z);crown.castShadow=true;world.add(crown)}
for(let i=0;i<18;i++){const x=(Math.random()-.5)*100,z=(Math.random()-.5)*100;box(x,z,2,.5,1.5,0x6c6253)}
const keys=new Set<string>(); addEventListener('keydown',e=>keys.add(e.code)); addEventListener('keyup',e=>keys.delete(e.code));
let yaw=0,pitch=0,velY=0,locked=false,hp=100,score=0,wave=1,lastShot=0; const enemies:{m:THREE.Group,h:number}[]=[];
const hud={wave:document.querySelector('#wave')!,score:document.querySelector('#score')!,hp:document.querySelector('#hp')!,start:document.querySelector('#start') as HTMLElement};
function spawn(){const g=new THREE.Group();const body=new THREE.Mesh(new THREE.CapsuleGeometry(.65,1.4,4,8),mat(0xd85c4f));body.position.y=1.4;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.48,8,6),mat(0x262626));head.position.y=2.65;g.add(head);let a=Math.random()*Math.PI*2,r=25+Math.random()*30;g.position.set(Math.cos(a)*r,0,Math.sin(a)*r);world.add(g);enemies.push({m:g,h:3})}
function nextWave(){wave++;for(let i=0;i<3+wave*2;i++)spawn();hud.wave.textContent=String(wave)}
function shoot(){const now=performance.now();if(now-lastShot<150)return;lastShot=now;const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);const hits=ray.intersectObjects(enemies.flatMap(e=>e.m.children),true);if(hits.length){let o=hits[0].object;const e=enemies.find(e=>e.m===o.parent||e.m===o.parent?.parent);if(e){e.h--;score+=100;if(e.h<=0){world.remove(e.m);enemies.splice(enemies.indexOf(e),1);score+=250;if(!enemies.length)nextWave()}}}hud.score.textContent=String(score)}
renderer.domElement.addEventListener('click',()=>{if(!locked)renderer.domElement.requestPointerLock();else shoot()}); document.addEventListener('pointerlockchange',()=>locked=document.pointerLockElement===renderer.domElement); document.addEventListener('mousemove',e=>{if(!locked)return;yaw-=e.movementX*.002;pitch-=e.movementY*.002;pitch=Math.max(-1.4,Math.min(1.4,pitch))});
document.querySelector('#play')!.addEventListener('click',()=>renderer.domElement.requestPointerLock());
for(let i=0;i<5;i++)spawn();
let prev=performance.now();function loop(t:number){const dt=Math.min((t-prev)/1000,.05);prev=t;
camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;const speed=keys.has('ShiftLeft')?11:7;const f=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));const r=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));const dir=new THREE.Vector3();if(keys.has('KeyW'))dir.add(f);if(keys.has('KeyS'))dir.sub(f);if(keys.has('KeyD'))dir.add(r);if(keys.has('KeyA'))dir.sub(r);if(dir.lengthSq())dir.normalize();camera.position.addScaledVector(dir,speed*dt);
if(keys.has('Space')&&camera.position.y<=2.01)velY=8;velY-=22*dt;camera.position.y+=velY*dt;if(camera.position.y<2){camera.position.y=2;velY=0}
for(const e of [...enemies]){const d=camera.position.clone().sub(e.m.position);d.y=0;const dist=d.length();if(dist>1.8)e.m.position.addScaledVector(d.normalize(),dt*(2.2+wave*.12));else{hp-=dt*10;hud.hp.textContent=String(Math.max(0,Math.floor(hp)));if(hp<=0){hp=100;score=Math.max(0,score-500);camera.position.set(0,2,8)}}}
renderer.render(scene,camera);requestAnimationFrame(loop)}requestAnimationFrame(loop); addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
