import * as THREE from 'three';
import './style.css';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10151b);
scene.fog = new THREE.Fog(0x10151b, 28, 135);

const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.08, 320);
camera.position.set(0, 2, 8);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x201812, 1.55));
const sun = new THREE.DirectionalLight(0xffffff, 2.1);
sun.position.set(35, 55, 18);
sun.castShadow = true;
scene.add(sun);

const world = new THREE.Group();
scene.add(world);

const toon = (color: number) => new THREE.MeshToonMaterial({ color });
const outline = (geometry: THREE.BufferGeometry, color = 0x101010) => {
  const mesh = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 22), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .7 }));
  mesh.renderOrder = 3;
  return mesh;
};
function prop(mesh: THREE.Mesh, outlined = true) {
  mesh.castShadow = true; mesh.receiveShadow = true; world.add(mesh);
  if (outlined) mesh.add(outline(mesh.geometry));
  return mesh;
}
function box(x:number,z:number,w:number,h:number,d:number,c=0x59615e) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), toon(c));
  m.position.set(x,h/2,z); return prop(m);
}

const ground = new THREE.Mesh(new THREE.PlaneGeometry(260,260), toon(0x303735));
ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; world.add(ground);

// Abandoned-city blocks and doodle-like props.
for (let i=0;i<70;i++) {
  const x=(Math.random()-.5)*175, z=(Math.random()-.5)*175;
  if (Math.hypot(x,z)<17) continue;
  const w=4+Math.random()*9, d=4+Math.random()*9, h=4+Math.random()*19;
  box(x,z,w,h,d,Math.random()<.22?0x26302e:0x4c5551);
}
for (let i=0;i<46;i++) {
  const x=(Math.random()-.5)*185, z=(Math.random()-.5)*185;
  if (Math.hypot(x,z)<22) continue;
  const trunk=box(x,z,.65,3.5+Math.random()*3,.65,0x45372b);
  const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(2.2+Math.random()*2.2,0),toon(0x29412d));
  crown.position.set(x,trunk.position.y+2.7,z); prop(crown);
}
for(let i=0;i<26;i++) {
  const x=(Math.random()-.5)*120,z=(Math.random()-.5)*120;
  const crate=box(x,z,1.6,.9,1.6,0x75614c);
  crate.userData.destructible=true;
}

type Enemy = { m: THREE.Group; hp: number; speed: number; kind: 'grunt'|'runner'|'tank' };
const enemies: Enemy[] = [];
const projectiles: THREE.Mesh[] = [];
const keys = new Set<string>();

let yaw=0,pitch=0,velY=0,locked=false;
let hp=100,score=0,wave=1,kills=0;
let grounded=true,jumps=0,slideUntil=0,dashUntil=0,lastDash=0,lastShot=0;
let weaponIndex=0;
const weapons = [
  {name:'RIFLE', damage:1, cooldown:105, pellets:1, spread:.012},
  {name:'SHOTGUN', damage:2, cooldown:620, pellets:8, spread:.075},
  {name:'SNIPER', damage:7, cooldown:900, pellets:1, spread:.002},
  {name:'KATANA', damage:5, cooldown:430, pellets:1, spread:0},
  {name:'GRENADE', damage:10, cooldown:850, pellets:1, spread:.02}
];

const hud = {
  wave:document.querySelector('#wave') as HTMLElement,
  score:document.querySelector('#score') as HTMLElement,
  hp:document.querySelector('#hp') as HTMLElement,
  weapon:document.querySelector('#weapon') as HTMLElement,
  ammo:document.querySelector('#ammo') as HTMLElement,
  message:document.querySelector('#message') as HTMLElement,
  start:document.querySelector('#start') as HTMLElement
};

