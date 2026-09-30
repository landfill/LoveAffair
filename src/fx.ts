import * as THREE from 'three';
import { VS } from './voxel';
import { RZ0, SUN_DIR } from './world';
import { noteSprite, sparkTex } from './pixel';

/** 창문 유리 칸마다 비스듬한 빛기둥 (셰이더로 길이 방향 페이드) */
export function sunShafts(scene: THREE.Scene) {
  const g = new THREE.Group();
  const cols = [[-10, -2], [-1, 6], [7, 14]], rows = [[18, 30], [31, 43], [44, 56]];
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color(1.0, 0.82, 0.5) } },
    vertexShader: 'varying float vZ; varying vec3 vP; void main(){ vZ=position.z; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform float uT; uniform vec3 uCol; varying float vZ; varying vec3 vP; void main(){ float f = smoothstep(0.,0.6,vZ)*(1.-smoothstep(4.0,10.0,vZ)); float s = 0.85+0.15*sin(uT*0.6+vP.x*6.+vP.y*4.); gl_FragColor=vec4(uCol, 0.075*f*s); }',
  });
  const k = new THREE.Vector2(SUN_DIR.x / SUN_DIR.z, SUN_DIR.y / SUN_DIR.z);
  for (const [x0, x1] of cols) for (const [y0, y1] of rows) {
    const L = 11;
    const geo = new THREE.BoxGeometry((x1 - x0) * VS, (y1 - y0) * VS, L, 1, 1, 8);
    geo.translate(0, 0, L / 2);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setX(i, p.getX(i) + k.x * z); p.setY(i, p.getY(i) + k.y * z); }
    const m = new THREE.Mesh(geo, mat);
    m.position.set(((x0 + x1) / 2) * VS, ((y0 + y1) / 2) * VS, (RZ0 - 0.4) * VS);
    m.renderOrder = 5;
    g.add(m);
  }
  scene.add(g);
  return { update: (t: number) => { mat.uniforms.uT.value = t; } };
}

/** 빛 속에 떠다니는 먼지 (픽셀 사각 포인트) */
export function dust(scene: THREE.Scene) {
  const N = 260;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = Math.random() * 6.28; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xfff0c4, size: 0.028, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, map: sparkTex() });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  const k = SUN_DIR.x / SUN_DIR.z, ky = SUN_DIR.y / SUN_DIR.z;
  return {
    update(t: number) {
      for (let i = 0; i < N; i++) {
        const s0 = seed[i * 3], s1 = seed[i * 3 + 1], ph = seed[i * 3 + 2];
        const along = ((s0 * 8 + t * 0.03 * (0.5 + s1)) % 1) * 7 + 0.2;
        const px = (-1.0 + s1 * 2.4) + Math.sin(t * 0.3 + ph) * 0.06, py = (1.9 + ((s0 * 7.3 + s1) % 1) * 3.6) + Math.cos(t * 0.25 + ph) * 0.05;
        pos[i * 3] = px + k * along; pos[i * 3 + 1] = py + ky * along + Math.sin(t * 0.5 + ph) * 0.04; pos[i * 3 + 2] = -4.0 + along;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

/** 떠오르는 픽셀 음표 스프라이트 */
export function noteEmitter(scene: THREE.Scene) {
  const tex = [noteSprite('#ffd2e0', 0), noteSprite('#fff2b0', 1), noteSprite('#ffffff', 0), noteSprite('#ffb26b', 1)];
  const list: { s: THREE.Sprite; life: number; max: number; v: THREE.Vector3; ph: number }[] = [];
  return {
    emit(p: THREE.Vector3, k = 0) {
      const m = new THREE.SpriteMaterial({ map: tex[k % tex.length], transparent: true, depthWrite: false, toneMapped: false });
      const s = new THREE.Sprite(m); s.scale.set(0.2, 0.2, 1); s.position.copy(p); scene.add(s);
      list.push({ s, life: 0, max: 2.6 + Math.random(), v: new THREE.Vector3((Math.random() - 0.3) * 0.05, 0.28 + Math.random() * 0.1, (Math.random() - 0.2) * 0.05), ph: Math.random() * 6 });
    },
    update(dt: number) {
      for (let i = list.length - 1; i >= 0; i--) {
        const n = list[i]; n.life += dt;
        const u = n.life / n.max;
        n.s.position.addScaledVector(n.v, dt); n.s.position.x += Math.sin(n.life * 2.2 + n.ph) * dt * 0.09;
        (n.s.material as THREE.SpriteMaterial).opacity = u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.15) / 0.85);
        if (u >= 1) { scene.remove(n.s); (n.s.material as THREE.Material).dispose(); list.splice(i, 1); }
      }
    },
  };
}
