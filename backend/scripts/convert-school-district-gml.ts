/**
 * 国土数値情報 小学校区データ（A27）GML → GeoJSON 変換スクリプト
 * 
 * 使い方:
 * 1. 国土数値情報ダウンロードサイト (https://nlftp.mlit.go.jp/ksj/) から
 *    小学校区データ（A27）の大分県（44）をダウンロード
 *    - ファイル名例: A27-16_44.xml（2016年版）または A27-10_44-g.xml（2010年版）
 * 2. ダウンロードしたXMLファイルを backend/scripts/ に配置
 * 3. 実行: npx ts-node backend/scripts/convert-school-district-gml.ts
 * 4. 出力: backend/src/data/oita-school-districts.geojson
 */

import * as fs from 'fs';
import * as path from 'path';
import { DOMParser } from '@xmldom/xmldom';

// --- 設定 ---
const INPUT_FILES = [
  'A27-16_44.xml',   // 2016年版
  'A27-10_44-g.xml', // 2010年版（fallback）
];

const OUTPUT_PATH = path.resolve(__dirname, '../src/data/oita-school-districts.geojson');

// --- GML名前空間 ---
const NS_GML = 'http://www.opengis.net/gml/3.2';
const NS_KSJ = 'http://nlftp.mlit.go.jp/ksj/schemas/ksj-app';

function getElementsByTagNameNS(node: any, ns: string, localName: string): any[] {
  const result: any[] = [];
  const elements = node.getElementsByTagNameNS(ns, localName);
  for (let i = 0; i < elements.length; i++) {
    result.push(elements.item(i));
  }
  return result;
}

function getTextContent(node: any, ns: string, localName: string): string {
  const elements = node.getElementsByTagNameNS(ns, localName);
  if (elements.length > 0) {
    return elements.item(0).textContent?.trim() || '';
  }
  return '';
}

