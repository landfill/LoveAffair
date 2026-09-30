import * as THREE from 'three';

/** 3x5 미니 비트맵 폰트 */
const G: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
  '9': '111101111001110', ' ': '000000000000000', '-': '000000111000000', '.': '000000000000010', ',': '000000000010100',
  "'": '010010000000000', '!': '010010010000010', ':': '000010000010000',
};
export function pixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, s: number, color: string, shadow?: string) {
  const draw = (ox: number, oy: number, col: string) => {
    ctx.fillStyle = col;
    let cx = x + ox;
    for (const ch of text.toUpperCase()) {
      const g = G[ch] ?? G[' '];
      for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3) * s, y + oy + Math.floor(i / 3) * s, s, s);
      cx += 4 * s;
    }
  };
  if (shadow) draw(s, s, shadow);
  draw(0, 0, color);
}
export const textWidth = (t: string, s: number) => t.length * 4 * s - s;

const P = (rows: string[], pal: Record<string, string>, ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  rows.forEach((r, j) => [...r].forEach((c, i) => { if (pal[c]) { ctx.fillStyle = pal[c]; ctx.fillRect(x + i * s, y + j * s, s, s); } }));
};
export const HEART = ['.11.11.', '1221221', '1222221', '.12221.', '..121..', '...1...'];
export const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, a = '#ff5a7a', b = '#ffb3c4') => P(HEART, { '1': a, '2': b }, ctx, x, y, s);

export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!; c.imageSmoothingEnabled = false; draw(c);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false;
  return t;
}

/** 창밖 풍경 (픽셀 아트): 노을빛 하늘, 구름, 언덕, 벚나무 */
export function skyTexture() {
  return canvasTex(96, 96, c => {
    const bands = ['#ffe9b8', '#ffdfa0', '#ffd490', '#fbc98a', '#f6bd88', '#eeb08a'];
    for (let y = 0; y < 60; y++) { c.fillStyle = bands[Math.min(5, Math.floor(y / 10))]; c.fillRect(0, y, 96, 1); if (y % 10 > 6) { c.fillStyle = bands[Math.min(5, Math.floor(y / 10) + 1)]; for (let x = y % 2; x < 96; x += 2) c.fillRect(x, y, 1, 1); } }
    c.fillStyle = '#fff8dc'; c.beginPath(); c.arc(70, 26, 9, 0, 7); c.fill();
    c.fillStyle = '#fffbe8'; c.beginPath(); c.arc(70, 26, 6, 0, 7); c.fill();
    c.fillStyle = '#fff4dc';
    for (const [x, y, w] of [[8, 14, 22], [40, 8, 18], [55, 40, 26], [4, 36, 16]]) { c.fillRect(x, y, w, 3); c.fillRect(x + 3, y - 2, w - 8, 2); c.fillRect(x + 2, y + 3, w - 5, 2); }
    c.fillStyle = '#b7c28a'; for (let x = 0; x < 96; x++) c.fillRect(x, 58 + Math.round(Math.sin(x / 9) * 3), 1, 40);
    c.fillStyle = '#8fae6a'; for (let x = 0; x < 96; x++) c.fillRect(x, 68 + Math.round(Math.sin(x / 6 + 2) * 3), 1, 40);
    c.fillStyle = '#6f8f4c'; c.fillRect(0, 84, 96, 12);
    c.fillStyle = '#6b4a34'; c.fillRect(22, 48, 4, 36); c.fillRect(19, 60, 4, 2); c.fillRect(26, 55, 5, 2);
    for (const [x, y, r] of [[24, 40, 16], [12, 48, 9], [36, 50, 9]]) for (let i = 0; i < r * 8; i++) { const a = i * 2.4, d = Math.sqrt(i / (r * 8)) * r; c.fillStyle = ['#ffc4d4', '#ffdbe6', '#f79db6'][i % 3]; c.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.8), 2, 2); }
    c.fillStyle = '#ffdbe6'; for (let i = 0; i < 24; i++) c.fillRect((i * 37) % 96, 60 + ((i * 53) % 30), 1, 1);
  });
}

export function paintingTexture(kind: number) {
  return canvasTex(40, 30, c => {
    if (kind === 0) { // 바다와 노을
      for (let y = 0; y < 16; y++) { c.fillStyle = ['#7aa6d6', '#93b8de', '#f4c48a', '#f7a77a'][Math.min(3, Math.floor(y / 4))]; c.fillRect(0, y, 40, 1); }
      for (let y = 16; y < 30; y++) { c.fillStyle = y % 3 ? '#3f6f9a' : '#5f8fb8'; c.fillRect(0, y, 40, 1); }
      c.fillStyle = '#fff1c4'; c.fillRect(18, 10, 5, 5); c.fillStyle = '#ffe08a'; for (let y = 16; y < 30; y += 2) c.fillRect(19 - (y - 16) / 4 | 0, y, 3 + (y - 16) / 2 | 0, 1);
      c.fillStyle = '#fff'; c.fillRect(28, 12, 1, 4); c.fillRect(29, 13, 3, 3);
    } else { // 정원의 꽃
      c.fillStyle = '#cfe6c4'; c.fillRect(0, 0, 40, 30);
      c.fillStyle = '#9cc98d'; for (let y = 14; y < 30; y++) c.fillRect(0, y, 40, 1);
      for (let i = 0; i < 26; i++) { const x = (i * 13) % 38 + 1, y = 12 + ((i * 7) % 16); c.fillStyle = '#4f8a44'; c.fillRect(x, y + 1, 1, 6); c.fillStyle = ['#f27d9c', '#ffd35a', '#fff', '#c98be0'][i % 4]; c.fillRect(x - 1, y, 3, 2); }
    }
  });
}

export function scoreTexture() {
  return canvasTex(32, 24, c => {
    c.fillStyle = '#f7f0dc'; c.fillRect(0, 0, 32, 24);
    c.fillStyle = '#5a4a3a';
    for (const y0 of [4, 14]) { for (let i = 0; i < 5; i++) c.fillRect(2, y0 + i * 1.5 | 0, 28, 1); for (let n = 0; n < 8; n++) { const y = y0 + ((n * 5) % 6); c.fillRect(4 + n * 3, y, 2, 2); c.fillRect(5 + n * 3, y - 4, 1, 4); } }
  });
}

export function noteSprite(color: string, kind = 0) {
  return canvasTex(8, 8, c => {
    c.fillStyle = color;
    if (kind === 0) { c.fillRect(2, 5, 3, 2); c.fillRect(1, 6, 2, 1); c.fillRect(4, 1, 1, 5); c.fillRect(5, 1, 2, 1); c.fillRect(6, 2, 1, 1); }
    else { c.fillRect(1, 5, 2, 2); c.fillRect(5, 4, 2, 2); c.fillRect(2, 1, 1, 5); c.fillRect(6, 0, 1, 5); c.fillRect(2, 1, 5, 1); }
  });
}
export function sparkTex() {
  return canvasTex(4, 4, c => { c.fillStyle = '#fff'; c.fillRect(1, 0, 2, 4); c.fillRect(0, 1, 4, 2); });
}