function updateHud() {
  hud.wave.textContent=String(wave); hud.score.textContent=String(score);
  hud.hp.textContent=String(Math.max(0,Math.floor(hp)));
  hud.weapon.textContent=weapons[weaponIndex].name;
  hud.ammo.textContent=weaponIndex===4?'∞':'READY';
}
function flash(text:string) {
  hud.message.textContent=text; hud.message.classList.add('show');
  setTimeout(()=>hud.message.classList.remove('show'),650);
}
function spawn(kind?: Enemy['kind']) {
  const types: Enemy['kind'][]=['grunt','grunt','runner','tank'];
  const k=kind ?? types[Math.floor(Math.random()*types.length)];
  const g=new THREE.Group();
  const bodyColor=k==='tank'?0x7d4d4d:k==='runner'?0xe18d46:0xd85c4f;
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(k==='tank'?.8:.62,k==='tank'?1.8:1.35,4,8),toon(bodyColor));
  body.position.y=k==='tank'?1.55:1.35; g.add(body); body.add(outline(body.geometry));
  const head=new THREE.Mesh(new THREE.SphereGeometry(k==='tank'?.58:.46,8,6),toon(0x252525));
  head.position.y=k==='tank'?2.95:2.55; g.add(head); head.add(outline(head.geometry));
  const a=Math.random()*Math.PI*2,r=28+Math.random()*40;
  g.position.set(Math.cos(a)*r,0,Math.sin(a)*r); world.add(g);
  enemies.push({m:g,hp:k==='tank'?10:k==='runner'?2:3,speed:k==='tank'?1.55:k==='runner'?4.1:2.35,kind:k});
}
function startWave() {
  for(let i=0;i<4+wave*2;i++) spawn();
  flash('WAVE '+wave);
}
function killEnemy(e:Enemy) {
  world.remove(e.m); enemies.splice(enemies.indexOf(e),1);
  score += e.kind==='tank'?700:350; kills++;
  if(!enemies.length) { wave++; score+=1000; startWave(); }
  updateHud();
}

function hitScan(damage:number, spread:number) {
  const ray=new THREE.Raycaster();
  const dir=new THREE.Vector3(0,0,-1);
  dir.x += (Math.random()-.5)*spread; dir.y += (Math.random()-.5)*spread;
  dir.normalize(); ray.setFromCamera(new THREE.Vector2(0,0),camera);
  ray.ray.direction.copy(dir).applyQuaternion(camera.quaternion);
  const targets=enemies.flatMap(e=>e.m.children);
  const hits=ray.intersectObjects(targets,true);
  if(!hits.length) return;
  let obj:THREE.Object3D|null=hits[0].object;
  let owner:Enemy|undefined;
  while(obj) { owner=enemies.find(e=>e.m===obj); if(owner) break; obj=obj.parent; }
  if(owner) { owner.hp-=damage; score+=50; if(owner.hp<=0) killEnemy(owner); updateHud(); }
}

function fire() {
  const now=performance.now(), w=weapons[weaponIndex];
  if(now-lastShot<w.cooldown || !locked) return;
  lastShot=now;
  if(weaponIndex===3) {
    // Katana slash: short cone represented by several close ray checks.
    for(let i=-2;i<=2;i++) hitScan(w.damage,Math.abs(i)*.045+.015);
    flash('PARRY READY');
  } else if(weaponIndex===4) {
    const grenade=new THREE.Mesh(new THREE.SphereGeometry(.18,8,8),toon(0x3d453e));
    grenade.position.copy(camera.position);
    grenade.userData.velocity=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).multiplyScalar(22);
    grenade.userData.life=1.15; world.add(grenade); projectiles.push(grenade);
  } else {
    for(let i=0;i<w.pellets;i++) hitScan(w.damage,w.spread);
  }
  updateHud();
}

function switchWeapon(n:number) {
  weaponIndex=(n+weapons.length)%weapons.length; updateHud(); flash(weapons[weaponIndex].name);
}
function resetPlayer() {
  hp=100; score=Math.max(0,score-500); camera.position.set(0,2,8); velY=0;
  updateHud(); flash('RESPAWN');
}

