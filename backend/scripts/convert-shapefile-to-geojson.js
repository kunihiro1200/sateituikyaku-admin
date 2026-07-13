/**
 * Shapefileを直接パースしてGeoJSONに変換するスクリプト（外部依存なし）
 * 大分県の小学校区データ (A27-16_44) 専用
 * 
 * Usage: node backend/scripts/convert-shapefile-to-geojson.js
 */

const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

// --- 設定 ---
const PREFECTURES = [
  { code: '44', shpDir: 'A27-16_44', label: '大分県' },
  { code: '40', shpDir: 'A27-16_40', label: '福岡県' },
];
const OUTPUT_PATH = path.resolve(__dirname, '../src/data/school-districts.geojson');

// --- DBFパーサー ---
function parseDBF(buffer) {
  const numRecords = buffer.readInt32LE(4);
  const headerSize = buffer.readInt16LE(8);
  const recordSize = buffer.readInt16LE(10);

  // フィールド記述子の読み込み（32バイト目から、各32バイト、終端は0x0D）
  const fields = [];
  let offset = 32;
  while (offset < headerSize - 1 && buffer[offset] !== 0x0D) {
    const name = buffer.slice(offset, offset + 11).toString('ascii').replace(/\0/g, '').trim();
    const type = String.fromCharCode(buffer[offset + 11]);
    const size = buffer[offset + 16];
    const decimal = buffer[offset + 17];
    fields.push({ name, type, size, decimal });
    offset += 32;
  }

  // レコード読み込み
  const records = [];
  let recOffset = headerSize;
  for (let i = 0; i < numRecords; i++) {
    const deleted = buffer[recOffset]; // 0x20=valid, 0x2A=deleted
    recOffset += 1;
    if (deleted === 0x2A) {
      recOffset += recordSize - 1;
      continue;
    }
    const record = {};
    for (const field of fields) {
      const rawBuf = buffer.slice(recOffset, recOffset + field.size);
      const raw = iconv.decode(rawBuf, 'Shift_JIS').trim();
      if (field.type === 'N' || field.type === 'F') {
        record[field.name] = raw ? parseFloat(raw) : null;
      } else {
        record[field.name] = raw;
      }
      recOffset += field.size;
    }
    records.push(record);
  }

  return records;
}

// --- SHPパーサー（Polygonタイプのみ対応） ---
function parseSHP(buffer) {
  // ファイルヘッダー: 100バイト
  const fileCode = buffer.readInt32BE(0); // 9994
  if (fileCode !== 9994) throw new Error('Invalid SHP file');

  const shapeType = buffer.readInt32LE(32);
  // shapeType 5 = Polygon
  if (shapeType !== 5) {
    console.warn(`Warning: Shape type is ${shapeType}, expected 5 (Polygon)`);
  }

  const records = [];
  let offset = 100; // レコード開始位置

  while (offset < buffer.length - 8) {
    // レコードヘッダー: 8バイト
    const recordNum = buffer.readInt32BE(offset);
    const contentLength = buffer.readInt32BE(offset + 4) * 2; // ワード→バイト
    offset += 8;

    if (offset + contentLength > buffer.length) break;

    const recShapeType = buffer.readInt32LE(offset);
    if (recShapeType === 0) {
      // Null shape
      offset += contentLength;
      records.push(null);
      continue;
    }

    // Polygon: BBox(32) + numParts(4) + numPoints(4) + parts[] + points[]
    const numParts = buffer.readInt32LE(offset + 36);
    const numPoints = buffer.readInt32LE(offset + 40);

    const parts = [];
    for (let i = 0; i < numParts; i++) {
      parts.push(buffer.readInt32LE(offset + 44 + i * 4));
    }

    const pointsOffset = offset + 44 + numParts * 4;
    const points = [];
    for (let i = 0; i < numPoints; i++) {
      const x = buffer.readDoubleLE(pointsOffset + i * 16);     // longitude
      const y = buffer.readDoubleLE(pointsOffset + i * 16 + 8); // latitude
      points.push([x, y]);
    }

    // パートに分割
    const rings = [];
    for (let i = 0; i < numParts; i++) {
      const start = parts[i];
      const end = i + 1 < numParts ? parts[i + 1] : numPoints;
      rings.push(points.slice(start, end));
    }

    records.push(rings);
    offset += contentLength;
  }

  return records;
}

// --- メイン ---
function main() {
  const allFeatures = [];

  for (const pref of PREFECTURES) {
    const SHP_PATH = path.resolve(process.env.TEMP || '/tmp', `${pref.shpDir}/shape/${pref.shpDir}.shp`);
    const DBF_PATH = path.resolve(process.env.TEMP || '/tmp', `${pref.shpDir}/shape/${pref.shpDir}.dbf`);

    if (!fs.existsSync(SHP_PATH)) {
      console.warn(`⚠️  ${pref.label} SHPファイルなし: ${SHP_PATH} → スキップ`);
      continue;
    }
    if (!fs.existsSync(DBF_PATH)) {
      console.warn(`⚠️  ${pref.label} DBFファイルなし: ${DBF_PATH} → スキップ`);
      continue;
    }

    console.log(`\n📂 ${pref.label} SHP: ${SHP_PATH}`);

    const shpBuffer = fs.readFileSync(SHP_PATH);
    const dbfBuffer = fs.readFileSync(DBF_PATH);

    console.log('  Parsing SHP...');
    const geometries = parseSHP(shpBuffer);
    console.log(`  ${geometries.length} geometries`);

    console.log('  Parsing DBF...');
    const records = parseDBF(dbfBuffer);
    console.log(`  ${records.length} records`);

    if (records.length > 0) {
      console.log('  DBF fields:', Object.keys(records[0]).join(', '));
      console.log('  Sample record:', JSON.stringify(records[0]));
    }

    const len = Math.min(geometries.length, records.length);
    let count = 0;

    for (let i = 0; i < len; i++) {
      const geom = geometries[i];
      const rec = records[i];
      if (!geom) continue;

      const name = rec['A27_007'] || rec['A27_006'] || rec['NAME'] || rec['name'] || '';
      const adminCode = rec['A27_005'] || rec['ADMIN_CODE'] || '';

      allFeatures.push({
        type: 'Feature',
        properties: {
          name: name,
          adminCode: String(adminCode),
          prefecture: pref.code,
        },
        geometry: {
          type: 'Polygon',
          coordinates: geom,
        },
      });
      count++;
    }

    console.log(`  有効な校区ポリゴン: ${count}`);
  }

  console.log(`\n📊 合計: ${allFeatures.length}校区`);

  // 出力ディレクトリ作成
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const geojson = {
    type: 'FeatureCollection',
    features: allFeatures,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(geojson), 'utf-8');
  const sizeMB = (fs.statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(2);
  console.log(`✅ 出力: ${OUTPUT_PATH} (${sizeMB} MB)`);
  console.log(`   ${allFeatures.length}校区のGeoJSONを生成しました`);
}

main();
