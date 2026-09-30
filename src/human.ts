import * as THREE from 'three';
import { Voxels, VS, solid, shade, mix, lerp } from './voxel';

export interface HumanOpts {
  scale: number; female: boolean; old?: boolean;
  skin: number; hair: number; hairStyle: 'bun' | 'long' | 'swept'; eye: number; lips: number;
  outfit: 'cardigan' | 'blouse' | 'suit'; top: number; under: number; bottom: number; shoe: number;
  seated?: boolean; smile?: number; pearls?: boolean;
}
export interface Arm { upper: THREE.Mesh; fore: THREE.Mesh; side: -1 | 1; }

const RES = 4;
export const UP = 8, FO = 11;               // 위팔, 팔꿈치→손끝 (유닛)
const DOWN = new THREE.Vector3(0, -1, 0);
const NECK = 16.5;                           // 골반 기준 목 끝 높이
const SH_Y = 13.4;                           // 어깨 높이

export class Human {
  root = new THREE.Group();
  hip = new THREE.Group();
  head = new THREE.Group();
  lids: THREE.Mesh[] = [];
  mouth: THREE.Mesh;
  arms: Arm[] = [];
  hipY: number;
  sc: number;
  private blinkT = 2 + Math.random() * 3;
  private wx: (y: number) => number;
  private wz: (y: number) => number;
  private shoulderX: number;

