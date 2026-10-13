const fs = require('fs');
const path = require('path');

const EPS = 1e-7;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const eq = (a, b) => Math.abs(a - b) <= EPS;

function signedArea(poly) {
  return poly.reduce((s, p, i) => s + p[0] * poly[(i + 1) % poly.length][1] - p[1] * poly[(i + 1) % poly.length][0], 0) / 2;
}
function normalizePolygon(poly) {
  let p = poly.slice();
  if (p.length > 1 && eq(p[0][0], p[p.length - 1][0]) && eq(p[0][1], p[p.length - 1][1])) p.pop();
  return p;
}
function cross(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function pointOnSegment(p, a, b) { return Math.abs(cross(a, b, p)) <= EPS && p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS; }
function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (pointOnSegment(p, a, b)) return true;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function orientation(a, b, c) { const v = cross(a, b, c); return Math.abs(v) <= EPS ? 0 : v > 0 ? 1 : -1; }
function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c), o2 = orientation(a, b, d), o3 = orientation(c, d, a), o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && pointOnSegment(c, a, b)) || (o2 === 0 && pointOnSegment(d, a, b)) || (o3 === 0 && pointOnSegment(a, c, d)) || (o4 === 0 && pointOnSegment(b, c, d));
}
function rectPoints(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
function bbox(poly) { return poly.reduce((r, p) => ({ minX: Math.min(r.minX, p[0]), minX0: r.minX0, maxX: Math.max(r.maxX, p[0]), minY: Math.min(r.minY, p[1]), maxY: Math.max(r.maxY, p[1]) }), { minX: Infinity, minX0: 0, maxX: -Infinity, minY: Infinity, maxY: -Infinity }); }
function rectInside(poly, rect) {
  if (!rect.every(p => pointInPolygon(p, poly))) return false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    for (let j = 0; j < rect.length; j++) if (segmentsIntersect(a, b, rect[j], rect[(j + 1) % rect.length]) && !rect.some(q => pointOnSegment(q, a, b))) return false;
  }
  return true;
}
function rectOverlap(a, b) { return a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS; }
function distanceToBoundary(rect, poly) {
  let d = Infinity;
  for (const p of rect) for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
    d = Math.min(d, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)));
  }
  return d;
}
function doorForbidden(input, poly) {
  if (!input.door || input.door.length !== 2) return null;
  const [a, b] = input.door;
  const n = input.isOpenInward ? Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) : 0;
  if (!n) return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]) || 1, h: Math.abs(a[1] - b[1]) || 1 };
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const c1 = [a[0] - uy * n, a[1] + ux * n], c2 = [b[0] - uy * n, b[1] + ux * n];
  const c3 = [b[0], b[1]], c4 = [a[0], a[1]];
  const candidates = [rectFromPoints([a, b, c1, c2]), rectFromPoints([a, b, [b[0] + uy * n, b[1] - ux * n], [a[0] + uy * n, a[1] - ux * n]])];
  return candidates.find(r => rectInside(poly, rectPoints(r.x, r.y, r.w, r.h))) || candidates[0];
}
function rectFromPoints(points, y, w, h) {
  if (Array.isArray(points) && Array.isArray(points[0])) { const xs = points.map(p => p[0]), ys = points.map(p => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; }
  return { x: points, y, w, h };
}
function solve(input) {
  if (!input || !Array.isArray(input.boundary) || input.boundary.length < 3) throw new Error('boundary 必须是至少包含 3 个点的数组');
  if (!input.algoToPlace || typeof input.algoToPlace !== 'object') throw new Error('algoToPlace 必须是对象');
  const boundary = normalizePolygon(input.boundary);
  const box = bbox(boundary);
  const forbiddenDoor = doorForbidden(input, boundary);
  const items = Object.entries(input.algoToPlace || {}).map(([id, size]) => ({ id, length: size[0], width: size[1], type: id.split('-')[0] }));
  // Large objects first makes the greedy search substantially less likely to fragment the free space.
  items.sort((a, b) => b.length * b.width - a.length * a.width);
  const placed = [];
  const candidates = [];
  const step = Math.max(1, Math.min(box.maxX - box.minX, box.maxY - box.minY) / 180);
  const addCandidates = (w, h) => {
    const xs = [box.minX, box.maxX - w, ...boundary.map(p => p[0]), ...placed.flatMap(r => [r.x + r.w, r.x - w])];
    const ys = [box.minY, box.maxY - h, ...boundary.map(p => p[1]), ...placed.flatMap(r => [r.y + r.h, r.y - h])];
    for (const x0 of xs) for (const y0 of ys) for (let x = x0 - step; x <= x0 + step + EPS; x += step) for (let y = y0 - step; y <= y0 + step + EPS; y += step) candidates.push({ x, y, w, h });
  };
  for (const item of items) {
    const options = item.length === item.width ? [[item.length, item.width, 0]] : [[item.length, item.width, 0], [item.width, item.length, 90]];
    let best = null;
    for (const [w, h, rotation] of options) {
      candidates.length = 0; addCandidates(w, h);
      for (const r of candidates) {
        const corners = rectPoints(r.x, r.y, r.w, r.h);
        if (!rectInside(boundary, corners)) continue;
        if (forbiddenDoor && rectOverlap(r, forbiddenDoor)) continue;
        if (placed.some(p => rectOverlap(r, p))) continue;
        const wall = distanceToBoundary(corners, boundary);
        const nearest = placed.length ? Math.min(...placed.map(p => Math.hypot(r.x + r.w / 2 - (p.x + p.w / 2), r.y + r.h / 2 - (p.y + p.h / 2)))) : 0;
        const score = wall * 1000 + nearest * 0.01 + r.y * 0.000001 + r.x * 0.000001;
        if (!best || score < best.score) best = { ...r, rotation, score };
      }
    }
    if (!best) return { feasible: false, placements: [], reason: `无法放置物品: ${item.id}` };
    placed.push(best);
  }
  return { feasible: true, placements: placed.map(r => ({ id: items[placed.indexOf(r)].id, center: [Number((r.x + r.w / 2).toFixed(4)), Number((r.y + r.h / 2).toFixed(4))], rotation: r.rotation, size: [r.w, r.h] })) };
}
if (require.main === module) {
  const file = process.argv[2] || 'example1.json';
  const input = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'));
  console.log(JSON.stringify(solve(input), null, 2));
}
module.exports = { solve };
