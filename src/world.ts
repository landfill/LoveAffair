import * as THREE from 'three';
import { Voxels, VS, rnd, shade } from './voxel';
import { buildPiano, setKeyLook, type PianoInfo, type KeyObj } from './piano';
import { skyTexture, paintingTexture } from './pixel';

export const RX0 = -52, RX1 = 52, RZ0 = -40, RZ1 = 40;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x * VS, y * VS, z * VS);

export type { PianoInfo, KeyObj };
export { setKeyLook };
export const SUN_DIR = new THREE.Vector3(0.24, -0.6, 0.76).normalize();

export function buildWorld(scene: THREE.Scene, lo: number, hi: number) {
  const walls = new Voxels(2);

  // ─── 바닥(마루) + 디오라마 받침
  for (let x = RX0; x < RX1 + 4; x++) for (let z = RZ0; z < RZ1; z++) {
    const row = Math.floor((z - RZ0) / 4);
    const seam = ((x + row * 7) % 22 + 22) % 22 === 0 || (z - RZ0) % 4 === 0;
    const base = [0xc09060, 0xb8875a, 0xc79a68][(row * 7 + 3) % 3];
    walls.set(x, -2, z, seam ? shade(base, 0.78) : base, 0.045);
  }
  walls.box(RX0 - 2, -6, RZ1 - 2, RX1 + 4, -2, RZ1, 0x4a3226, 0.05); walls.box(RX1 + 2, -6, RZ0 - 2, RX1 + 4, -2, RZ1, 0x4a3226, 0.05); walls.box(RX0 - 2, -6, RZ0 - 2, RX0, -2, RZ1, 0x4a3226, 0.05);

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
    for (let i = 0; i < 260; i++) {
      const a = rnd() * 6.28, y = 7 + rnd() * h, spread = 1.2 + Math.sin(Math.min(1, (y - 7) / h) * 2.6) * 5.2 * (0.5 + rnd() * 0.6);
      const long = rnd() < 0.5;
      walls.ellipsoid(cx + Math.cos(a) * spread, y, cz + Math.sin(a) * spread, long ? 1.5 : 0.7, 0.35, long ? 0.7 : 1.5, [0x4f8a44, 0x67a052, 0x3f7a3a, 0x7bb35e][i % 4], 0.14);
    }
    walls.capsule(cx, 7, cz, cx, 7 + h * 0.8, cz, 0.35, 0.2, 0x5a4a2a);
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


  // 창밖 풍경 + 글로우
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(30 * VS, 44 * VS), new THREE.MeshBasicMaterial({ map: skyTexture(), toneMapped: false }));
  sky.position.set(2 * VS, 37 * VS, (RZ0 - 1.9) * VS); scene.add(sky);

  // 창턱의 꽃병
  {
    const vx = 9, vz = -39;
    walls.capsule(vx + 1.5, 16, vz + 1.5, vx + 1.5, 21, vz + 1.5, 1.6, 1.9, 0xbcdde6, 0.03);
    walls.capsule(vx + 1.5, 21, vz + 1.5, vx + 1.5, 23.5, vz + 1.5, 0.9, 0.9, 0xbcdde6, 0.03);
    walls.capsule(vx + 1.5, 23, vz + 1.5, vx + 1.5, 27, vz + 1.5, 0.15, 0.15, 0x4f8a44);
    for (let i = 0; i < 26; i++) {
      const a = rnd() * 6.28, r = rnd() * 3.0, c = [0xf27d9c, 0xffffff, 0xffd35a, 0xf7a3c4][i % 4], y = 25 + rnd() * 4.5;
      walls.ellipsoid(vx + 1.5 + Math.cos(a) * r, y, vz + 1.5 + Math.sin(a) * r, 0.7, 0.6, 0.7, c, 0.1);
    }
  }
  const piano = buildPiano(scene, lo, hi);
  const info = piano;
  const wallMesh = walls.build([0, 0, 0]); scene.add(wallMesh);
  return { piano: info, lampLight, wallMesh };
}

