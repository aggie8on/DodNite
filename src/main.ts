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
  const mesh = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 22), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .82 }));
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

type EnemyKind = 'grunt'|'runner'|'gunner'|'heavy'|'sniper';
type Enemy = { m: THREE.Group; hp: number; speed: number; kind: EnemyKind; parts: THREE.Object3D[]; phase:number; ranged?: boolean; boss?: boolean };
const enemies: Enemy[] = [];
const projectiles: THREE.Mesh[] = [];
const keys = new Set<string>();

let yaw=0,pitch=0,velY=0,locked=false;
let hp=100,score=0,wave=1,kills=0;\nlet levelPhase:'waves'|'objective'|'boss'|'complete'='waves';\nlet objectiveCrates=0;\nlet bossSpawned=false;
let grounded=true,jumps=0,slideUntil=0,dashUntil=0,lastDash=0,lastShot=0;
let weaponIndex=0;
const weapons = [
  {name:'RIFLE', damage:1, cooldown:105, pellets:1, spread:.012},
  {name:'SHOTGUN', damage:2, cooldown:620, pellets:8, spread:.075},
  {name:'SNIPER', damage:7, cooldown:900, pellets:1, spread:.002},
  {name:'KATANA', damage:5, cooldown:430, pellets:1, spread:0},
  {name:'GRENADE', damage:10, cooldown:850, pellets:1, spread:.02}
];

const weaponView = new THREE.Group();
camera.add(weaponView);
const handMat = toon(0x8f5f45);
const weaponInk = toon(0x16191a);

function fpBox(parent:THREE.Group, size:[number,number,number], pos:[number,number,number], color:number, rot?:[number,number,number]) {
  const m=new THREE.Mesh(new THREE.BoxGeometry(...size),toon(color));
  m.position.set(...pos); if(rot)m.rotation.set(...rot); m.castShadow=true; m.add(outline(m.geometry)); parent.add(m); return m;
}
function buildFirstPersonWeapon(index:number) {
  weaponView.clear();
  const group=new THREE.Group();
  group.position.set(.48,-.38,-.72);
  group.rotation.set(-.05,-.04,.02);
  weaponView.add(group);
  if(index===0||index===1||index===2) {
    const long=index===2?1.55:index===1?1.05:1.25;
    const body=index===1?0x5b5147:0x252a2d;
    fpBox(group,[.28,.22,long],[0,0,-long*.42],body,[0,0,0]);
    fpBox(group,[.1,.1,long*.72],[0,.1,-long*.78],0x111111);
    fpBox(group,[.18,.32,.25],[0,-.2,-.18],0x202326,[.35,0,0]);
    if(index===2) {
      const scope=fpBox(group,[.12,.12,.42],[0,.2,-.58],0x111111);
      scope.rotation.x=0;
    }
    const rightHand=fpBox(group,[.18,.16,.42],[.22,-.18,-.28],0x8f5f45,[.35,0,.15]);
    const leftHand=fpBox(group,[.18,.16,.42],[-.2,-.16,-.72],0x8f5f45,[.35,0,-.12]);
    rightHand.scale.set(1,.8,1); leftHand.scale.set(1,.8,1);
  } else if(index===3) {
    const blade=fpBox(group,[.11,.07,1.65],[.05,.08,-.8],0xd7dbe0,[0,.03,-.04]);
    fpBox(group,[.3,.22,.22],[.02,-.02,.02],0x171717);
    fpBox(group,[.18,.18,.5],[.02,-.18,.18],0x8f5f45,[.2,0,0]);
  } else {
    fpBox(group,[.32,.32,.32],[0,-.02,-.28],0x3e463f);
    fpBox(group,[.22,.18,.4],[.02,-.18,.08],0x8f5f45,[.15,0,0]);
    fpBox(group,[.08,.08,.25],[.14,.2,-.25],0xb6b6a8);
  }
  return group;
}
buildFirstPersonWeapon(0);

function updateWeaponView() {
  buildFirstPersonWeapon(weaponIndex);
}
function weaponKick(amount:number) {
  weaponView.position.z += amount;
  weaponView.rotation.x += amount*.45;
  setTimeout(()=>{ weaponView.position.z -= amount; weaponView.rotation.x -= amount*.45; },70);
}

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
  hud.ammo.textContent=weaponIndex===4?'∞':'READY';\n  updateWeaponView();
}
function flash(text:string) {
  hud.message.textContent=text; hud.message.classList.add('show');
  setTimeout(()=>hud.message.classList.remove('show'),650);
}

