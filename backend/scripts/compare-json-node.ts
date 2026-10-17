/**
 * 旧569件JSON vs 現行568件JSON の差分比較
 * Node.js で git show から直接読み込み
 */
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const root = path.resolve(__dirname, '../..');
const curPath = path.resolve(__dirname, '../src/data/fukuoka-school-address-map.json');

// git show で旧版を取得
const oldJson = execSync(
  'git show 5d96ace9:backend/src/data/fukuoka-school-address-map.json',
  { cwd: root, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
);

const old = JSON.parse(oldJson);
const cur = JSON.parse(fs.readFileSync(curPath, 'utf-8'));

const recs_old: any[] = old.records || [];
const recs_cur: any[] = cur.records || [];
console.log(`旧: ${recs_old.length}件, 新: ${recs_cur.length}件`);

function makeKey(r: any) {
  return `${r.ward}|${r.town}|${(r.range || '').slice(0, 60)}|${r.juniorHigh}`;
}

const map_old = new Map(recs_old.map(r => [makeKey(r), r]));
const map_cur = new Map(recs_cur.map(r => [makeKey(r), r]));

const deleted: any[] = [];
const added: any[] = [];

for (const [k, v] of map_old) {
  if (!map_cur.has(k)) deleted.push({ key: k, rec: v });
}
for (const [k, v] of map_cur) {
  if (!map_old.has(k)) added.push({ key: k, rec: v });
}

console.log(`\n削除された (${deleted.length}件):`);
for (const { rec } of deleted) {
  console.log(`  ward=${rec.ward} town=${rec.town}`);
  console.log(`  elem=${rec.elementary} / jh=${rec.juniorHigh}`);
  console.log(`  range=${(rec.range || '').slice(0, 80)}`);
}

console.log(`\n追加された (${added.length}件):`);
for (const { rec } of added) {
  console.log(`  ward=${rec.ward} town=${rec.town} source=${rec.source || ''}`);
  console.log(`  elem=${rec.elementary} / jh=${rec.juniorHigh}`);
  console.log(`  range=${(rec.range || '').slice(0, 80)}`);
}

// 569版に sc.html（さ行）由来で 周船寺中を含む記録があるか確認
const shuss_old = recs_old.filter(r => r.juniorHigh === '周船寺中');
const shuss_cur = recs_cur.filter(r => r.juniorHigh === '周船寺中');
console.log(`\n周船寺中: 旧=${shuss_old.length}件, 新=${shuss_cur.length}件`);
