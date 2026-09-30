import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './style.css';
import midiData from './assets/loveaffair.mid?inline';
import { loadMidi, type Song } from './midi';
import { Player } from './audio';
import { VS } from './voxel';
import { buildWorld, setKeyLook, SUN_DIR, RZ0 } from './world';
import { KEYTOP } from './piano';
import { Human } from './human';
import { sunShafts, dust, noteEmitter } from './fx';
import { drawHeart, pixelText, textWidth } from './pixel';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const ease = (a: number, b: number, k: number) => a + (b - a) * (1 - Math.exp(-k));

// ───────── 타이틀 (2D 픽셀)
(function title() {
  const cv = $<HTMLCanvasElement>('title'); cv.width = 160; cv.height = 62;
  const c = cv.getContext('2d')!; c.imageSmoothingEnabled = false;
  const t = 'LOVE AFFAIR', s = 3; pixelText(c, t, (160 - textWidth(t, s)) / 2, 10, s, '#fff1c4', '#a8483a');
  drawHeart(c, 76, 36, 2); pixelText(c, 'A VOXEL TRIBUTE', (160 - textWidth('A VOXEL TRIBUTE', 2)) / 2, 50, 2, '#f2c66b', '#5a2a18');
})();

// ───────── 렌더러 / 씬
const canvas = $<HTMLCanvasElement>('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120a07);
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.28; }
const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 60);

let pixelScale = 1;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const ps = pixelScale > 1 ? Math.max(1.5, pixelScale * (h < 500 ? 0.6 : 1)) : 1;
  renderer.setPixelRatio(pixelScale > 1 ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(Math.ceil(w / ps), Math.ceil(h / ps), false);
  canvas.style.imageRendering = pixelScale > 1 ? 'pixelated' : 'auto';
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 46 : 32;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// 조명: 창으로 스며드는 오후 햇살
scene.add(new THREE.HemisphereLight(0xffe9c8, 0x8a5e40, 0.95));
const sun = new THREE.DirectionalLight(0xffd79a, 3.4);
const sunTarget = new THREE.Object3D(); sunTarget.position.set(0.4, 0.8, -0.6); scene.add(sunTarget);
sun.target = sunTarget; sun.position.copy(sunTarget.position).addScaledVector(SUN_DIR, -12);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.012;
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
scene.add(sun);
const fill = new THREE.DirectionalLight(0xb9c8ff, 0.25); fill.position.set(-3, 4, 6); scene.add(fill);

// ───────── 카메라 샷
const SHOTS: Record<string, { p: THREE.Vector3; t: THREE.Vector3 }> = {
  wide: { p: V(-4.2, 5.4, 9.4), t: V(0.9, 2.7, -0.6) },
  ginny: { p: V(-1.6, 3.6, 2.5), t: V(1.05, 2.85, 0.0) },
  terry: { p: V(0.2, 4.3, 1.4), t: V(-1.6, 3.5, -1.9) },
  mike: { p: V(1.4, 4.5, 3.4), t: V(3.6, 3.9, 0.3) },
  keys: { p: V(-1.6, 4.3, 2.1), t: V(0.2, 2.3, 0.0) },
};
const shotKeys = Object.keys(SHOTS);
let shot = 'wide';
const camPos = SHOTS.wide.p.clone(), camTgt = SHOTS.wide.t.clone();
let uYaw = 0, uPitch = 0, uZoom = 1, lastDrag = -99;
function setShot(s: string) {
  shot = s; uYaw = uPitch = 0; uZoom = 1; lastDrag = -99;
  document.querySelectorAll<HTMLButtonElement>('#shots button').forEach(b => b.classList.toggle('on', b.dataset.shot === s));
}
{
  let drag = false, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => { drag = false; });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    uYaw -= (e.clientX - lx) * 0.005; uPitch = Math.max(-0.5, Math.min(0.6, uPitch + (e.clientY - ly) * 0.004));
    lx = e.clientX; ly = e.clientY; lastDrag = performance.now() / 1000;
  });
  canvas.addEventListener('wheel', e => { e.preventDefault(); uZoom = Math.max(0.45, Math.min(1.5, uZoom * (1 + e.deltaY * 0.001))); lastDrag = performance.now() / 1000; }, { passive: false });
}