function addOutlinedPart(parent:THREE.Group, mesh:THREE.Mesh) {
  mesh.castShadow=true; mesh.receiveShadow=true; mesh.add(outline(mesh.geometry)); parent.add(mesh);
  return mesh;
}
function limb(parent:THREE.Group, a:THREE.Vector3, b:THREE.Vector3, radius:number, material:THREE.Material) {
  const delta=b.clone().sub(a), len=delta.length();
  const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(radius,len*.5,4,6),material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  return addOutlinedPart(parent,mesh);
}
function doodleEnemy(kind:EnemyKind) {
  const g=new THREE.Group();
  const scale=kind==='heavy'?1.28:kind==='runner'?.94:1;
  const bodyColor={grunt:0xd85c4f,runner:0xe18d46,gunner:0x4c87c7,heavy:0x7d4d4d,sniper:0x7666b8}[kind];
  const skin=0xc98f6b;
  const ink=0x111111;
  const parts:THREE.Object3D[]=[];

  const torso=new THREE.Mesh(new THREE.BoxGeometry(.72*scale,1.02*scale,.42*scale),toon(bodyColor));
  torso.position.y=1.45*scale; addOutlinedPart(g,torso); parts.push(torso);

  const head=new THREE.Mesh(new THREE.SphereGeometry(.43*scale,10,8),toon(skin));
  head.scale.set(1,.98,.9); head.position.y=2.35*scale; addOutlinedPart(g,head); parts.push(head);

  const eyeMat=toon(ink);
  for(const x of [-.15,.15]) {
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.045*scale,6,6),eyeMat);
    eye.position.set(x*scale,2.4*scale,.39*scale); g.add(eye); parts.push(eye);
  }
  const mouth=new THREE.Mesh(new THREE.BoxGeometry(.2*scale,.035*scale,.025*scale),toon(ink));
  mouth.position.set(0,2.2*scale,.405*scale); g.add(mouth); parts.push(mouth);

  const shoulderY=1.82*scale, hipY=.98*scale;
  const leftArm=limb(g,new THREE.Vector3(-.43*scale,shoulderY,0),new THREE.Vector3(-.68*scale,1.28*scale,.02),.105*scale,toon(bodyColor));
  const rightArm=limb(g,new THREE.Vector3(.43*scale,shoulderY,0),new THREE.Vector3(.68*scale,1.28*scale,.02),.105*scale,toon(bodyColor));
  const leftLeg=limb(g,new THREE.Vector3(-.2*scale,hipY,0),new THREE.Vector3(-.27*scale,.18*scale,0),.13*scale,toon(0x24272a));
  const rightLeg=limb(g,new THREE.Vector3(.2*scale,hipY,0),new THREE.Vector3(.27*scale,.18*scale,0),.13*scale,toon(0x24272a));
  parts.push(leftArm,rightArm,leftLeg,rightLeg);

  const shoeMat=toon(0x111111);
  for(const x of [-.3,.3]) {
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(.28*scale,.12*scale,.5*scale),shoeMat);
    shoe.position.set(x*scale,.1*scale,.12*scale); addOutlinedPart(g,shoe); parts.push(shoe);
  }

  if(kind==='runner') {
    torso.rotation.x=-.18; head.position.z=.08*scale;
  }
  if(kind==='heavy') {
    const shoulder=new THREE.Mesh(new THREE.BoxGeometry(1.05*scale,.25*scale,.55*scale),toon(0x4b5157));
    shoulder.position.y=1.9*scale; addOutlinedPart(g,shoulder); parts.push(shoulder);
    const helmet=new THREE.Mesh(new THREE.SphereGeometry(.49*scale,8,6),toon(0x353b40));
    helmet.scale.y=.7; helmet.position.y=2.62*scale; addOutlinedPart(g,helmet); parts.push(helmet);
  }

  if(kind==='grunt'||kind==='gunner'||kind==='sniper') {
    const weaponMat=toon(ink);
    const length=kind==='sniper'?.95:.7;
    const gun=new THREE.Mesh(new THREE.BoxGeometry(.1*scale,.1*scale,length*scale),weaponMat);
    gun.position.set(.72*scale,1.3*scale,.18*scale); gun.rotation.x=-.1; gun.rotation.z=-.12;
    addOutlinedPart(g,gun); parts.push(gun);
    const stock=new THREE.Mesh(new THREE.BoxGeometry(.16*scale,.13*scale,.22*scale),weaponMat);
    stock.position.set(.52*scale,1.3*scale,.08*scale); addOutlinedPart(g,stock); parts.push(stock);
  }
  if(kind==='sniper') {
    const scope=new THREE.Mesh(new THREE.CylinderGeometry(.035*scale,.035*scale,.22*scale,6),toon(0x202020));
    scope.rotation.z=Math.PI/2; scope.position.set(.7*scale,1.43*scale,.18*scale); addOutlinedPart(g,scope); parts.push(scope);
  }
  if(kind==='runner') {
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.06*scale,.06*scale,.72*scale),toon(0xd9d9d9));
    blade.position.set(.72*scale,1.2*scale,.12*scale); blade.rotation.x=-.5; addOutlinedPart(g,blade); parts.push(blade);
  }
  if(kind==='heavy') {
    const pack=new THREE.Mesh(new THREE.BoxGeometry(.42*scale,.65*scale,.2*scale),toon(0x383d40));
    pack.position.set(0,1.42*scale,-.3*scale); addOutlinedPart(g,pack); parts.push(pack);
  }
  return {g,parts};
}

