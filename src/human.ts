import * as THREE from 'three';
import { Voxels, VS, solid, shade } from './voxel';

export interface HumanOpts {
  skin: number; hair: number; top: number; bottom: number; shoe: number; lips: number;
  hairStyle: 'bun' | 'long' | 'swept'; seated?: boolean; jacket?: boolean; shirt?: number; pearls?: boolean; cuff?: number;
  smile?: number; blush?: boolean; wrinkles?: boolean;
}
export interface Arm { upper: THREE.Mesh; fore: THREE.Mesh; side: -1 | 1; }

const UP = 7, FO = 7;
const DOWN = new THREE.Vector3(0, -1, 0);

export class Human {
  root = new THREE.Group();
  hip = new THREE.Group();
  head = new THREE.Group();
  eyes: THREE.Mesh[] = [];
  mouth: THREE.Mesh;
  arms: Arm[] = [];
  hipY: number;
  N: number;
  private blinkT = 2 + Math.random() * 3;

  constructor(public o: HumanOpts, scene: THREE.Scene) {
    const hy = this.hipY = o.seated ? 13 : 17;
    const N = this.N = hy + 14;
    const leg = new Voxels(), torso = new Voxels(), head = new Voxels();

    // 다리
    if (o.seated) {
      for (const x0 of [-4, 0]) {
        leg.box(x0, hy - 4, -2, x0 + 4, hy, 8, o.bottom, 0.04);
        leg.box(x0, 0, 6, x0 + 4, hy - 4, 10, o.bottom, 0.04);
        leg.box(x0, 0, 6, x0 + 4, 2, 12, o.shoe, 0.03);
      }
    } else {
      for (const x0 of [-4, 0]) {
        leg.box(x0, 2, -2, x0 + 4, hy, 2, o.bottom, 0.04);
        leg.box(x0, 0, -2, x0 + 4, 2, 4, o.shoe, 0.03);
      }
      leg.box(-1, 2, -2, 1, hy, 2, shade(o.bottom, 0.8)); // 가랑이 선
    }
    // 몸통
    torso.box(-4, hy, -2, 4, hy + 14, 2, o.top, 0.04);
    torso.box(-2, hy + 14, -1, 2, hy + 15, 1, o.skin);           // 목
    torso.box(-4, hy + 11, -2, 4, hy + 14, 2, shade(o.top, 1.03), 0.04);
    if (o.jacket) {
      torso.clear(-1, hy + 7, 1, 1, hy + 14, 2);
      torso.box(-1, hy + 7, 1, 1, hy + 14, 2, o.shirt ?? 0xffffff);
      torso.box(-2, hy + 9, 1, -1, hy + 14, 2, shade(o.top, 0.7)); torso.box(1, hy + 9, 1, 2, hy + 14, 2, shade(o.top, 0.7));
      torso.box(-1, hy + 12, 1, 1, hy + 14, 2, o.skin);          // 오픈 칼라
      torso.box(-3, hy + 13, 1, -1, hy + 14, 3, o.shirt ?? 0xffffff); torso.box(1, hy + 13, 1, 3, hy + 14, 3, o.shirt ?? 0xffffff);
      torso.box(-4, hy, -2, 4, hy + 1, 2, 0x2a2a30); torso.set(0, hy, 2, 0xd6ad4c);
    } else {
      torso.box(-1, hy + 3, 2, 1, hy + 12, 3, shade(o.top, 1.12));  // 단추 라인
      torso.box(-2, hy + 12, 2, 2, hy + 14, 3, o.skin);           // 브이넥
      if (o.pearls) for (let i = -3; i <= 3; i++) torso.set(i, hy + 11 - Math.floor(Math.abs(i) * 0.35), 2, 0xfdfdf5);
      torso.box(-4, hy, -2, 4, hy + 1, 2, shade(o.top, 0.8));
    }
    // 머리
    const n = N;
    head.box(-5, n + 1, -5, 5, n + 11, 5, o.skin, 0.02);
    head.box(-6, n + 4, -1, -5, n + 7, 2, o.skin); head.box(5, n + 4, -1, 6, n + 7, 2, o.skin);           // 귀
    head.box(-1, n + 4, 5, 1, n + 6, 6, shade(o.skin, 0.9));                                                 // 코
    if (o.blush !== false) { head.box(-4, n + 4, 4, -2, n + 5, 5, 0xf0a090); head.box(2, n + 4, 4, 4, n + 5, 5, 0xf0a090); }
    head.box(-4, n + 8, 5, -1, n + 9, 6, shade(o.hair, 0.9)); head.box(1, n + 8, 5, 4, n + 9, 6, shade(o.hair, 0.9));    // 눈썹
    if (o.wrinkles) { head.box(-4, n + 5, 5, -3, n + 6, 6, shade(o.skin, 0.88)); head.box(3, n + 5, 5, 4, n + 6, 6, shade(o.skin, 0.88)); }
    // 머리카락
    const hc = o.hair;
    head.box(-6, n + 10, -6, 6, n + 12, 6, hc, 0.06);
    if (o.hairStyle === 'swept') {
      head.box(-5, n + 9, 5, 5, n + 11, 6, hc, 0.06); head.box(-4, n + 11, 6, 4, n + 12, 8, hc, 0.06); head.box(-6, n + 6, -6, -5, n + 11, 1, hc); head.box(5, n + 6, -6, 6, n + 11, 1, hc);
      head.box(-6, n + 4, -6, 6, n + 10, -4, hc, 0.06);
    } else if (o.hairStyle === 'long') {
      head.box(-5, n + 9, 5, 2, n + 11, 6, hc, 0.06); head.box(-6, n + 3, -6, -5, n + 10, 3, hc, 0.05); head.box(5, n + 3, -6, 6, n + 10, 3, hc, 0.05);
      head.box(-6, n - 3, -6, 6, n + 10, -3, hc, 0.06); head.box(-6, n - 3, -3, -5, n + 3, 1, hc, 0.06); head.box(5, n - 3, -3, 6, n + 3, 1, hc, 0.06);
      head.box(-5, n + 8, 5, -3, n + 10, 6, hc); 
    } else { // bun
      head.box(-5, n + 9, 5, 5, n + 11, 6, hc, 0.05); head.box(-6, n + 4, -6, -5, n + 11, 2, hc, 0.05); head.box(5, n + 4, -6, 6, n + 11, 2, hc, 0.05);
      head.box(-6, n + 4, -6, 6, n + 10, -4, hc, 0.05);
      head.box(-3, n + 12, -6, 3, n + 15, -1, hc, 0.06); head.box(-2, n + 15, -5, 2, n + 16, -2, hc, 0.06);
      head.box(-5, n + 7, 5, -4, n + 9, 6, hc); head.box(4, n + 7, 5, 5, n + 9, 6, hc);
    }
    // 메시화
    const legM = leg.build([0, 0, 0]); this.root.add(legM);
    const tm = torso.build([0, hy, 0]); this.hip.add(tm);
    this.hip.position.y = hy * VS; this.root.add(this.hip);
    const hm = head.build([0, n, 0]); this.head.add(hm);
    this.head.position.y = (n - hy) * VS; this.hip.add(this.head);

    // 눈(깜빡임), 입(허밍)
    for (const sx of [-2.5, 2.5]) {
      const e = solid(1, 2, 0.4, 0x241812, { shadow: false }); e.position.set(sx * VS, 6.5 * VS, 5.15 * VS); this.head.add(e); this.eyes.push(e);
    }
    this.mouth = solid(3, 0.7, 0.3, o.lips, { shadow: false }); this.mouth.position.set(0, 2.4 * VS, 5.1 * VS); this.head.add(this.mouth);
    if (o.smile) for (const sx of [-2, 2]) { const c = solid(1, 0.8, 0.3, o.lips, { shadow: false }); c.position.set(sx * VS * 1.1, (2.4 + o.smile) * VS, 5.2 * VS); this.head.add(c); }

    // 팔
    for (const side of [-1, 1] as const) {
      const u = new Voxels(), f = new Voxels();
      u.box(0, 0, 0, 2, UP, 2, o.top, 0.04);
      f.box(0, 2, 0, 2, FO, 2, o.top, 0.04);
      f.box(0, 0, 0, 2, 2, 2, o.skin);
      if (o.cuff !== undefined) f.box(0, 2, 0, 2, 3, 2, o.cuff);
      const um = u.build([1, UP, 1]), fm = f.build([1, FO, 1]);
      scene.add(um, fm);
      this.arms.push({ upper: um, fore: fm, side });
    }
    scene.add(this.root);
    this.root.userData.human = this;
  }

