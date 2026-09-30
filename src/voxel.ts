import * as THREE from 'three';

/** 레거시 "유닛" 1칸의 월드 크기 (약 3.75cm). 실제 복셀은 유닛을 res 등분한 크기 */
export const VS = 0.1;
const OFF = 512;
const key = (x: number, y: number, z: number) => ((x + OFF) << 20) | ((y + OFF) << 10) | (z + OFF);

function hash(x: number, y: number, z: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function shade(c: number, f: number) {
  const r = Math.min(255, Math.max(0, ((c >> 16) & 255) * f));
  const g = Math.min(255, Math.max(0, ((c >> 8) & 255) * f));
  const b = Math.min(255, Math.max(0, (c & 255) * f));
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
export function mix(a: number, b: number, t: number) {
  const r = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t, g = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t, bl = (a & 255) * (1 - t) + (b & 255) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

const AO = [0.62, 0.76, 0.88, 1];
const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

export const sharedMat = new THREE.MeshLambertMaterial({ vertexColors: true });

/**
 * 코드로만 그리는 복셀 그리드. 좌표는 "유닛"(실수 허용), 내부는 res배 세밀한 복셀.
 * 면 컬링 + 정점 앰비언트 오클루전으로 단일 메시를 만든다.
 */
export class Voxels {
  private d = new Map<number, number>();
  constructor(public res = 2) {}
  get size() { return this.d.size; }
  private R(v: number) { return Math.round(v * this.res); }

  private put(fx: number, fy: number, fz: number, c: number, j: number) {
    if (j) {
      const r = this.res;
      const f = 1 + (hash(fx, fy, fz) - 0.5) * j * 0.9 + (hash(Math.floor(fx / r), Math.floor(fy / r), Math.floor(fz / r)) - 0.5) * j * 1.1;
      c = shade(c, f);
    }
    this.d.set(key(fx, fy, fz), c);
  }
  set(x: number, y: number, z: number, c: number, jitter = 0) { this.box(x, y, z, x + 1, y + 1, z + 1, c, jitter); }
  del(x: number, y: number, z: number) { this.clear(x, y, z, x + 1, y + 1, z + 1); }
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number, jitter = 0) {
    const a = this.R(x0), b = this.R(y0), e = this.R(z0), A = this.R(x1), B = this.R(y1), E = this.R(z1);
    for (let x = a; x < A; x++) for (let y = b; y < B; y++) for (let z = e; z < E; z++) this.put(x, y, z, c, jitter);
  }
  clear(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const a = this.R(x0), b = this.R(y0), e = this.R(z0), A = this.R(x1), B = this.R(y1), E = this.R(z1);
    for (let x = a; x < A; x++) for (let y = b; y < B; y++) for (let z = e; z < E; z++) this.d.delete(key(x, y, z));
  }
  hasU(x: number, y: number, z: number) { return this.d.has(key(this.R(x), this.R(y), this.R(z))); }

  /** fn(x,y,z)는 복셀 중심의 유닛 좌표를 받아 색(>=0) 또는 -1(비움)을 돌려준다 */
  shape(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, fn: (x: number, y: number, z: number, fx: number, fy: number, fz: number) => number, jitter = 0) {
    const r = this.res, a = this.R(x0), b = this.R(y0), e = this.R(z0), A = this.R(x1), B = this.R(y1), E = this.R(z1);
    for (let x = a; x < A; x++) for (let y = b; y < B; y++) for (let z = e; z < E; z++) {
      const c = fn((x + 0.5) / r, (y + 0.5) / r, (z + 0.5) / r, x, y, z);
      if (c >= 0) this.put(x, y, z, c, jitter);
    }
  }
  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, c: number, jitter = 0, colorFn?: (x: number, y: number, z: number) => number) {
    this.shape(cx - rx, cy - ry, cz - rz, cx + rx, cy + ry, cz + rz, (x, y, z) => {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
      return dx * dx + dy * dy + dz * dz <= 1 ? (colorFn ? colorFn(x, y, z) : c) : -1;
    }, jitter);
  }
  /** 두 점 사이의 (반지름이 변하는) 캡슐 */
  capsule(ax: number, ay: number, az: number, bx: number, by: number, bz: number, r0: number, r1: number, c: number, jitter = 0, colorFn?: (x: number, y: number, z: number, t: number) => number) {
    const m = Math.max(r0, r1);
    const dx = bx - ax, dy = by - ay, dz = bz - az, L2 = dx * dx + dy * dy + dz * dz || 1;
    this.shape(Math.min(ax, bx) - m, Math.min(ay, by) - m, Math.min(az, bz) - m, Math.max(ax, bx) + m, Math.max(ay, by) + m, Math.max(az, bz) + m, (x, y, z) => {
      let t = ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / L2; t = Math.min(1, Math.max(0, t));
      const px = ax + dx * t - x, py = ay + dy * t - y, pz = az + dz * t - z, r = r0 + (r1 - r0) * t;
      return px * px + py * py + pz * pz <= r * r ? (colorFn ? colorFn(x, y, z, t) : c) : -1;
    }, jitter);
  }
  /** 가장 앞쪽(+z) 복셀을 찾아 색을 덧칠 — 얼굴 그리기용. 표면 z(유닛)를 돌려준다 */
  stamp(x: number, y: number, c: number, depth = 1, zFrom = 20, zTo = -20) {
    const fx = Math.floor(x * this.res), fy = Math.floor(y * this.res);
    for (let fz = Math.round(zFrom * this.res); fz > Math.round(zTo * this.res); fz--) {
      if (this.d.has(key(fx, fy, fz))) { for (let k = 0; k < depth; k++) if (this.d.has(key(fx, fy, fz - k))) this.d.set(key(fx, fy, fz - k), c); return (fz + 1) / this.res; }
    }
    return NaN;
  }
  getColor(x: number, y: number, z: number) { return this.d.get(key(this.R(x), this.R(y), this.R(z))); }

  build(pivot: [number, number, number] = [0, 0, 0], o: { cast?: boolean; receive?: boolean; mat?: THREE.Material } = {}) {
    const res = this.res, sc = VS / res;
    const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
    const tmp = new THREE.Color();
    const has = (x: number, y: number, z: number) => this.d.has(key(x, y, z)) ? 1 : 0;
    const ao = [0, 0, 0, 0];
    for (const [k, c] of this.d) {
      const x = ((k >> 20) & 1023) - OFF, y = ((k >> 10) & 1023) - OFF, z = (k & 1023) - OFF;
      tmp.setHex(c);
      for (const f of FACES) {
        const nx = f.n[0], ny = f.n[1], nz = f.n[2];
        if (this.d.has(key(x + nx, y + ny, z + nz))) continue;
        const ax = nx ? 0 : 1, bx = nx || ny ? 2 : 1; // 접선 축 (a,b)
        const t1 = nx ? 1 : 0, t2 = nz ? 1 : 2;
        void ax; void bx;
        const b = pos.length / 3;
        for (let i = 0; i < 4; i++) {
          const v = f.v[i];
          const u = v[t1] ? 1 : -1, w = v[t2] ? 1 : -1;
          const o1 = [0, 0, 0], o2 = [0, 0, 0];
          o1[t1] = u; o2[t2] = w;
          const bxp = x + nx, byp = y + ny, bzp = z + nz;
          const s1 = has(bxp + o1[0], byp + o1[1], bzp + o1[2]), s2 = has(bxp + o2[0], byp + o2[1], bzp + o2[2]);
          const cc = has(bxp + o1[0] + o2[0], byp + o1[1] + o2[1], bzp + o1[2] + o2[2]);
          ao[i] = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
          pos.push((x + v[0] - pivot[0] * res) * sc, (y + v[1] - pivot[1] * res) * sc, (z + v[2] - pivot[2] * res) * sc);
          nor.push(nx, ny, nz);
          const m = AO[ao[i]];
          col.push(tmp.r * m, tmp.g * m, tmp.b * m);
        }
        if (ao[0] + ao[2] >= ao[1] + ao[3]) idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        else idx.push(b + 1, b + 2, b + 3, b + 1, b + 3, b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, o.mat ?? sharedMat);
    m.castShadow = o.cast ?? true;
    m.receiveShadow = o.receive ?? true;
    return m;
  }
}

/** 움직이는 부품(건반·눈꺼풀·입)용 박스 메시 (유닛 단위) */
export function solid(w: number, h: number, d: number, color: number, o: { emissive?: number; shadow?: boolean } = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w * VS, h * VS, d * VS),
    new THREE.MeshLambertMaterial({ color, emissive: o.emissive ?? 0x000000 }),
  );
  m.castShadow = o.shadow ?? true; m.receiveShadow = true;
  return m;
}

export const rnd = (() => { let s = 1234567; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; })();
export const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
export const noise = (x: number, y: number, z: number) => hash(Math.floor(x * 4), Math.floor(y * 4), Math.floor(z * 4));
