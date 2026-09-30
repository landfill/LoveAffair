import * as THREE from 'three';
import { Voxels, VS, rnd } from './voxel';
import { scoreTexture } from './pixel';

const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(m % 12);
export interface KeyObj { pivot: THREE.Group; mesh: THREE.Mesh; black: boolean; z: number; press: number; }
export interface PianoInfo {
  keys: Map<number, KeyObj>;
  W: number;
  keyZ: (midi: number) => number;
  edgeZ: (x: number) => number;
  seatX: number;
}
export const KEYTOP = 20;

/** 광택 그랜드 피아노 + 벤치 (복셀 res=3, 표준 재질로 하이라이트) */
export function buildPiano(scene: THREE.Scene, lo: number, hi: number): PianoInfo {
  const whites: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const W = whites.length, KW = 0.72;
  const wIdx = new Map(whites.map((m, i) => [m, i]));
  const kh = W * KW / 2;
  const keyZ = (m: number) => !isBlack(m) ? kh - (wIdx.get(m)! + 0.5) * KW : kh - (wIdx.get(m - 1)! + 1) * KW;
  const half = kh + 3.4;
  const KEYX = -5.6, BACK = -6.6, TAIL = -31, PB = 16, PT = 22.6;
  const edgeZ = (x: number) => {
    const t = Math.min(1, Math.max(0, (BACK - x) / (BACK - TAIL)));
    const u = Math.min(1, Math.max(0, (t - 0.18) / 0.82));
    return -half + half * 0.95 * (1 - Math.cos(u * Math.PI / 2)) + (t > 0.95 ? (t - 0.95) * 40 : 0);
  };

  const v = new Voxels(3);
  const lac = 0x1a1a24, lacTop = 0x2a2a38, wood = 0x3a2418, brass = 0xd6ad4c;
  const D = 1 / 3;
  // 케이스 (얇은 벽 + 상판)
  for (let x = TAIL; x < BACK; x += D) {
    const z0 = edgeZ(x), z1 = edgeZ(x + D), zmin = Math.min(z0, z1);
    v.box(x, PB, half - 0.45, x + D, PT, half, lac, 0.02);
    v.box(x, PB, zmin, x + D, PT, Math.max(z0, z1) + 0.45, lac, 0.02);
    v.box(x, PT, zmin, x + D, PT + 0.9, half, lacTop, 0.015);
  }
  v.box(TAIL, PB, edgeZ(TAIL) - 0.2, TAIL + 0.45, PT + 0.9, half, lac, 0.02);
  v.box(BACK - 0.05, PB, -half, KEYX + 0.05, PT + 0.9, half, lacTop);                    // 폴보드
  v.box(BACK, PB, -half, 1.4, PB + 3.4, half, wood, 0.03);                                 // 건반 베드
  v.box(BACK, PB, -half, 1.2, PT, -kh - 0.3, lac, 0.02); v.box(BACK, PB, kh + 0.3, 1.2, PT, half, lac, 0.02); // 치크 블록
  v.box(BACK, PT, -half, 1.2, PT + 0.6, -kh - 0.3, lacTop); v.box(BACK, PT, kh + 0.3, 1.2, PT + 0.6, half, lacTop);
  v.box(0.6, PB, -kh - 0.3, 1.5, PB + 3.7, kh + 0.3, lac, 0.02);                            // 키 슬립
  v.box(0.6, PB + 3.7, -kh - 0.3, 1.5, PB + 3.95, kh + 0.3, brass);
  // 악보대
  v.box(-9.0, PT + 0.9, -5.4, -8.2, PT + 1.7, 5.4, wood, 0.03);
  for (const s of [-1, 1]) v.box(-8.9, PT + 1.7, s * 4.6 - 0.2, -8.3, PT + 6.5, s * 4.6 + 0.2, wood);
  // 다리 (선반 가공된 둥근 다리 + 황동 캐스터)
  const leg = (x: number, z: number) => {
    v.capsule(x, PB - 0.4, z, x, 2.2, z, 1.6, 0.95, lac, 0.02);
    v.ellipsoid(x, PB - 1.0, z, 2.0, 0.9, 2.0, lacTop, 0.02);
    v.ellipsoid(x, 0.95, z, 1.05, 0.95, 1.05, brass, 0.02);
  };
  leg(-8.2, -(half - 2.4)); leg(-8.2, half - 2.4); leg(-27.5, 0);
  // 페달 리라
  for (const s of [-1, 1]) v.capsule(-3.5, PB - 0.3, s * 1.7, -3.5, 4.2, s * 1.7, 0.55, 0.55, lac, 0.02);
  v.box(-4.3, 3.6, -2.4, -2.7, 4.6, 2.4, lacTop); v.box(-4.0, 4.6, -1.0, -3.2, PB - 0.3, 1.0, lac);
  for (const z of [-1.7, 0, 1.7]) v.box(-3.6, 2.0, z - 0.5, -0.5, 2.5, z + 0.5, brass, 0.02);
  // 벤치 (버건디 쿠션 + 선반 다리)
  const bx0 = 5.5, bx1 = 17, bz = 8.5;
  v.shape(bx0, 10.6, -bz, bx1, 12.9, bz, (x, y, z) => {
    const cx = (x - (bx0 + bx1) / 2) / ((bx1 - bx0) / 2), cz = z / bz;
    if (Math.pow(Math.abs(cx), 6) + Math.pow(Math.abs(cz), 6) > 1) return -1;
    const top = y > 12.0;
    return top ? (Math.pow(Math.abs(cx), 6) + Math.pow(Math.abs(cz), 6) > 0.86 ? 0xd6ad4c : 0x6b2438) : 0x4a2a1c;
  }, 0.04);
  for (const [x, z] of [[bx0 + 0.9, -bz + 0.9], [bx1 - 0.9, -bz + 0.9], [bx0 + 0.9, bz - 0.9], [bx1 - 0.9, bz - 0.9]]) v.capsule(x, 10.6, z, x, 0.2, z, 0.9, 0.6, 0x4a2a1c, 0.03);
  // 사진 액자
  const px = -14, pz = -11;
  v.box(px, PT + 0.9, pz, px + 0.7, PT + 6.4, pz + 4.6, brass, 0.02); v.box(px - 0.05, PT + 1.4, pz + 0.5, px + 0.35, PT + 5.9, pz + 4.1, 0xf3d6c4);
  v.ellipsoid(px - 0.02, PT + 4.3, pz + 2.3, 0.15, 0.7, 0.55, 0x6b4a34); v.ellipsoid(px - 0.02, PT + 3.0, pz + 2.3, 0.15, 1.1, 0.9, 0xd9503a);
  void rnd;

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.08 });
  scene.add(v.build([0, 0, 0], { mat }));

  const score = new THREE.Mesh(new THREE.PlaneGeometry(10 * VS, 6.6 * VS), new THREE.MeshLambertMaterial({ map: scoreTexture(), side: THREE.DoubleSide }));
  score.rotation.order = 'YXZ'; score.rotation.y = Math.PI / 2; score.rotateX(-0.2);
  score.position.set(-8.55 * VS, (PT + 5.2) * VS, 0); score.castShadow = true; scene.add(score);

  // 건반 (개별 메시)
  const keys = new Map<number, KeyObj>();
  for (let m = lo; m <= hi; m++) {
    const blk = isBlack(m);
    const len = blk ? 3.4 : -KEYX, h = blk ? 1.5 : 1.3, wd = blk ? KW * 0.6 : KW * 0.93;
    const pivot = new THREE.Group();
    pivot.position.set(KEYX * VS, (blk ? KEYTOP + 0.65 : KEYTOP - 0.65) * VS, keyZ(m) * VS);
    const mat2 = new THREE.MeshStandardMaterial({ color: blk ? 0x14141a : 0xf7f1e2, roughness: blk ? 0.25 : 0.5, metalness: 0 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len * VS, h * VS, wd * VS), mat2);
    mesh.position.set((len / 2) * VS, 0, 0); mesh.castShadow = true; mesh.receiveShadow = true;
    pivot.add(mesh); scene.add(pivot);
    keys.set(m, { pivot, mesh, black: blk, z: keyZ(m), press: 0 });
  }
  return { keys, W, keyZ, edgeZ, seatX: 11 };
}

export function setKeyLook(k: KeyObj, press: number) {
  k.press = press;
  k.pivot.rotation.z = -press * 0.05;
  const m = k.mesh.material as THREE.MeshStandardMaterial;
  if (k.black) m.emissive.setRGB(press * 0.5, press * 0.25, press * 0.08);
  else m.emissive.setRGB(press * 0.45, press * 0.3, press * 0.08);
}