addEventListener('keydown',e=>{
  keys.add(e.code);
  if(e.code==='Digit1') switchWeapon(0);
  if(e.code==='Digit2') switchWeapon(1);
  if(e.code==='Digit3') switchWeapon(2);
  if(e.code==='Digit4') switchWeapon(3);
  if(e.code==='Digit5') switchWeapon(4);
  if(e.code==='KeyQ') switchWeapon(weaponIndex-1);
  if(e.code==='KeyE') switchWeapon(weaponIndex+1);
  if(e.code==='Space' && grounded) { velY=9; grounded=false; jumps=1; }
  else if(e.code==='Space' && !grounded && jumps<2) { velY=8.5; jumps=2; flash('DOUBLE JUMP'); }
  if(e.code==='KeyC' && grounded) { slideUntil=performance.now()+480; flash('SLIDE'); }
  if(e.code==='KeyF' && performance.now()-lastDash>900) {
    dashUntil=performance.now()+130; lastDash=performance.now();
  }
});
addEventListener('keyup',e=>keys.delete(e.code));

renderer.domElement.addEventListener('click',()=>{
  if(!locked) renderer.domElement.requestPointerLock(); else fire();
});
document.addEventListener('pointerlockchange',()=>locked=document.pointerLockElement===renderer.domElement);
document.addEventListener('mousemove',e=>{
  if(!locked)return;
  yaw-=e.movementX*.0022; pitch-=e.movementY*.0022;
  pitch=Math.max(-1.42,Math.min(1.42,pitch));
});
document.querySelector('#play')!.addEventListener('click',()=>renderer.domElement.requestPointerLock());

startWave(); updateHud();

let prev=performance.now();
function loop(t:number) {
  const dt=Math.min((t-prev)/1000,.05); prev=t;
  camera.rotation.y=yaw; camera.rotation.x=pitch;

  const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const dir=new THREE.Vector3();
  if(keys.has('KeyW'))dir.add(forward); if(keys.has('KeyS'))dir.sub(forward);
  if(keys.has('KeyD'))dir.add(right); if(keys.has('KeyA'))dir.sub(right);
  if(dir.lengthSq())dir.normalize();

  const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');
  const sliding=t<slideUntil;
  let speed= sprint?11:7;
  if(sliding) speed=14;
  if(t<dashUntil) speed=32;
  camera.position.addScaledVector(dir,speed*dt);

  if(!grounded) velY-=24*dt;
  camera.position.y+=velY*dt;
  if(camera.position.y<=2){camera.position.y=2;velY=0;grounded=true;jumps=0;}
  else grounded=false;

  // Keep the player inside the playable area.
  camera.position.x=THREE.MathUtils.clamp(camera.position.x,-118,118);
  camera.position.z=THREE.MathUtils.clamp(camera.position.z,-118,118);

  for(const p of [...projectiles]) {
    p.position.addScaledVector(p.userData.velocity as THREE.Vector3,dt);
    (p.userData.velocity as THREE.Vector3).y-=18*dt; p.userData.life-=dt;
    if(p.userData.life<=0) {
      const radius=7;
      for(const e of [...enemies]) if(e.m.position.distanceTo(p.position)<radius) {
        e.hp-=10; if(e.hp<=0)killEnemy(e);
      }
      world.remove(p); projectiles.splice(projectiles.indexOf(p),1);
    }
  }

  for(const e of [...enemies]) {
    const d=camera.position.clone().sub(e.m.position); d.y=0;
    const dist=d.length();
    if(dist>2.1) e.m.position.addScaledVector(d.normalize(),dt*e.speed);
    else if(t%90<90*dt+2) { hp-=dt*(e.kind==='tank'?18:10); updateHud(); }
    e.m.lookAt(camera.position.x,e.m.position.y,camera.position.z);
  }
  if(hp<=0) resetPlayer();

  renderer.render(scene,camera); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
