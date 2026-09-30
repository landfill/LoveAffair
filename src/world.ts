import * as THREE from 'three';
import { Voxels, VS, solid, rnd, shade } from './voxel';
import { skyTexture, paintingTexture, scoreTexture } from './pixel';

export const RX0 = -52, RX1 = 52, RZ0 = -40, RZ1 = 40;
const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(m % 12);
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x * VS, y * VS, z * VS);

export interface KeyObj { pivot: THREE.Group; mesh: THREE.Mesh; black: boolean; z: number; press: number; }
export interface PianoInfo {
  keys: Map<number, KeyObj>;
  W: number;
  keyZ: (midi: number) => number;
  /** 트레블 쪽 곡선 측면의 z(복셀 단위) */
  edgeZ: (x: number) => number;
  seat: THREE.Vector3;
}
export const SUN_DIR = new THREE.Vector3(0.24, -0.6, 0.76).normalize();

export function buildWorld(scene: THREE.Scene, lo: number, hi: number) {
  const walls = new Voxels();
  const bodies = new Voxels();

  // ─── 바닥(마루) + 디오라마 받침
  for (let x = RX0; x < RX1 + 4; x++) for (let z = RZ0; z < RZ1; z++) {
    const row = Math.floor((z - RZ0) / 4);
    const seam = ((x + row * 7) % 22 + 22) % 22 === 0 || (z - RZ0) % 4 === 0;
    const base = [0xc09060, 0xb8875a, 0xc79a68][(row * 7 + 3) % 3];
    walls.set(x, -2, z, seam ? shade(base, 0.78) : base, 0.045);
  }
  walls.box(RX0 - 2, -8, RZ0 - 2, RX1 + 4, -2, RZ1, 0x4a3226, 0.05);

  // ─── 러그
  for (let x = -27; x < 27; x++) for (let z = -30; z < 21; z++) {
    const bx = Math.min(x + 27, 26 - x), bz = Math.min(z + 30, 20 - z), b = Math.min(bx, bz);
    let c = 0x8e3d3f;
    if (b < 1) c = 0xe8d9b0; else if (b < 3) c = 0x6b2a30; else if (b < 4) c = 0xe8d9b0;
    else if ((Math.abs(x + 0) % 8 + Math.abs(z) % 8 === 4) || (Math.abs((x % 8) - 4) + Math.abs((z % 8) - 4) === 2)) c = 0xc9884a;
    walls.set(x, -1, z, c, 0.05);
  }

  // ─── 뒷벽(창문) & 왼쪽 벽
  const H = 76;
  for (let x = RX0 - 2; x < RX1 + 4; x++) for (let y = -2; y < H; y++) for (let z = RZ0 - 2; z < RZ0; z++) {
    let c: number;
    if (y < 11) { c = 0x7c9a88; if ((x % 12 + 12) % 12 === 0) c = shade(c, 0.85); if (y === 10) c = 0xf3ead6; }
    else if (y === 11) c = 0xd9c6a0;
    else c = ((x % 6) + 6) % 6 < 3 ? 0xf0e0bc : 0xead8b0;
    if (y < 1 && y >= -2) c = 0xf3ead6;
    walls.set(x, y, z, c, 0.02);
  }
  for (let z = RZ0; z < RZ1; z++) for (let y = -2; y < H; y++) for (let x = RX0 - 2; x < RX0; x++) {
    let c = y < 11 ? 0x7c9a88 : ((z % 6) + 6) % 6 < 3 ? 0xf0e0bc : 0xead8b0;
    if (y === 10) c = 0xf3ead6; if (y < 1 && y >= -2) c = 0xf3ead6;
    walls.set(x, y, z, c, 0.02);
  }
  // 오른쪽 벽 + 문
  for (let z = RZ0; z < RZ1; z++) for (let y = -2; y < H; y++) for (let x = RX1; x < RX1 + 2; x++) {
    let c = y < 11 ? 0x7c9a88 : ((z % 6) + 6) % 6 < 3 ? 0xf0e0bc : 0xead8b0;
    if (y === 10) c = 0xf3ead6; if (y < 1 && y >= -2) c = 0xf3ead6;
    walls.set(x, y, z, c, 0.02);
  }
  walls.box(RX1 - 1, -1, -32, RX1, 56, -12, 0xf8f2e4); walls.box(RX1 - 1, -1, -30, RX1, 54, -14, 0x8a5a36, 0.04);
  walls.box(RX1 - 2, 6, -30, RX1 - 1, 24, -23, 0x7a4c2c); walls.box(RX1 - 2, 6, -21, RX1 - 1, 24, -14, 0x7a4c2c);
  walls.box(RX1 - 2, 30, -30, RX1 - 1, 50, -23, 0x7a4c2c); walls.box(RX1 - 2, 30, -21, RX1 - 1, 50, -14, 0x7a4c2c);
  walls.box(RX1 - 2, 26, -18, RX1 - 1, 28, -16, 0xd6ad4c);
  // 창문 구멍 + 프레임 + 격자
  const WX0 = -10, WX1 = 14, WY0 = 18, WY1 = 56;
  walls.clear(WX0, WY0, RZ0 - 2, WX1, WY1, RZ0);
  const white = 0xf8f2e4;
  walls.box(WX0 - 2, WY0 - 2, RZ0, WX1 + 2, WY0, RZ0 + 1, white); walls.box(WX0 - 2, WY1, RZ0, WX1 + 2, WY1 + 2, RZ0 + 1, white);
  walls.box(WX0 - 2, WY0, RZ0, WX0, WY1, RZ0 + 1, white); walls.box(WX1, WY0, RZ0, WX1 + 2, WY1, RZ0 + 1, white);
  walls.box(WX0 - 4, WY0 - 3, RZ0, WX1 + 4, WY0 - 2, RZ0 + 3, white);
  for (const mx of [-2, 6]) walls.box(mx, WY0, RZ0 - 1, mx + 1, WY1, RZ0, white);
  for (const my of [30, 43]) walls.box(WX0, my, RZ0 - 1, WX1, my + 1, RZ0, white);
  // 아치 상단 장식
  for (let i = 0; i < 12; i++) walls.set(WX0 + i * 2, WY1 + 2, RZ0, 0xd8c7a1);

  // 커튼 + 로드 + 타이백
  const rose = 0xd9a3a0;
  for (const [x0, x1] of [[-18, -12], [16, 22]]) {
    for (let x = x0; x < x1; x++) for (let y = 4; y < 62; y++) for (let z = RZ0 + 1; z < RZ0 + 3; z++) {
      const fold = (x % 2 + 2) % 2 ? 0.9 : 1.05;
      const pinch = y >= 26 && y <= 30 && (x === x0 || x === x1 - 1);
      if (pinch) continue;
      walls.set(x, y, z, shade(rose, fold * (y < 12 ? 0.95 : 1)), 0.03);
    }
    walls.box(x0, 27, RZ0 + 2, x1, 29, RZ0 + 3, 0xd6ad4c);
  }
  walls.box(-20, 62, RZ0 + 2, 24, 63, RZ0 + 3, 0xc9a24a);
  walls.box(-22, 61, RZ0 + 1, -20, 64, RZ0 + 4, 0xe1bb59); walls.box(24, 61, RZ0 + 1, 26, 64, RZ0 + 4, 0xe1bb59);

  // 액자
  const frames: [number, number, number, number, number, number][] = [[-40, 30, 16, 12, 0, 0], [26, 32, 10, 8, 1, 0], [RX0, 34, 12, 9, 1, 1]];
  for (const [fx, fy, w, h, kind, side] of frames) {
    const tex = paintingTexture(kind);
    if (!side) {
      walls.box(fx - 1, fy - 1, RZ0, fx + w + 1, fy + h + 1, RZ0 + 1, 0xc9a24a);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w * VS, h * VS), new THREE.MeshBasicMaterial({ map: tex }));
      p.position.set((fx + w / 2) * VS, (fy + h / 2) * VS, (RZ0 + 1.04) * VS); scene.add(p);
    } else {
      const zc = -10;
      walls.box(RX0, fy - 1, zc - 1, RX0 + 1, fy + h + 1, zc + w + 1, 0xc9a24a);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w * VS, h * VS), new THREE.MeshBasicMaterial({ map: tex }));
      p.rotation.y = Math.PI / 2; p.position.set((RX0 + 1.04) * VS, (fy + h / 2) * VS, (zc + w / 2) * VS); scene.add(p);
    }
  }

  // 책장 (왼쪽 벽)
  {
    const zA = -36, zB = -14, x0 = RX0, x1 = RX0 + 7;
    const wood = 0x6b4428;
    walls.box(x0, -1, zA, x1, 48, zB, wood, 0.04);
    for (let lv = 0; lv < 5; lv++) {
      const y0 = 1 + lv * 9;
      walls.clear(x0 + 1, y0, zA + 1, x1, y0 + 8, zB - 1);
      const pal = [0x9c3b3b, 0x3b5f9c, 0x3f7f5a, 0xc9a24a, 0x7a4a8f, 0xd98a4a, 0x2f2f3a, 0xe8dcc0];
      for (let z = zA + 1; z < zB - 1; z++) {
        if (rnd() < 0.1) continue;
        const h = 5 + Math.floor(rnd() * 3), c = pal[Math.floor(rnd() * pal.length)];
        walls.box(x0 + 1, y0, z, x0 + 5, y0 + h, z + 1, c, 0.08);
      }
    }
  }

  // 화분
  const plant = (cx: number, cz: number, h: number) => {
    walls.box(cx - 3, -1, cz - 3, cx + 3, 5, cz + 3, 0xb5643c, 0.06); walls.box(cx - 4, 5, cz - 4, cx + 4, 6, cz + 4, 0xc4744a);
    walls.box(cx - 3, 6, cz - 3, cx + 3, 7, cz + 3, 0x4a3226);
    for (let i = 0; i < 70; i++) {
      const a = rnd() * 6.28, r = rnd() * 7, y = 7 + rnd() * h;
      walls.box(cx + Math.cos(a) * r * (0.4 + y / (h + 7) * 0.9), y, cz + Math.sin(a) * r * (0.4 + y / (h + 7) * 0.9), cx + Math.cos(a) * r * 1.3 + 2, y + 2, cz + Math.sin(a) * r * 1.3 + 2, [0x4f8a44, 0x67a052, 0x3f7a3a][i % 3], 0.1);
    }
  };
  plant(-46, -34, 18); plant(44, -34, 24);

  // 사이드 테이블 + 램프
  const TX = 30, TZ = -38;
  walls.box(TX, -1, TZ, TX + 10, 0, TZ + 8, 0x6b4428);
  for (const [dx, dz] of [[1, 1], [7, 1], [1, 5], [7, 5]]) walls.box(TX + dx, 0, TZ + dz, TX + dx + 2, 15, TZ + dz + 2, 0x6b4428);
  walls.box(TX - 1, 15, TZ - 1, TX + 11, 17, TZ + 9, 0x7a5232);
  const lamp = new Voxels();
  lamp.box(TX + 4, 17, TZ + 3, TX + 6, 22, TZ + 5, 0xc9a24a); lamp.box(TX + 1, 22, TZ + 1, TX + 9, 30, TZ + 7, 0xffe6b0);
  const lampMesh = lamp.build([0, 0, 0], { mat: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), cast: false, receive: false });
  scene.add(lampMesh);
  const lampLight = new THREE.PointLight(0xffc880, 0.9, 6, 1.6); lampLight.position.copy(v3(TX + 5, 26, TZ + 4)); scene.add(lampLight);

  const wallMesh = walls.build([0, 0, 0]); scene.add(wallMesh);

  // 창밖 풍경 + 글로우
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(30 * VS, 44 * VS), new THREE.MeshBasicMaterial({ map: skyTexture(), toneMapped: false }));
  sky.position.set(2 * VS, 37 * VS, (RZ0 - 1.9) * VS); scene.add(sky);

  // ─── 그랜드 피아노
  const whites: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const W = whites.length;
  const wIdx = new Map(whites.map((m, i) => [m, i]));
  const keyZ = (m: number) => {
    if (!isBlack(m)) return W / 2 - (wIdx.get(m)! + 0.5);
    return W / 2 - (wIdx.get(m - 1)! + 1);
  };
  const half = Math.ceil(W / 2) + 2;
  const KEYX = -5, KEYY = 17.3;
  const black = 0x2a2a36, blackTop = 0x3c3c4c;
  const edgeZ = (x: number) => {
    const t = Math.min(1, Math.max(0, (KEYX - x) / 25));
    const u = Math.min(1, Math.max(0, (t - 0.22) / 0.78));
    return -half + W * 0.62 * (1 - Math.cos(u * Math.PI / 2)) + (t > 0.94 ? (t - 0.94) * 60 : 0);
  };
  // 본체
  for (let x = -31; x < KEYX; x++) {
    const zmin = Math.ceil(edgeZ(x)), zmax = half;
    bodies.box(x, 14, zmin, x + 1, 20, zmax, black, 0.02);
    bodies.box(x, 20, zmin - 0, x + 1, 21, zmax, blackTop, 0.015);
    bodies.clear(x, 14, zmin + 1, x + 1, 19, zmax - 1); // 속 비움(얇은 케이스)
    bodies.box(x, 14, zmin + 1, x + 1, 15, zmax - 1, 0x141419);
  }
  // 열린 뚜껑 느낌: 상판 둥근 모서리
  // 건반 하부/치크블록/폴보드
  bodies.box(-6, 14, -half + 1, 1, 17, half - 1, 0x3a2418, 0.03);
  bodies.box(-6, 14, -half, 2, 20, -half + 2, black, 0.02); bodies.box(-6, 14, half - 2, 2, 20, half, black, 0.02);
  bodies.box(-8, 17, -half + 2, KEYX + 0.0, 21, half - 2, black, 0.02);
  bodies.box(-6, 14, -half, 2, 15, half, 0x241812);
  // 다리 & 페달 리라
  const leg = (x: number, z: number) => { bodies.box(x, 1, z, x + 3, 14, z + 3, black, 0.02); bodies.box(x - 1, 0, z - 1, x + 4, 1, z + 4, 0x3a3a46); bodies.box(x - 1, 12, z - 1, x + 4, 14, z + 4, blackTop); };
  leg(-6, -half + 1); leg(-6, half - 4); leg(-29, -2);
  bodies.box(-4, 5, -1, -2, 14, 1, black); bodies.box(-5, 3, -3, -1, 5, 3, 0x2a2a34);
  for (const z of [-2, 0, 1]) bodies.box(-3, 2, z, -1, 3, z + 1, 0xd6ad4c);
  // 벤치
  const bx0 = 5, bx1 = 13;
  bodies.box(bx0, 7, -9, bx1, 9, 9, 0x6b2f4a, 0.04); bodies.box(bx0, 5, -9, bx1, 7, 9, 0x4a2a1c);
  for (const [x, z] of [[bx0, -9], [bx1 - 2, -9], [bx0, 7], [bx1 - 2, 7]]) bodies.box(x, 0, z, x + 2, 5, z + 2, 0x4a2a1c);
  // 꽃병과 사진 액자 (피아노 위)
  const vx = 9, vz = -39;
  bodies.box(vx, 16, vz, vx + 3, 22, vz + 3, 0xbcdde6, 0.03); bodies.box(vx + 1, 22, vz + 1, vx + 2, 23, vz + 2, 0xbcdde6);
  for (let i = 0; i < 22; i++) {
    const a = rnd() * 6.28, r = rnd() * 3.2, c = [0xf27d9c, 0xffffff, 0xffd35a, 0xf7a3c4][i % 4];
    bodies.box(vx + 1 + Math.cos(a) * r, 23 + rnd() * 5, vz + 1 + Math.sin(a) * r, vx + 2 + Math.cos(a) * r + 1, 24 + rnd() * 5, vz + 2 + Math.sin(a) * r + 1, c, 0.08);
  }
  bodies.box(vx + 1, 23, vz + 1, vx + 2, 26, vz + 2, 0x4f8a44);
  const px = -10, pz = -11;
  bodies.box(px, 21, pz, px + 2, 27, pz + 6, 0xc9a24a); bodies.box(px, 22, pz + 1, px + 1, 26, pz + 5, 0xf3d6c4);
  bodies.set(px, 24, pz + 2, 0x8a5a3a); bodies.set(px, 24, pz + 3, 0x8a5a3a); bodies.set(px, 25, pz + 2, 0x8a5a3a);
  bodies.box(px, 22, pz + 4, px + 1, 23, pz + 5, 0xd9503a);
  // 악보대
  bodies.box(-8, 21, -3, -7, 23, 3, 0x3a2418);

  const pianoMesh = bodies.build([0, 0, 0]);
  scene.add(pianoMesh);
  const score = new THREE.Mesh(new THREE.PlaneGeometry(10 * VS, 6.5 * VS), new THREE.MeshLambertMaterial({ map: scoreTexture(), side: THREE.DoubleSide }));
  score.position.set(-7.6 * VS, 26 * VS, 0); score.rotation.set(0, Math.PI / 2, 0); score.rotation.order = 'YXZ'; score.rotateX(-0.22);
  score.castShadow = true; scene.add(score);

  // 건반 (개별 메시)
  const keys = new Map<number, KeyObj>();
  const wMat = 0xf7f1e2, bMat = 0x14141a;
  for (let m = lo; m <= hi; m++) {
    const blk = isBlack(m);
    const len = blk ? 3.2 : 5.2, h = blk ? 1.7 : 1.4, wdt = blk ? 0.62 : 0.92;
    const pivot = new THREE.Group();
    const y = blk ? 18.75 : KEYY;
    pivot.position.set(KEYX * VS, y * VS, keyZ(m) * VS);
    const mat = new THREE.MeshLambertMaterial({ color: blk ? bMat : wMat });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len * VS, h * VS, wdt * VS), mat);
    mesh.position.set((len / 2) * VS, 0, 0); mesh.castShadow = true; mesh.receiveShadow = true;
    pivot.add(mesh); scene.add(pivot);
    keys.set(m, { pivot, mesh, black: blk, z: keyZ(m), press: 0 });
  }
  const info: PianoInfo = { keys, W, keyZ, edgeZ, seat: v3(9, 13, 0) };
  return { piano: info, lampLight, wallMesh };
}

export function setKeyLook(k: KeyObj, press: number) {
  k.press = press;
  k.pivot.rotation.z = -press * 0.075;
  const m = k.mesh.material as THREE.MeshLambertMaterial;
  if (k.black) m.emissive.setRGB(press * 0.55, press * 0.28, press * 0.1);
  else m.emissive.setRGB(press * 0.5, press * 0.32, press * 0.08);
}