  constructor(public o: HumanOpts, scene: THREE.Scene) {
    const F = o.female, sc = this.sc = o.scale;
    const hy = this.hipY = o.seated ? 14.6 : 22;
    // 상체 단면 프로파일 (골반 기준 y)
    const wx = this.wx = (y: number) => y < 0 ? lerp(F ? 4.7 : 4.4, F ? 4.4 : 4.2, y / -2) * 0 + (F ? 4.5 : 4.3) : y < 5 ? lerp(F ? 4.5 : 4.3, F ? 3.5 : 4.0, y / 5) : y < 10.5 ? lerp(F ? 3.5 : 4.0, F ? 4.3 : 5.2, (y - 5) / 5.5) : lerp(F ? 4.3 : 5.2, F ? 4.1 : 4.9, (y - 10.5) / 4);
    const wz = this.wz = (y: number) => y < 5 ? (F ? 2.7 : 2.8) : y < 10.5 ? lerp(F ? 2.7 : 2.8, F ? 3.0 : 3.0, (y - 5) / 5.5) : lerp(F ? 3.0 : 3.0, 2.5, (y - 10.5) / 4);
    this.shoulderX = wx(SH_Y) + 0.55;

    const legs = new Voxels(RES), torso = new Voxels(RES), head = new Voxels(6);
    const skin = o.skin, sSh = shade(skin, 0.86);

    // ───────── 다리 & 골반
    const pants = (x: number, y: number, z: number) => { void x; void z; return y < 0.3 ? shade(o.bottom, 0.55) : -1; };
    void pants;
    const leg = (sx: number) => {
      if (o.seated) {
        legs.capsule(sx * 2.4, 14.4, 0.2, sx * 2.4, 13.4, 10.3, 2.4, 1.95, o.bottom, 0.05);
        legs.capsule(sx * 2.4, 13.4, 10.3, sx * 2.4, 2.4, 11.3, 1.95, 1.25, o.bottom, 0.05);
        legs.ellipsoid(sx * 2.4, 1.15, 12.6, 1.5, 1.15, 3.4, o.shoe, 0.04, (_x, y) => y < 0.4 ? shade(o.shoe, 0.5) : o.shoe);
      } else {
        legs.capsule(sx * 2.3, 21.6, 0.1, sx * 2.2, 11.6, 0.55, 2.4, 1.9, o.bottom, 0.05);
        legs.capsule(sx * 2.2, 11.6, 0.55, sx * 2.0, 2.6, 0, 1.9, 1.2, o.bottom, 0.05);
        legs.ellipsoid(sx * 2.0, 1.15, 1.5, 1.5, 1.15, 3.4, o.shoe, 0.04, (_x, y) => y < 0.4 ? shade(o.shoe, 0.5) : o.shoe);
      }
    };
    leg(-1); leg(1);
    legs.ellipsoid(0, o.seated ? 14.3 : 21.4, o.seated ? -0.2 : 0, 4.6, 2.8, 3.2, o.bottom, 0.05);

    // ───────── 몸통 (골반 기준 좌표)
    const jacket = o.outfit === 'suit';
    const yLo = jacket ? -4.6 : -1.6;
    torso.shape(-6.5, yLo, -3.8, 6.5, 15.6, 3.8, (x, y, z) => {
      const ex = wx(y) + (jacket ? 0.45 : 0.15) + (y < 0 && jacket ? 0.35 : 0), ez = wz(y) + (jacket ? 0.45 : 0.15);
      if (Math.pow(Math.abs(x) / ex, 2.5) + Math.pow(Math.abs(z) / ez, 2.5) > 1) return -1;
      const front = z > 0.2, ax = Math.abs(x);
      if (o.outfit === 'suit') {
        const vw = y > 3 ? 0.35 + (y - 3) * 0.2 : -1;
        if (front && vw > 0 && ax < vw) return y > 11.6 && ax < (y - 11.6) * 0.5 ? skin : 0xf6f3ec;              // 셔츠 + 열린 칼라
        if (front && vw > 0 && ax < vw + 1.25 && y > 5.5) return shade(o.top, 1.25);                                // 라펠
        if (!front && y > 13.6) return shade(o.top, 0.9);
        return y < 0 ? shade(o.top, 0.85) : o.top;
      }
      if (o.outfit === 'cardigan') {
        if (front && y > 13.3 && ax < (y - 13.3) * 0.75) return skin;                                               // V넥
        if (front && ax < 1.55 && y > -1) return o.under;                                                            // 안쪽 블라우스
        if (front && ax < 1.95 && y > -1) return shade(o.top, 0.8);                                                  // 카디건 단
        return y < 0.2 ? o.bottom : o.top;
      }
      // blouse
      if (front && y > 13.4 && ax < (y - 13.4) * 0.7) return skin;
      if (y < 0.3) return o.bottom;
      if (y < 1.1) return ax < 0.6 && front ? 0xd6ad4c : 0x4a3226;                                                   // 벨트 + 버클
      return o.top;
    }, 0.035);
    if (F) for (const sx of [-1, 1]) torso.ellipsoid(sx * 1.85, 9.0, 2.15, 1.75, 1.55, 1.35, o.outfit === 'cardigan' ? o.top : o.top, 0.035);
    for (const sx of [-1, 1]) torso.ellipsoid(sx * this.shoulderX * 0.94, SH_Y - 0.1, 0, 1.85, 1.85, 1.9, jacket ? o.top : o.top, 0.035);
    // 목 + 칼라
    torso.capsule(0, 14.2, 0.1, 0, NECK + 0.5, 0.35, 1.4, 1.25, skin, 0.02);
    if (jacket) {
      torso.shape(-3, 13.4, -2.6, 3, 15.4, 2.8, (x, y, z) => {
        const r = Math.hypot(x / 2.2, (z - 0.1) / 2.0); return r <= 1 && r > 0.66 && y > 13.6 && !(z > 1.1 && Math.abs(x) < (y - 12) * 0.55) ? 0xf6f3ec : -1;
      }, 0.02);
    }
    if (o.pearls) for (let i = -6; i <= 6; i++) {
      const a = i / 6 * 1.05, x = Math.sin(a) * 2.7, y = 12.7 - Math.cos(a) * 1.5 + 1.0;
      const zz = wz(y) * Math.sqrt(Math.max(0.05, 1 - Math.pow(Math.abs(x) / wx(y), 2.5))) + 0.05;
      torso.ellipsoid(x, y, zz, 0.36, 0.36, 0.36, 0xfdfbf2, 0.02);
    }

    // ───────── 머리 (목 끝 기준) — 해상도 6
    const cran = (x: number, y: number, z: number) => (x / 2.3) ** 2 + ((y - 3.25) / 2.6) ** 2 + ((z + 0.1) / 2.7) ** 2 <= 1;
    const jw = F ? 1.9 : 2.1;
    const jaw = (x: number, y: number, z: number) => (x / jw) ** 2 + ((y - 1.55) / 1.75) ** 2 + ((z - 0.45) / 2.15) ** 2 <= 1;
    const cheek = (x: number, y: number, z: number) => (x / 2.1) ** 2 + ((y - 2.3) / 1.3) ** 2 + ((z - 0.35) / 2.3) ** 2 <= 1;
    head.shape(-3, -0.6, -3.2, 3, 6.4, 3.6, (x, y, z) => (cran(x, y, z) || jaw(x, y, z) || cheek(x, y, z)) ? skin : -1, 0.02);
    for (const sx of [-1, 1]) head.ellipsoid(sx * 2.3, 2.6, -0.2, 0.42, 0.85, 0.55, sSh, 0.02);                          // 귀
    head.ellipsoid(0, 2.3, 2.55, F ? 0.34 : 0.44, 0.9, 0.5, shade(skin, 0.97), 0.02);                                    // 콧대
    head.ellipsoid(0, 1.75, 2.9, F ? 0.5 : 0.62, 0.38, 0.45, shade(skin, 0.96), 0.02);                                   // 코끝
    if (!F) head.ellipsoid(0, 0.15, 2.15, 0.95, 0.5, 0.9, skin, 0.02);                                                   // 턱

    const skinDk = shade(skin, 0.8), lipC = o.lips;
    const eyeY = 3.2, ex0 = 1.0, U = 1 / 6;
    let eyeZ = 2.5;
    for (const sx of [-1, 1]) {
      const cx = sx * ex0;
      for (let i = -3; i <= 3; i++) for (let j = 0; j < 4; j++) {
        const x = cx + i * U, y = eyeY + j * U;
        const edge = Math.abs(i) === 3 || j === 3;
        const z = head.stamp(x, y, edge ? 0xe4dbd0 : 0xf8f4ee, 1); if (j === 1 && i === 0) eyeZ = z;
      }
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) head.stamp(cx - sx * 0.02 + (i - 1) * U, eyeY + j * U, j < 3 && i === 1 && j === 1 ? 0x0e0e0e : o.eye, 1);
      for (let i = -3; i <= 3; i++) head.stamp(cx + i * U, eyeY + 4 * U, 0x2a1c18, 1);                                  // 속눈썹 선
      head.stamp(cx + sx * 4 * U, eyeY + 3 * U, 0x2a1c18, 1); head.stamp(cx + sx * 4 * U, eyeY + 4 * U, 0x2a1c18, 1);   // 눈꼬리
      for (let i = -3; i <= 4; i++) head.stamp(cx + i * U * sx, eyeY + 1.0 + Math.abs(i - 1) * U * 0.3, shade(o.hair, F ? 0.75 : 0.6), 1); // 눈썹
      if (o.old) { for (let k = 0; k < 3; k++) head.stamp(cx + sx * (0.95 + k * 0.1), eyeY + 0.1 - k * 0.2, skinDk, 1); head.stamp(cx, eyeY - 0.28, shade(skin, 0.9), 1); }
      for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) if (i * i / 9 + j * j / 4 < 1) {                       // 볼터치
        const x = sx * 1.5 + i * U, y = 2.05 + j * U, zf = head.stamp(x, y, 0, 0);
        if (Number.isFinite(zf)) head.stamp(x, y, mix(head.getColor(x, y, zf - 0.05) ?? skin, 0xf0908a, 0.3), 1);
      }
    }
    for (const sx of [-1, 1]) { head.stamp(sx * 0.36, 1.6, shade(skin, 0.7), 1); head.stamp(sx * 0.36 + sx * U, 1.6, shade(skin, 0.7), 1); }   // 콧구멍
    if (o.old) for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) head.stamp(sx * (0.9 + k * 0.1), 1.5 - k * 0.17, skinDk, 1);       // 팔자주름
    const smile = o.smile ?? 0.5, mouthY = 0.92;
    for (let i = -6; i <= 6; i++) {
      const lift = Math.round(smile * Math.pow(Math.abs(i) / 6, 2) * 3) * U;
      head.stamp(i * U, mouthY + 2 * U + lift, shade(lipC, 0.72), 1);                                                    // 입선
      if (Math.abs(i) < 5) { head.stamp(i * U, mouthY + 3 * U + lift * 0.5, lipC, 1); head.stamp(i * U, mouthY + U + lift * 0.6, lipC, 1); head.stamp(i * U, mouthY + lift * 0.4, shade(lipC, 1.08), 1); }
    }
    const mouthZ = head.stamp(0, mouthY, 0, 0);

    // 머리카락
    const outer = (x: number, y: number, z: number) => (x / 2.65) ** 2 + ((y - 3.3) / 3.05) ** 2 + ((z + 0.1) / 3.05) ** 2 <= 1;
    const strand = (x: number, y: number, z: number) => {
      const n = Math.sin((x * 3.1 + z * 2.3 + y * 0.9) * 3.6) * 0.5 + 0.5;
      return shade(o.hair, 0.8 + n * 0.32 + (y > 4.6 ? 0.1 : 0) - (z < -1.5 ? 0.08 : 0));
    };
    const hl = (x: number) => (o.hairStyle === 'bun' ? 4.85 : 5.0) - Math.abs(x) * (o.hairStyle === 'bun' ? 0.5 : 0.4);
    const hairFn = (x: number, y: number, z: number): number => {
      const ax = Math.abs(x);
      if (o.hairStyle === 'long') {
        if (outer(x, y, z) && !(z > 0.6 && y < hl(x)) && !(ax > 2.0 && y < 2.2 && z > 0.2)) return strand(x, y, z);
        if (z > 0.6 && x < 0.4 && y > 4.4 - (x + 2.2) * 0.22 && (x / 2.7) ** 2 + ((y - 3.3) / 3.3) ** 2 + (z / 3.2) ** 2 <= 1) return strand(x, y, z);   // 앞머리
        const flare = 1 + Math.max(0, -y) * 0.07;
        if ((x / (2.9 * flare)) ** 2 + ((y - 0.4) / 4.6) ** 2 + ((z + 1.0) / 3.1) ** 2 <= 1 && z < 0.8) return strand(x, y, z);                              // 뒷머리
        if (ax > 1.85 && y > -3.2 && y < 4.2 && z > -0.8 && (x / (3.1 * flare)) ** 2 + ((z - 0.3) / 2.0) ** 2 <= 1 && (x / (3.0 * flare)) ** 2 + ((y - 0.6) / 4.4) ** 2 <= 1) return strand(x, y, z); // 옆머리
        return -1;
      }
      if (o.hairStyle === 'bun') {
        if ((x / 1.8) ** 2 + ((y - 5.4) / 1.4) ** 2 + ((z + 2.5) / 1.7) ** 2 <= 1) return strand(x, y, z + 0.5);
        if (outer(x, y, z) && !(z > 0.7 && y < hl(x)) && !(ax > 2.0 && y < 3.4 && z > -1.2) && !(z < -1.2 && y < 1.6) && !(y < 2.3 && z > -0.9)) return strand(x, y, z);
        return -1;
      }
      const vol = (x / 2.55) ** 2 + ((y - 4.5) / 1.4) ** 2 + ((z - 0.3) / 2.9) ** 2 <= 1;
      if ((outer(x, y, z) || vol) && !(z > 0.7 && y < hl(x) + (x > 0 ? 0.15 : -0.05)) && !(ax > 1.95 && y < 3.7 && z > 1.2)) {
        if (y < 2.3 && z > -0.9) return -1;
        if (ax > 1.85 && y < 1.7) return -1;
        if (z < -1.0 && y < 1.2) return -1;
        return strand(x, y, z);
      }
      if (ax > 1.8 && ax < 2.9 && z > -0.4 && z < 1.2 && y > 1.8 && y < 3.7 && (x / 2.9) ** 2 + ((z - 0.4) / 2) ** 2 <= 1) return strand(x, y, z);       // 구레나룻
      return -1;
    };
    head.shape(-4.2, -3.8, -4.6, 4.2, 7.6, 4.2, (x, y, z) => hairFn(x, y, z), 0.03);
    if (o.hairStyle === 'bun') for (const sx of [-1, 1]) head.ellipsoid(sx * 2.4, 2.6, -0.15, 0.42, 0.85, 0.5, sSh, 0.02);

    // ───────── 팔 (어깨 피벗, 아래로 늘어진 형태)
    for (const side of [-1, 1] as const) {
      const u = new Voxels(RES), f = new Voxels(6);
      const sleeveUp = o.top;
      u.capsule(0, 0, 0, 0, -UP, 0, 1.6, 1.25, sleeveUp, 0.035);
      u.ellipsoid(0, 0, 0, 1.7, 1.7, 1.7, sleeveUp, 0.035);
      const cuff = o.outfit === 'suit' ? 0xf6f3ec : shade(o.top, 1.1);
      const sleeveEnd = o.outfit === 'blouse' ? -3.4 : -6.5;
      f.capsule(0, 0, 0, 0, -6.6, 0, 1.25, 0.85, skin, 0.03, (_x, y) => y > sleeveEnd ? (o.outfit === 'suit' && y < -6.0 ? cuff : o.outfit === 'blouse' && y < sleeveEnd + 0.5 ? shade(o.top, 1.1) : o.top) : skin);
      f.ellipsoid(0, 0, 0, 1.3, 1.3, 1.3, o.outfit === 'blouse' ? o.top : o.top, 0.03);
      f.ellipsoid(0, -8.5, 0.05, 0.52, 2.15, 0.9, skin, 0.03, (_x, y, z) => (y < -8.4 && Math.round((z + 0.9) * 4) % 2 === 0) ? shade(skin, 0.86) : skin);
      f.capsule(0.35, -7.1, 0.75, 0.55, -8.5, 1.0, 0.34, 0.28, skin, 0.03);                                            // 엄지
      const um = u.build([0, 0, 0]), fm = f.build([0, 0, 0]);
      um.scale.setScalar(sc); fm.scale.setScalar(sc);
      scene.add(um, fm);
      this.arms.push({ upper: um, fore: fm, side });
    }

    // ───────── 메시 조립
    this.root.add(legs.build([0, 0, 0]));
    this.hip.add(torso.build([0, 0, 0]));
    this.hip.position.y = hy * VS; this.root.add(this.hip);
    this.head.add(head.build([0, 0, 0]));
    this.head.position.y = NECK * VS; this.hip.add(this.head);
    this.root.scale.setScalar(sc);
    // 눈꺼풀 (깜빡임) / 입 (허밍)
    for (const sx of [-1, 1]) {
      const lid = solid(1.35, 0.8, 0.12, shade(skin, 0.97), { shadow: false });
      lid.position.set(sx * ex0 * VS, (eyeY + 0.35) * VS, (eyeZ + 0.03) * VS); lid.visible = false; this.head.add(lid); this.lids.push(lid);
    }
    this.mouth = solid(1.3, 0.28, 0.14, lipC, { shadow: false });
    this.mouth.position.set(0, (mouthY + 0.12) * VS, ((Number.isFinite(mouthZ) ? mouthZ : 3) + 0.04) * VS);
    this.mouth.visible = false; this.head.add(this.mouth);
    this.root.userData.human = this;
    scene.add(this.root);
  }

  shoulder(side: -1 | 1) { return this.hip.localToWorld(new THREE.Vector3(side * this.shoulderX * VS, SH_Y * VS, 0)); }
  headWorld(x: number, y: number, z: number) { return this.head.localToWorld(new THREE.Vector3(x * VS, y * VS, z * VS)); }
  hipLocal(x: number, y: number, z: number) { return this.hip.localToWorld(new THREE.Vector3(x * VS, y * VS, z * VS)); }

  /** 2본 IK: 어깨 → 손끝. pole은 팔꿈치가 향할 방향 힌트 */
  reach(arm: Arm, target: THREE.Vector3, pole: THREE.Vector3) {
    this.root.updateMatrixWorld(true);
    const S = this.shoulder(arm.side);
    const a = UP * VS * this.sc, b = FO * VS * this.sc;
    const toT = target.clone().sub(S);
    let d = toT.length();
    d = Math.min(Math.max(d, 0.15), (a + b) * 0.995);
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

  blink(dt: number) {
    this.blinkT -= dt;
    const closing = this.blinkT < 0 && this.blinkT > -0.14;
    if (this.blinkT < -0.14) this.blinkT = 2.2 + Math.random() * 3.5;
    for (const l of this.lids) l.visible = closing;
  }
}