// ───────── 상태
let song: Song, player: Player;
let world!: ReturnType<typeof buildWorld>;
let ginny!: Human, terry!: Human, mike!: Human;
const shafts = sunShafts(scene), motes = dust(scene), notes = noteEmitter(scene);
const handFocus = { R: 0, L: 0 }, handPress = { R: 0, L: 0 }, handX = { R: -2, L: -2 };
let lastT = 0, hummingAmt = 0;

const CAPTIONS: [number, string][] = [
  [0.0, '햇살이 스며드는 오후의 방. 지니가 낡은 피아노 앞에 앉는다.'],
  [0.14, '건반 위로 오래된 멜로디가 조용히 번져간다.'],
  [0.405, '피아노 곁에 기대어, 테리가 부드럽게 허밍을 시작한다.'],
  [0.62, '마이크는 아무 말 없이, 두 사람을 바라본다.'],
  [0.76, '말하지 않아도 전해지는 마음이 있다.'],
  [0.92, '음악이 잦아들고, 빛만이 방 안에 남는다.'],
];

function build() {
  world = buildWorld(scene, song.lo, song.hi);
  const p = world.piano;
  ginny = new Human({ scale: 0.9, female: true, old: true, skin: 0xf1d3b8, hair: 0xeeeae4, hairStyle: 'bun', eye: 0x5f8a8a, lips: 0xc27a76, outfit: 'cardigan', top: 0x9db8ae, under: 0xf6f0e4, bottom: 0x6d6a78, shoe: 0x3a2a24, seated: true, smile: 0.7, pearls: true }, scene);
  ginny.root.position.set(11 * VS, 0, 0); ginny.root.rotation.y = -Math.PI / 2;

  terry = new Human({ scale: 0.9, female: true, skin: 0xf6d9c2, hair: 0xd8a860, hairStyle: 'long', eye: 0x5a86a0, lips: 0xc8556a, outfit: 'blouse', top: 0xf3e8d2, under: 0xf3e8d2, bottom: 0x8b6a4a, shoe: 0x4a3226, smile: 0.5 }, scene);
  const tx = -17, tz = p.edgeZ(tx) - 9;
  terry.root.position.set(tx * VS, 0, tz * VS); terry.root.rotation.y = 0.5;

  mike = new Human({ scale: 0.98, female: false, skin: 0xe6b992, hair: 0x4a3222, hairStyle: 'swept', eye: 0x5a3a24, lips: 0xb0655a, outfit: 'suit', top: 0x2b3a5c, under: 0xf6f3ec, bottom: 0x2b3a5c, shoe: 0x1e1a1a, smile: 0.5 }, scene);
  mike.root.position.set(36 * VS, 0, 3 * VS); mike.root.rotation.y = -1.75;
  mike.root.traverse(o => { (o as THREE.Mesh).castShadow = true; });
}

