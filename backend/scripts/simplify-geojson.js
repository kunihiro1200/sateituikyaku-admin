/**
 * GeoJSONのポリゴンをDouglas-Peuckerで簡略化してファイルサイズを削減
 */
const fs = require('fs');
const path = require('path');

const INPUT = path.resolve(__dirname, '../src/data/school-districts.json');
const TOLERANCE = 0.0003; // 約30m

function perpendicularDistance(point, lineStart, lineEnd) {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
  }
  return Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / Math.sqrt(dx * dx + dy * dy);
}

function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIdx), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [points[0], points[end]];
}

const data = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
let totalBefore = 0;
let totalAfter = 0;

data.features.forEach(f => {
  if (f.geometry && f.geometry.coordinates) {
    f.geometry.coordinates = f.geometry.coordinates.map(ring => {
      totalBefore += ring.length;
      // 最低限のポイント数は保持（閉じたリングなので最低4点）
      const simplified = douglasPeucker(ring, TOLERANCE);
      // リングを閉じる
      if (simplified.length >= 3) {
        const first = simplified[0];
        const last = simplified[simplified.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          simplified.push(first);
        }
      }
      totalAfter += simplified.length;
      return simplified;
    });
  }
});

fs.writeFileSync(INPUT, JSON.stringify(data));
const size = (fs.statSync(INPUT).size / 1024 / 1024).toFixed(2);
console.log(`Points: ${totalBefore} → ${totalAfter} (${((1 - totalAfter/totalBefore)*100).toFixed(1)}% reduction)`);
console.log(`File size: ${size} MB`);
