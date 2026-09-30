import * as THREE from 'three';

/** 복셀 1칸의 월드 크기 */
export const VS = 0.1;
const OFF = 512;
const key = (x: number, y: number, z: number) => ((x + OFF) << 20) | ((y + OFF) << 10) | (z + OFF);

function hash(x: number, y: number, z: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function shade(c: number, f: number) {
  const r = Math.min(255, Math.max(0, ((c >> 16) & 255) * f));
  const g = Math.min(255, Math.max(0, ((c >> 8) & 255) * f));
  const b = Math.min(255, Math.max(0, (c & 255) * f));
  return (r << 16) | (g << 8) | b;
}

const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

export const sharedMat = new THREE.MeshLambertMaterial({ vertexColors: true });

/** 코드로만 그리는 복셀 그리드 → 면 컬링된 단일 메시 */
export class Voxels {
  private d = new Map<number, number>();
  get size() { return this.d.size; }

  set(x: number, y: number, z: number, c: number, jitter = 0) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    this.d.set(key(x, y, z), jitter ? shade(c, 1 + (hash(x, y, z) - 0.5) * 2 * jitter) : c);
  }
  del(x: number, y: number, z: number) { this.d.delete(key(x, y, z)); }
  has(x: number, y: number, z: number) { return this.d.has(key(x, y, z)); }
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number, jitter = 0) {
    for (let x = Math.floor(x0); x < x1; x++) for (let y = Math.floor(y0); y < y1; y++) for (let z = Math.floor(z0); z < z1; z++) this.set(x, y, z, c, jitter);
  }
  clear(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) this.del(x, y, z);
  }

  build(pivot: [number, number, number] = [0, 0, 0], o: { cast?: boolean; receive?: boolean; mat?: THREE.Material } = {}) {
    const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
    const tmp = new THREE.Color();
    for (const [k, c] of this.d) {
      const x = ((k >> 20) & 1023) - OFF, y = ((k >> 10) & 1023) - OFF, z = (k & 1023) - OFF;
      tmp.setHex(c);
      for (const f of FACES) {
        if (this.d.has(key(x + f.n[0], y + f.n[1], z + f.n[2]))) continue;
        const b = pos.length / 3;
        for (const v of f.v) {
          pos.push((x + v[0] - pivot[0]) * VS, (y + v[1] - pivot[1]) * VS, (z + v[2] - pivot[2]) * VS);
          nor.push(f.n[0], f.n[1], f.n[2]);
          col.push(tmp.r, tmp.g, tmp.b);
        }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
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

/** 복셀 단위(정수 아님 허용) 박스 메시 — 건반·눈 등 움직이는 부품용 */
export function solid(w: number, h: number, d: number, color: number, o: { emissive?: number; shadow?: boolean } = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w * VS, h * VS, d * VS),
    new THREE.MeshLambertMaterial({ color, emissive: o.emissive ?? 0x000000 }),
  );
  m.castShadow = o.shadow ?? true; m.receiveShadow = true;
  return m;
}

export const rnd = (() => { let s = 1234567; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; })();
export { shade };