const keyTarget = new Map<number, number>();
function animate(t: number, dt: number) {
  const p = world.piano;
  const T = player.time();
  // 활성 노트 → 건반/손
  keyTarget.clear();
  const hz = { R: [] as number[], L: [] as number[] }; let velR = 0, velL = 0;
  for (const n of song.notes) {
    if (n.time > T + 0.05) break;
    if (T <= n.time + n.dur + 0.04 && player.playing) {
      const vv = 0.6 + 0.4 * n.vel / 127;
      keyTarget.set(n.midi, Math.max(keyTarget.get(n.midi) ?? 0, vv));
      const k = p.keys.get(n.midi)!; hz[n.hand].push(k.z); if (n.hand === 'R') velR = Math.max(velR, vv); else velL = Math.max(velL, vv);
    }
  }
  for (const [m, k] of p.keys) {
    const tg = keyTarget.get(m) ?? 0;
    setKeyLook(k, ease(k.press, tg, tg > k.press ? dt * 40 : dt * 14));
  }

  // 지니: 연주
  const g = ginny;
  const avg = (a: number[], d: number) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : d;
  const fr = avg(hz.R, handFocus.R), fl = avg(hz.L, handFocus.L);
  handFocus.R = ease(handFocus.R, fr, dt * 9); handFocus.L = ease(handFocus.L, fl, dt * 9);
  handPress.R = ease(handPress.R, velR, dt * 22); handPress.L = ease(handPress.L, velL, dt * 22);
  const sway = Math.sin(t * 0.9) * 0.04, beat = Math.sin(t * 2.6) * 0.01;
  g.hip.rotation.x = 0.1 + sway * 0.6 + (player.playing ? beat : 0);
  g.hip.rotation.z = Math.sin(t * 0.6) * 0.03;
  g.head.rotation.x = 0.12 + Math.sin(t * 1.1 + 1) * 0.04;
  g.head.rotation.y = 0.18 + Math.sin(t * 0.45) * 0.1;      // 살짝 테리 쪽으로
  g.head.rotation.z = Math.sin(t * 0.7) * 0.04;
  g.root.updateMatrixWorld(true);
  const hand = (side: 'R' | 'L', z: number, press: number) => {
    const black = false; void black;
    return V(-2.2 * VS, (KEYTOP + 0.5 - press * 0.7) * VS, z * VS);
  };
  g.reach(g.arms[0], hand('R', handFocus.R, handPress.R), V(0.4, -0.7, -1));
  g.reach(g.arms[1], hand('L', handFocus.L, handPress.L), V(0.4, -0.7, 1));
  g.blink(dt);

  // 테리: 기대어 허밍
  const r = terry;
  const humming = player.playing && player.humOn && world && player.hum.some(h => T >= h.time && T < h.time + h.dur);
  hummingAmt = ease(hummingAmt, humming ? 1 : 0, dt * 10);
  r.hip.rotation.x = 0.34 + Math.sin(t * 0.8) * 0.02;
  r.hip.rotation.y = -0.25;
  r.head.rotation.x = -0.16 + hummingAmt * Math.sin(t * 5) * 0.015;
  r.head.rotation.y = 0.42 + Math.sin(t * 0.5) * 0.06;
  r.head.rotation.z = -0.1 + Math.sin(t * 1.15) * 0.07 * (0.4 + hummingAmt);
  r.mouth.visible = hummingAmt > 0.25; r.mouth.scale.set(0.75, 1 + 0.5 * Math.sin(t * 6), 1);
  r.root.updateMatrixWorld(true);
  const chin = r.headWorld(-2.7, 1.2, 3.1);
  r.reach(r.arms[0], chin, V(-0.6, -1, -0.2));
  const elbow = r.arms[0].fore.position.clone();
  r.reach(r.arms[1], elbow.add(V(0.02, 0.02, 0.03)), V(0.6, -1, 0));
  r.blink(dt);

  // 마이크: 조용히 바라봄
  const m = mike;
  m.hip.rotation.z = Math.sin(t * 0.7) * 0.015; m.hip.position.y = (m.hipY + Math.sin(t * 1.4) * 0.12) * VS;
  m.head.rotation.y = 0.0 + Math.sin(t * 0.25) * 0.32; m.head.rotation.x = 0.04; m.head.rotation.z = Math.sin(t * 0.4) * 0.04;
  m.root.updateMatrixWorld(true);
  m.reach(m.arms[0], m.hipLocal(-5.6, 0.5, 2.0), V(-1, -0.3, -0.5));
  m.reach(m.arms[1], m.hipLocal(5.6, 0.5, 2.0), V(1, -0.3, -0.5));
  m.blink(dt);

  // 허밍 → 음표 스프라이트
  if (player.playing) for (const h of player.hum) if (h.time > lastT && h.time <= T && player.humOn) notes.emit(r.headWorld(3.2, 2.2, 2.2), h.midi % 4);
  // 피아노 멜로디 반짝임
  if (player.playing) for (const n of song.notes) { if (n.hand === 'R' && n.time > lastT && n.time <= T && n.vel > 90 && Math.random() < 0.35) notes.emit(V(-0.2, 2.5, p.keyZ(n.midi) * VS), 1); }
  lastT = T;
  notes.update(dt); shafts.update(t); motes.update(t);
  (world.lampLight as THREE.PointLight).intensity = 0.9 + Math.sin(t * 3.1) * 0.03;
}

// ───────── UI
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let capIdx = -1, dragSeek = false;
function ui() {
  const T = player.time(), f = T / song.duration;
  if (!dragSeek) $<HTMLInputElement>('seek').value = String(Math.min(1000, f * 1000));
  $('tCur').textContent = fmt(T);
  let ci = 0; CAPTIONS.forEach(([s], i) => { if (f >= s) ci = i; });
  if (ci !== capIdx && player.playing) {
    capIdx = ci; const el = $('caption'); el.classList.remove('show');
    setTimeout(() => { el.textContent = CAPTIONS[ci][1]; el.classList.add('show'); }, 500);
  }
  $('bPlay').textContent = player.playing ? '⏸' : '▶';
}