  /** 어깨 월드 좌표 */
  shoulder(side: -1 | 1) {
    return this.hip.localToWorld(new THREE.Vector3(side * 5 * VS, 12 * VS, 0));
  }
  headWorld(x: number, y: number, z: number) {
    return this.head.localToWorld(new THREE.Vector3(x * VS, y * VS, z * VS));
  }
  hipLocal(x: number, y: number, z: number) {
    return this.hip.localToWorld(new THREE.Vector3(x * VS, y * VS, z * VS));
  }

  /** 2본 IK: 어깨 → 목표 손 위치. pole은 팔꿈치가 향할 방향 힌트 */
  reach(arm: Arm, target: THREE.Vector3, pole: THREE.Vector3) {
    this.root.updateMatrixWorld(true);
    const S = this.shoulder(arm.side);
    const a = UP * VS, b = FO * VS;
    const toT = target.clone().sub(S);
    let d = toT.length();
    d = Math.min(Math.max(d, 0.12), (a + b) * 0.995);
    const u = toT.normalize();
    const x = (d * d + a * a - b * b) / (2 * d);
    const h = Math.sqrt(Math.max(0, a * a - x * x));
    const perp = pole.clone().sub(u.clone().multiplyScalar(pole.dot(u)));
    if (perp.lengthSq() < 1e-6) perp.set(0, -1, 0);
    perp.normalize();
    const E = S.clone().add(u.clone().multiplyScalar(x)).add(perp.multiplyScalar(h));
    const T = S.clone().add(u.multiplyScalar(d));
    arm.upper.position.copy(S);
    arm.upper.quaternion.setFromUnitVectors(DOWN, E.clone().sub(S).normalize());
    arm.fore.position.copy(E);
    arm.fore.quaternion.setFromUnitVectors(DOWN, T.sub(E).normalize());
  }

  blink(dt: number, t: number) {
    this.blinkT -= dt;
    const closing = this.blinkT < 0 && this.blinkT > -0.14;
    if (this.blinkT < -0.14) this.blinkT = 2.2 + Math.random() * 3.5;
    for (const e of this.eyes) e.scale.y = closing ? 0.12 : 1;
    void t;
  }
}