function spawn(kind?: EnemyKind) {
  const types: EnemyKind[]=['grunt','grunt','runner','gunner','heavy','sniper'];
  const k=kind ?? types[Math.floor(Math.random()*types.length)];
  const made=doodleEnemy(k), g=made.g;
  const a=Math.random()*Math.PI*2,r=28+Math.random()*40;
  g.position.set(Math.cos(a)*r,0,Math.sin(a)*r); world.add(g);
  const stats={
    grunt:{hp:3,speed:2.35},runner:{hp:2,speed:4.4},gunner:{hp:3,speed:1.9},
    heavy:{hp:12,speed:1.35},sniper:{hp:4,speed:1.35}
  }[k];
  enemies.push({m:g,hp:stats.hp,speed:stats.speed,kind:k,parts:made.parts,phase:Math.random()*Math.PI*2,ranged:k==='gunner'||k==='sniper'});
}
function startWave() {
  for(let i=0;i<4+wave*2;i++) spawn();
  flash('WAVE '+wave);
}
function killEnemy(e:Enemy) {
  world.remove(e.m); enemies.splice(enemies.indexOf(e),1);
  score += e.kind==='heavy'?900:e.kind==='sniper'?600:e.kind==='gunner'?500:e.kind==='runner'?350:300; kills++;
  if(e.boss) { levelPhase='complete'; flash('LEVEL COMPLETE'); return; }
  if(!enemies.length) {
    if(levelPhase==='waves') {
      wave++;
      score+=1000;
      if(wave===5) startWave();
      else if(wave===10) spawnBoss();
      else startWave();
    }
  }
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
  let obj:THREE.Object3D|null=hits[0].object; let owner:Enemy|undefined;
  while(obj) { owner=enemies.find(e=>e.m===obj); if(owner) break; obj=obj.parent; }
  if(owner) { owner.hp-=damage; score+=50; if(owner.hp<=0) killEnemy(owner); updateHud(); }
}

function fire() {
  const now=performance.now(), w=weapons[weaponIndex];
  if(now-lastShot<w.cooldown || !locked) return;
  lastShot=now; weaponKick(.035);
  if(weaponIndex===3) {
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
  weaponIndex=(n+weapons.length)%weapons.length; updateHud(); updateWeaponView(); flash(weapons[weaponIndex].name);
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
  if(e.code==='KeyF' && performance.now()-lastDash>900) { dashUntil=performance.now()+130; lastDash=performance.now(); }
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
  let speed=sprint?11:7;
  if(sliding) speed=14;
  if(t<dashUntil) speed=32;
  camera.position.addScaledVector(dir,speed*dt);

  if(!grounded) velY-=24*dt;
  camera.position.y+=velY*dt;
  if(camera.position.y<=2){camera.position.y=2;velY=0;grounded=true;jumps=0;}
  else grounded=false;

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

  if(levelPhase==='objective' && objectiveCrates>=5 && !enemies.length) { wave=10; spawnBoss(); }

  for(const e of [...enemies]) {
    const d=camera.position.clone().sub(e.m.position); d.y=0;
    const dist=d.length();
    if(dist>2.1) e.m.position.addScaledVector(d.normalize(),dt*e.speed);
    else if(t%90<90*dt+2) {
      if(e.ranged) {
        hp-=dt*(e.kind==='sniper'?8:5);
      } else {
        hp-=dt*(e.boss?28:e.kind==='heavy'?18:10);
      }
      updateHud();
    }
    e.m.lookAt(camera.position.x,e.m.position.y,camera.position.z);
    const moving=dist>2.1;
    const bob=Math.sin(t*.012*e.speed+e.phase)*.045;
    const s=Math.sin(t*.009*e.speed+e.phase);
    if(e.kind==='runner') { e.m.rotation.z=s*.045; e.m.position.y=bob; }
    else if(e.kind==='heavy') { e.m.rotation.z=s*.018; e.m.position.y=bob*.45; }
    else { e.m.rotation.z=s*.025; e.m.position.y=bob; }
    if(e.kind==='gunner' || e.kind==='sniper') e.m.rotation.z*=.35;
    if(moving && e.kind==='runner') e.m.rotation.x=Math.sin(t*.014+e.phase)*.035;
  }
  if(hp<=0) resetPlayer();

  if(levelPhase==='complete') {
    camera.position.y=2.15+Math.sin(t*.004)*.03;
  }
  renderer.render(scene,camera); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});