function main() {
  // 入力ファイルを探す
  let inputPath = '';
  for (const filename of INPUT_FILES) {
    const candidate = path.resolve(__dirname, filename);
    if (fs.existsSync(candidate)) {
      inputPath = candidate;
      break;
    }
  }

  if (!inputPath) {
    console.error('❌ 入力ファイルが見つかりません。');
    console.error('   以下のいずれかを backend/scripts/ に配置してください:');
    INPUT_FILES.forEach(f => console.error(`   - ${f}`));
    console.error('\n   ダウンロード元: https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-A27-v2_1.html');
    process.exit(1);
  }

  console.log(`📂 入力: ${inputPath}`);
  const xmlStr = fs.readFileSync(inputPath, 'utf-8');
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');

  // 1. Curveデータ（境界線の座標列）をパース
  const curves: Record<string, [number, number][]> = {};
  const curveElements = getElementsByTagNameNS(doc, NS_GML, 'Curve');
  console.log(`  Curve数: ${curveElements.length}`);

  for (const curve of curveElements) {
    const id = curve.getAttributeNS(NS_GML, 'id') || curve.getAttribute('gml:id') || '';
    const posListEls = getElementsByTagNameNS(curve, NS_GML, 'posList');
    if (posListEls.length === 0) continue;
    const positions = (posListEls[0].textContent || '').trim().split(/\s+/).map(Number);
    const coords: [number, number][] = [];
    for (let i = 0; i < positions.length; i += 2) {
      // GMLは lat,lng の順 → GeoJSONは lng,lat の順
      coords.push([positions[i + 1], positions[i]]);
    }
    curves[id] = coords;
  }

  // 2. SchoolDistrict（小学校区）をパース
  // 2016年版: ksj:ElementarySchoolArea
  // 2010年版: ksj:SchoolDistrict
  let areaElements = getElementsByTagNameNS(doc, NS_KSJ, 'ElementarySchoolArea');
  if (areaElements.length === 0) {
    areaElements = getElementsByTagNameNS(doc, NS_KSJ, 'SchoolDistrict');
  }
  console.log(`  校区数: ${areaElements.length}`);

  const features: any[] = [];

  for (const area of areaElements) {
    const schoolId = area.getAttributeNS(NS_GML, 'id') || area.getAttribute('gml:id') || '';
    const name = getTextContent(area, NS_KSJ, 'name');
    const adminCode = getTextContent(area, NS_KSJ, 'administrativeAreaCode');

    // Curveの参照を解決して座標を組み立てる
    // IDパターン: "ea44_0001" → curve IDは "cv44_0001_1", "cv44_0001_2", ...
    // もしくは "SchoolDistrict-44_0001" → "cv-44_0001_1", ...
    const idPart = schoolId.includes('-') ? schoolId.split('-')[1] : schoolId.replace(/^[a-zA-Z]+/, '');
    
    const polygonCoords: [number, number][][] = [];
    
    // パターン1: cv{idPart}_{index} (1始まり)
    let idx = 1;
    let foundAny = false;
    while (true) {
      const curveId = `cv${idPart}_${idx}`;
      const curveIdAlt = `cv-${idPart}_${idx}`;
      if (curves[curveId]) {
        polygonCoords.push(curves[curveId]);
        foundAny = true;
      } else if (curves[curveIdAlt]) {
        polygonCoords.push(curves[curveIdAlt]);
        foundAny = true;
      } else {
        if (idx > 1) break;
        // idx=1で見つからない場合、0始まりを試す
        const curveId0 = `cv${idPart}_0`;
        const curveIdAlt0 = `cv-${idPart}_0`;
        if (curves[curveId0]) {
          polygonCoords.push(curves[curveId0]);
          foundAny = true;
          idx = 1;
          // 0始まりの場合、続きを探す
          while (true) {
            const cid = `cv${idPart}_${idx}`;
            const cidAlt = `cv-${idPart}_${idx}`;
            if (curves[cid]) {
              polygonCoords.push(curves[cid]);
            } else if (curves[cidAlt]) {
              polygonCoords.push(curves[cidAlt]);
            } else {
              break;
            }
            idx++;
          }
          break;
        } else if (curves[curveIdAlt0]) {
          polygonCoords.push(curves[curveIdAlt0]);
          foundAny = true;
          idx = 1;
          while (true) {
            const cid = `cv-${idPart}_${idx}`;
            if (curves[cid]) {
              polygonCoords.push(curves[cid]);
            } else {
              break;
            }
            idx++;
          }
          break;
        }
        break;
      }
      idx++;
    }

    if (!foundAny || polygonCoords.length === 0) continue;

    // 複数のCurveを1つのリングに結合（境界線を繋げる）
    const ring: [number, number][] = [];
    for (const curveCoords of polygonCoords) {
      if (ring.length === 0) {
        ring.push(...curveCoords);
      } else {
        // 前のセグメントの最後と次のセグメントの最初が一致する場合は重複を省く
        const lastPt = ring[ring.length - 1];
        const firstPt = curveCoords[0];
        if (lastPt[0] === firstPt[0] && lastPt[1] === firstPt[1]) {
          ring.push(...curveCoords.slice(1));
        } else {
          ring.push(...curveCoords);
        }
      }
    }

    // リングを閉じる
    if (ring.length > 2) {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push(first);
      }
    }

    if (ring.length < 4) continue; // 有効なポリゴンには最低4点必要

    features.push({
      type: 'Feature',
      properties: {
        name,
        adminCode,
        schoolId,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
    });
  }

  console.log(`  有効な校区ポリゴン: ${features.length}`);

  // 出力ディレクトリ作成
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const geojson = {
    type: 'FeatureCollection',
    features,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(geojson), 'utf-8');
  console.log(`✅ 出力: ${OUTPUT_PATH}`);
  console.log(`   ${features.length}校区のGeoJSONを生成しました`);
}

main();
