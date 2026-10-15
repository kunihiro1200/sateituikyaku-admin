/**
 * 住所対応表569件 データ整合性チェック
 * - 必須フィールドの欠損
 * - 無効な区名
 * - 重複レコード
 * - レンジフォーマットの問題
 * - 中学校名の一貫性
 */
import * as fs from 'fs';
import * as path from 'path';

const DATA_PATH = path.resolve(__dirname, '../src/data/fukuoka-school-address-map.json');
const VALID_WARDS = ['東区', '西区', '南区', '北区', '博多区', '中央区', '城南区', '早良区'];

interface Record {
  ward: string;
  town: string;
  range: string;
  elementary: string;
  juniorHigh: string;
  note?: string;
}

function check() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const records: Record[] = data.records;
  
  console.log('='.repeat(60));
  console.log('  住所対応表 データ整合性チェック');
  console.log('='.repeat(60));
  console.log(`総件数: ${records.length}件\n`);

  const issues: { type: string; record: Partial<Record>; detail: string }[] = [];

  // ① 必須フィールド欠損
  const missing: Record[] = [];
  for (const r of records) {
    if (!r.ward || !r.town || !r.range || !r.elementary || !r.juniorHigh) {
      missing.push(r);
      issues.push({ type: 'missing_field', record: r, detail: `ward=${r.ward} town=${r.town} elem=${r.elementary} jh=${r.juniorHigh} range=${r.range?.slice(0,30)}` });
    }
  }

  // ② 無効な区名
  const invalidWard = records.filter(r => r.ward && !VALID_WARDS.includes(r.ward));

  // ③ 重複レコード (ward+town+elementary+juniorHigh が同じ)
  const seen = new Map<string, number>();
  const duplicates: Record[] = [];
  for (const r of records) {
    const key = `${r.ward}|${r.town}|${r.elementary}|${r.juniorHigh}|${r.range}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const dupKeys = new Set([...seen.entries()].filter(([,v]) => v > 1).map(([k]) => k));
  for (const r of records) {
    const key = `${r.ward}|${r.town}|${r.elementary}|${r.juniorHigh}|${r.range}`;
    if (dupKeys.has(key)) duplicates.push(r);
  }

  // ④ 区域テキストの問題
  const rangeIssues: { r: Record; issue: string }[] = [];
  for (const r of records) {
    const range = r.range || '';
    // 空すぎる
    if (range.length < 1) {
      rangeIssues.push({ r, issue: '区域が空' });
    }
    // 明らかに連結エラー（2つの全域が混入など）
    if ((range.match(/全域/g) || []).length > 2) {
      rangeIssues.push({ r, issue: '「全域」が3回以上出現' });
    }
    // ※フットノートが区域に混入しているが実データとして正常
  }

  // ⑤ 中学校名・小学校名のユニーク一覧
  const uniqueJH = new Set(records.map(r => r.juniorHigh));
  const uniqueElem = new Set(records.map(r => r.elementary));

  // ⑥ Wayback Machineデータ（か行〜や行）の学校名と2026年PDFの照合（学校名レベル）
  const pdf_jh_from_search = new Set([
    '三宅中', '三筑中', '下山門中', '住吉中', '元岡中', '周船寺中',
    '内浜中', '北崎中', '千代中', '博多中', '原中', '原中央中', '原北中',
    '友泉中', '吉塚中', '和白丘中', '和白中', '城南中', '城西中', '城香中',
    '壱岐丘中', '壱岐中', '多々良中', '多々良中央中', '姪浜中', '宮竹中',
    '小呂中', '席田中', '平尾中', '当仁中', '志賀中', '早良中', '春吉中',
    '曰佐中', '東住吉中', '東光中', '松崎中', '板付中', '柏原中', '梅林中',
    '横手中', '次郎丸中', '照葉中', '片江中', '玄洋中', '玄界中', '田隈中',
    '百道中', '福岡中', '筑紫丘中', '箱崎中', '箱崎清松中', '老司中', '能古中',
    '舞鶴中', '花畑中', '西福岡中', '西陵中', '警固中', '那珂中', '野間中',
    '金武中', '長丘中', '長尾中', '青葉中', '香椎第１中', '香椎第２中',
    '香椎第３中', '高取中', '高宮中',
  ]);

  // JSONの中学校名をチェック（短縮名で比較）
  const jh_in_json_not_pdf: string[] = [];
  for (const jh of uniqueJH) {
    const shortJH = jh.replace(/^.*立/, '').replace('学校', '');
    const matchesPDF = [...pdf_jh_from_search].some(pjh => 
      shortJH.includes(pjh) || pjh.includes(shortJH)
    );
    if (!matchesPDF && jh !== '-' && jh !== '') {
      jh_in_json_not_pdf.push(jh);
    }
  }

  // ⑦ 区域別件数（区ごとの分布）
  const wardCount: Record<string, number> = {};
  for (const r of records) {
    wardCount[r.ward] = (wardCount[r.ward] || 0) + 1;
  }

  // ─── レポート出力 ───
  console.log('① 必須フィールド欠損:');
  if (missing.length === 0) {
    console.log('   ✅ 0件（全レコード正常）');
  } else {
    console.log(`   ❌ ${missing.length}件`);
    missing.slice(0, 5).forEach(r => console.log(`   ${JSON.stringify(r).slice(0, 80)}`));
  }

  console.log('\n② 無効な区名:');
  if (invalidWard.length === 0) {
    console.log('   ✅ 0件');
  } else {
    console.log(`   ❌ ${invalidWard.length}件`);
    invalidWard.slice(0, 5).forEach(r => console.log(`   ${r.ward} / ${r.town}`));
  }

  console.log('\n③ 重複レコード:');
  const dupCount = dupKeys.size;
  if (dupCount === 0) {
    console.log('   ✅ 0件');
  } else {
    console.log(`   ⚠️  ${dupCount}件のキー重複`);
    [...dupKeys].slice(0, 3).forEach(k => console.log(`   ${k.slice(0, 80)}`));
  }

  console.log('\n④ 区域テキスト問題:');
  if (rangeIssues.length === 0) {
    console.log('   ✅ 明らかな問題なし');
  } else {
    console.log(`   ⚠️  ${rangeIssues.length}件`);
    rangeIssues.slice(0, 5).forEach(ri => 
      console.log(`   ${ri.r.ward} ${ri.r.town}: ${ri.issue}`)
    );
  }

  console.log('\n⑤ 中学校名 照合（2026年R8 PDF掲載70校との比較）:');
  if (jh_in_json_not_pdf.length === 0) {
    console.log('   ✅ 全中学校名がR8 PDFと一致');
  } else {
    console.log(`   ⚠️  ${jh_in_json_not_pdf.length}件: JSONにあるがPDF未確認`);
    jh_in_json_not_pdf.forEach(jh => console.log(`   - ${jh}`));
  }

  console.log('\n⑥ 中学校ユニーク数:');
  console.log(`   JSON: ${uniqueJH.size}校`);
  console.log(`   R8 PDF: 70校`);
  console.log(`   ✅ 一致` + (uniqueJH.size === 70 ? '' : ` ← 差異あり`));

  console.log('\n⑦ 区別件数:');
  for (const [ward, cnt] of Object.entries(wardCount).sort(([,a],[,b]) => b-a)) {
    console.log(`   ${ward}: ${cnt}件`);
  }

  console.log('\n⑧ 小学校・中学校のユニーク数:');
  console.log(`   小学校: ${uniqueElem.size}校`);
  console.log(`   中学校: ${uniqueJH.size}校`);
  
  // ⑨ 周船寺中の確認
  const shussenji = records.filter(r => r.juniorHigh === '周船寺中');
  console.log(`\n⑨ 周船寺中エントリ: ${shussenji.length}件`);
  shussenji.forEach(r => console.log(`   ${r.ward} ${r.town} / ${r.elementary} | ${r.range.slice(0,50)}`));

  // 総合評価
  const totalIssues = missing.length + invalidWard.length + dupCount + rangeIssues.length + jh_in_json_not_pdf.length;
  console.log('\n' + '='.repeat(60));
  console.log('  総合評価');
  console.log('='.repeat(60));
  if (totalIssues === 0) {
    console.log('✅ データ整合性: 問題なし');
  } else {
    console.log(`⚠️  要注意: ${totalIssues}件の問題が検出されました`);
  }
  console.log('   （PDFとの区域テキスト照合は別途報告）');
}

check();
