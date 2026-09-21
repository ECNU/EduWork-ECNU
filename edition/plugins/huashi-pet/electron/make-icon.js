/**
 * 小花狮图标生成器（无第三方依赖）
 * node make-icon.js → assets/icon.png(256) + assets/tray.png(32)
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ---------- 极简 PNG 编码器 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- 小画布（归一化坐标 -1..1）----------
function makeCanvas(size) {
  const buf = Buffer.alloc(size * size * 4);
  const px = (x, y) => {
    const X = Math.round((x + 1) * size / 2);
    const Y = Math.round((y + 1) * size / 2);
    return [X, Y];
  };
  const inR = (X, Y, cx, cy, rx, ry) => ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1;
  const fill = (fn, r, g, b, a = 255) => {
    for (let Y = 0; Y < size; Y++) for (let X = 0; X < size; X++) {
      if (fn(X, Y)) {
        const i = (Y * size + X) * 4;
        buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
      }
    }
  };
  return { size, buf, px, inR, fill };
}

function drawHuaShi(size) {
  const c = makeCanvas(size);
  const { px, inR, fill } = c;
  const cx = size / 2, cy = size / 2;
  const S = size / 2; // 归一化倍率

  // 花瓣鬃毛（6 片，深橙）
  const petalCX = [0, 0.87, 0.87, 0, -0.87, -0.87].map(v => cx + v * 0.30 * S);
  const petalCY = [-0.62, -0.31, 0.31, 0.62, 0.31, -0.31].map(v => cy + v * 0.30 * S);
  // 简化为外圈 6 个圆（旋转椭圆近似），中心 (0,-0.31)
  const OCX = cx, OCY = cy - 0.31 * S, OR = 0.30 * S;
  for (let i = 0; i < 6; i++) {
    const ang = (i * 60 - 90) * Math.PI / 180;
    const px2 = OCX + OR * Math.cos(ang), py2 = OCY + OR * Math.sin(ang);
    fill((X, Y) => inR(X, Y, px2, py2, 0.20 * S, 0.20 * S), 242, 130, 22); // #F28216
  }
  // 头
  fill((X, Y) => inR(X, Y, cx, cy - 0.05 * S, 0.36 * S, 0.36 * S), 255, 184, 77); // #FFB84D
  // 耳朵
  fill((X, Y) => inR(X, Y, cx - 0.26 * S, cy - 0.33 * S, 0.10 * S, 0.12 * S), 255, 184, 77);
  fill((X, Y) => inR(X, Y, cx + 0.26 * S, cy - 0.33 * S, 0.10 * S, 0.12 * S), 255, 184, 77);
  // 口鼻
  fill((X, Y) => inR(X, Y, cx, cy + 0.08 * S, 0.16 * S, 0.12 * S), 255, 232, 194);
  // 眼睛
  fill((X, Y) => inR(X, Y, cx - 0.13 * S, cy - 0.05 * S, 0.055 * S, 0.06 * S), 74, 46, 26);
  fill((X, Y) => inR(X, Y, cx + 0.13 * S, cy - 0.05 * S, 0.055 * S, 0.06 * S), 74, 46, 26);
  fill((X, Y) => inR(X, Y, cx - 0.155 * S, cy - 0.085 * S, 0.02 * S, 0.02 * S), 255, 255, 255);
  fill((X, Y) => inR(X, Y, cx + 0.105 * S, cy - 0.085 * S, 0.02 * S, 0.02 * S), 255, 255, 255);
  // 腮红
  fill((X, Y) => inR(X, Y, cx - 0.21 * S, cy + 0.07 * S, 0.045 * S, 0.03 * S), 255, 140, 160, 190);
  fill((X, Y) => inR(X, Y, cx + 0.21 * S, cy + 0.07 * S, 0.045 * S, 0.03 * S), 255, 140, 160, 190);
  // T 恤（身体红）
  fill((X, Y) => inR(X, Y, cx, cy + 0.30 * S, 0.30 * S, 0.26 * S), 196, 43, 60); // #C42B3C
  // 徽章白圆 + 红点
  fill((X, Y) => inR(X, Y, cx, cy + 0.34 * S, 0.085 * S, 0.085 * S), 255, 255, 255);
  fill((X, Y) => inR(X, Y, cx - 0.02 * S, cy + 0.325 * S, 0.045 * S, 0.045 * S), 196, 43, 60);
  return c.buf;
}

const outDir = path.join(__dirname, 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.png'), encodePNG(256, 256, drawHuaShi(256)));
fs.writeFileSync(path.join(outDir, 'tray.png'), encodePNG(32, 32, drawHuaShi(32)));
console.log('icons generated: icon.png(256) tray.png(32)');