async function boot() {
  song = await loadMidi(midiData);
  build(); resize();
  $('tDur').textContent = fmt(song.duration);
  const btn = $<HTMLButtonElement>('go');
  btn.disabled = false; btn.textContent = '▶ 감상 시작';
  const params = new URLSearchParams(location.search);
  const start = async () => {
    player = player ?? new Player(song);
    player.onEnd = () => { if ($('bLoop').classList.contains('on')) { capIdx = -1; player.seek(0); } else ui(); };
    const t0 = parseFloat(params.get('t') ?? '0'); if (t0) player.seek(t0);
    await player.play();
    $('start').classList.add('gone'); $('hud').classList.remove('hidden');
    document.querySelectorAll('.bar').forEach(b => ((b as HTMLElement).style.height = '7vh'));
  };
  btn.onclick = start;
  const sh = params.get('shot'); if (sh && SHOTS[sh]) { setShot(sh); camPos.copy(SHOTS[sh].p); camTgt.copy(SHOTS[sh].t); }
  if (params.has('auto')) { player = new Player(song); const t0 = parseFloat(params.get('t') ?? '0'); player.seek(t0); $('start').classList.add('gone'); $('hud').classList.remove('hidden'); void player.play(); }
  else { player = new Player(song); player.onEnd = () => {}; }
  (window as any).__app = { get player() { return player; }, setShot, song };

  $('bPlay').onclick = async () => { if (player.playing) player.pause(); else await player.play(); };
  $('bRestart').onclick = () => { capIdx = -1; player.seek(0); if (!player.playing) void player.play(); };
  const seek = $<HTMLInputElement>('seek');
  seek.oninput = () => { dragSeek = true; };
  seek.onchange = () => { dragSeek = false; capIdx = -1; player.seek(+seek.value / 1000 * song.duration); };
  $<HTMLInputElement>('vol').oninput = e => player.setVolume(+(e.target as HTMLInputElement).value / 100);
  $('bHum').onclick = e => { const b = e.currentTarget as HTMLElement; b.classList.toggle('on'); player.setHum(b.classList.contains('on')); };
  $('bLoop').onclick = e => (e.currentTarget as HTMLElement).classList.toggle('on');
  $('bPix').onclick = e => { const b = e.currentTarget as HTMLElement; b.classList.toggle('on'); pixelScale = b.classList.contains('on') ? 2 : 1; resize(); };
  document.querySelectorAll<HTMLButtonElement>('#shots button').forEach(b => b.onclick = () => setShot(b.dataset.shot!));
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); if (!$('start').classList.contains('gone')) return; $('bPlay').click(); }
    const i = parseInt(e.key); if (i >= 1 && i <= shotKeys.length) setShot(shotKeys[i - 1]);
  });

  let idle = 0;
  const wake = () => { idle = 0; };
  ['pointermove', 'pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, wake, { passive: true }));
  const clock = new THREE.Clock(); let acc = 0;
  const loop = () => {
    const dt = Math.min(0.05, clock.getDelta()); acc += dt;
    animate(acc, dt);
    idle += dt; if ($('start').classList.contains('gone')) $('hud').classList.toggle('hidden', idle > 5 && player.playing);
    // 카메라: 샷 보간 + 은은한 드리프트 + 사용자 회전
    const S = SHOTS[shot];
    const drifting = performance.now() / 1000 - lastDrag > 4;
    const off = S.p.clone().sub(S.t);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta += uYaw + (drifting ? Math.sin(acc * 0.11) * 0.09 : 0);
    sph.phi = Math.max(0.3, Math.min(1.6, sph.phi + uPitch + (drifting ? Math.sin(acc * 0.083) * 0.02 : 0)));
    sph.radius *= uZoom;
    const wantP = S.t.clone().add(new THREE.Vector3().setFromSpherical(sph));
    camPos.lerp(wantP, 1 - Math.exp(-dt * 2.2)); camTgt.lerp(S.t, 1 - Math.exp(-dt * 2.2));
    camera.position.copy(camPos); camera.lookAt(camTgt);
    renderer.render(scene, camera);
    ui();
    requestAnimationFrame(loop);
  };
  loop();
}
void RZ0;
boot();
