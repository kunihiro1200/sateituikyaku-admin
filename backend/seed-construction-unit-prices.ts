/**
 * seed-construction-unit-prices.ts
 *
 * 建築単価テーブル（construction_unit_prices）の初期データ投入スクリプト。
 *
 * 処理内容:
 *   1. 現行ハードコード値（ValuationCalculatorService と同じ値）を暫定値として登録
 *   2. 国税庁公表値（NTA）を nta_price カラムに記録
 *   3. is_provisional / price_source / is_approved を適切に設定
 *   4. upsert なので何度実行しても安全
 *
 * 実行方法:
 *   npx ts-node --transpile-only backend/seed-construction-unit-prices.ts
 *
 * 注意:
 *   この時点では price_per_sqm = 現行ハードコード値。
 *   第5段階（単価見直し）で NTA/e-Stat 値への更新を別途実施する。
 */

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定です');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── 現行ハードコード値（ValuationCalculatorService と完全同値）────────────────
// 第1段階修正済み（2023 RC/SRC修正・2024-2025追加）
const CURRENT_PRICES: Record<number, {
  wood: number; lightSteel: number; steel: number; rc: number; src: number;
}> = {
  1965: { wood: 16800,  lightSteel: 17900,  steel: 17900,  rc: 30300,  src: 45000  },
  1966: { wood: 18200,  lightSteel: 17800,  steel: 17800,  rc: 30600,  src: 42400  },
  1967: { wood: 19900,  lightSteel: 19600,  steel: 19600,  rc: 33700,  src: 43600  },
  1968: { wood: 22200,  lightSteel: 21700,  steel: 21700,  rc: 36200,  src: 48600  },
  1969: { wood: 24900,  lightSteel: 23600,  steel: 23600,  rc: 39000,  src: 50900  },
  1970: { wood: 28000,  lightSteel: 26100,  steel: 26100,  rc: 42900,  src: 54300  },
  1971: { wood: 31200,  lightSteel: 30300,  steel: 30300,  rc: 47200,  src: 61200  },
  1972: { wood: 34200,  lightSteel: 32400,  steel: 32400,  rc: 50200,  src: 61600  },
  1973: { wood: 45300,  lightSteel: 42200,  steel: 42200,  rc: 64300,  src: 77600  },
  1974: { wood: 61800,  lightSteel: 55700,  steel: 55700,  rc: 90100,  src: 113000 },
  1975: { wood: 67700,  lightSteel: 60500,  steel: 60500,  rc: 97400,  src: 126400 },
  1976: { wood: 70300,  lightSteel: 62100,  steel: 62100,  rc: 98200,  src: 114600 },
  1977: { wood: 74100,  lightSteel: 65300,  steel: 65300,  rc: 102000, src: 121800 },
  1978: { wood: 77900,  lightSteel: 70100,  steel: 70100,  rc: 105900, src: 122400 },
  1979: { wood: 82500,  lightSteel: 75400,  steel: 75400,  rc: 114300, src: 128900 },
  1980: { wood: 92500,  lightSteel: 84100,  steel: 84100,  rc: 129700, src: 149400 },
  1981: { wood: 98300,  lightSteel: 91700,  steel: 91700,  rc: 138700, src: 161800 },
  1982: { wood: 101300, lightSteel: 94400,  steel: 94400,  rc: 143200, src: 166900 },
  1983: { wood: 104400, lightSteel: 97200,  steel: 97200,  rc: 147800, src: 172200 },
  1984: { wood: 106800, lightSteel: 99500,  steel: 99500,  rc: 151200, src: 176100 },
  1985: { wood: 109300, lightSteel: 101900, steel: 101900, rc: 154700, src: 180200 },
  1986: { wood: 111900, lightSteel: 104300, steel: 104300, rc: 158300, src: 184400 },
  1987: { wood: 114500, lightSteel: 106700, steel: 106700, rc: 161900, src: 188700 },
  1988: { wood: 117200, lightSteel: 109200, steel: 109200, rc: 165600, src: 193000 },
  1989: { wood: 120000, lightSteel: 111800, steel: 111800, rc: 169400, src: 197400 },
  1990: { wood: 122900, lightSteel: 114500, steel: 114500, rc: 173300, src: 201900 },
  1991: { wood: 125800, lightSteel: 117200, steel: 117200, rc: 177300, src: 206500 },
  1992: { wood: 128800, lightSteel: 120000, steel: 120000, rc: 181400, src: 211200 },
  1993: { wood: 131900, lightSteel: 122900, steel: 122900, rc: 185600, src: 216000 },
  1994: { wood: 135100, lightSteel: 125900, steel: 125900, rc: 189900, src: 221000 },
  1995: { wood: 138300, lightSteel: 128900, steel: 128900, rc: 194300, src: 226100 },
  1996: { wood: 141600, lightSteel: 132000, steel: 132000, rc: 198800, src: 231300 },
  1997: { wood: 145000, lightSteel: 135100, steel: 135100, rc: 203400, src: 236700 },
  1998: { wood: 148500, lightSteel: 138400, steel: 138400, rc: 208100, src: 242200 },
  1999: { wood: 152100, lightSteel: 141700, steel: 141700, rc: 212900, src: 247800 },
  2000: { wood: 155800, lightSteel: 145100, steel: 145100, rc: 217800, src: 253600 },
  2001: { wood: 153000, lightSteel: 142600, steel: 142600, rc: 213900, src: 249000 },
  2002: { wood: 150300, lightSteel: 140100, steel: 140100, rc: 210100, src: 244500 },
  2003: { wood: 147600, lightSteel: 137700, steel: 137700, rc: 206400, src: 240100 },
  2004: { wood: 145000, lightSteel: 135300, steel: 135300, rc: 202800, src: 235800 },
  2005: { wood: 142400, lightSteel: 132900, steel: 132900, rc: 199200, src: 231600 },
  2006: { wood: 139900, lightSteel: 130500, steel: 130500, rc: 195700, src: 227500 },
  2007: { wood: 137400, lightSteel: 128200, steel: 128200, rc: 192300, src: 223500 },
  2008: { wood: 135000, lightSteel: 125900, steel: 125900, rc: 188900, src: 219600 },
  2009: { wood: 132700, lightSteel: 123700, steel: 123700, rc: 185600, src: 215800 },
  2010: { wood: 130400, lightSteel: 121500, steel: 121500, rc: 182400, src: 212100 },
  2011: { wood: 135000, lightSteel: 135000, steel: 135000, rc: 197000, src: 265400 },
  2012: { wood: 157600, lightSteel: 155600, steel: 155600, rc: 193900, src: 223300 },
  2013: { wood: 159900, lightSteel: 164300, steel: 164300, rc: 203800, src: 258500 },
  2014: { wood: 163000, lightSteel: 176400, steel: 176400, rc: 228000, src: 276200 },
  2015: { wood: 165400, lightSteel: 197300, steel: 197300, rc: 240200, src: 262200 },
  2016: { wood: 165900, lightSteel: 204100, steel: 204100, rc: 254200, src: 308300 },
  2017: { wood: 166700, lightSteel: 214600, steel: 214600, rc: 265500, src: 350400 },
  2018: { wood: 168500, lightSteel: 214100, steel: 214100, rc: 263100, src: 304200 },
  2019: { wood: 170100, lightSteel: 228800, steel: 228800, rc: 285600, src: 363300 },
  2020: { wood: 172000, lightSteel: 230200, steel: 230200, rc: 276900, src: 279200 },
  2021: { wood: 172200, lightSteel: 227300, steel: 227300, rc: 288200, src: 338400 },
  2022: { wood: 176200, lightSteel: 241500, steel: 241500, rc: 277500, src: 434400 },
  2023: { wood: 204100, lightSteel: 281100, steel: 281100, rc: 314300, src: 366700 },
  2024: { wood: 220600, lightSteel: 308500, steel: 308500, rc: 369100, src: 568600 },
  2025: { wood: 232500, lightSteel: 371300, steel: 371300, rc: 409700, src: 479700 },
};

// ─── 国税庁「建物の標準的な建築価額表」公表値（千円/㎡ → 円/㎡換算）──────────
// 出典: 東急リバブル資料・livable.co.jp より取得・確認（2026年8月）
// 4構造のみ: 木造 / SRC(鉄骨鉄筋コンクリート) / RC(鉄筋コンクリート) / 鉄骨
// ※軽量鉄骨はNTAに独立列なし
const NTA_PRICES: Record<number, { wood: number; steel: number; rc: number; src: number }> = {
  1965: { wood: 16800,  steel: 17900,  rc: 30300,  src: 45000  },
  1966: { wood: 18200,  steel: 17800,  rc: 30600,  src: 42400  },
  1967: { wood: 19900,  steel: 19600,  rc: 33700,  src: 43600  },
  1968: { wood: 22200,  steel: 21700,  rc: 36200,  src: 48600  },
  1969: { wood: 24900,  steel: 23600,  rc: 39000,  src: 50900  },
  1970: { wood: 28000,  steel: 26100,  rc: 42900,  src: 54300  },
  1971: { wood: 31200,  steel: 30300,  rc: 47200,  src: 61200  },
  1972: { wood: 34200,  steel: 32400,  rc: 50200,  src: 61600  },
  1973: { wood: 45300,  steel: 42200,  rc: 64300,  src: 77600  },
  1974: { wood: 61800,  steel: 55700,  rc: 90100,  src: 113000 },
  1975: { wood: 67700,  steel: 60500,  rc: 97400,  src: 126400 },
  1976: { wood: 70300,  steel: 62100,  rc: 98200,  src: 114600 },
  1977: { wood: 74100,  steel: 65300,  rc: 102000, src: 121800 },
  1978: { wood: 77900,  steel: 70100,  rc: 105900, src: 122400 },
  1979: { wood: 82500,  steel: 75400,  rc: 114300, src: 128900 },
  1980: { wood: 92500,  steel: 84100,  rc: 129700, src: 149400 },
  1981: { wood: 98300,  steel: 91700,  rc: 138700, src: 161800 },
  1982: { wood: 101300, steel: 93900,  rc: 143000, src: 170900 },
  1983: { wood: 102200, steel: 94300,  rc: 143800, src: 168000 },
  1984: { wood: 102800, steel: 95300,  rc: 141700, src: 161200 },
  1985: { wood: 104200, steel: 96900,  rc: 144500, src: 172200 },
  1986: { wood: 106200, steel: 102600, rc: 149500, src: 181900 },
  1987: { wood: 110000, steel: 108400, rc: 156600, src: 191800 },
  1988: { wood: 116500, steel: 117300, rc: 175000, src: 203600 },
  1989: { wood: 123100, steel: 128400, rc: 193300, src: 237300 },
  1990: { wood: 131700, steel: 147400, rc: 222900, src: 286700 },
  1991: { wood: 137600, steel: 158700, rc: 246800, src: 329800 },
  1992: { wood: 143500, steel: 162400, rc: 245600, src: 333700 },
  1993: { wood: 150900, steel: 159200, rc: 227500, src: 300300 },
  1994: { wood: 156600, steel: 148400, rc: 212800, src: 262900 },
  1995: { wood: 158300, steel: 143200, rc: 199000, src: 228800 },
  1996: { wood: 161000, steel: 143600, rc: 198000, src: 229700 },
  1997: { wood: 160500, steel: 141000, rc: 201000, src: 223000 },
  1998: { wood: 158600, steel: 138700, rc: 203800, src: 225600 },
  1999: { wood: 159300, steel: 139400, rc: 197900, src: 220900 },
  2000: { wood: 159000, steel: 132300, rc: 182600, src: 204300 },
  2001: { wood: 157200, steel: 136400, rc: 177800, src: 186100 },
  2002: { wood: 153600, steel: 135000, rc: 180500, src: 195200 },
  2003: { wood: 152700, steel: 131400, rc: 179500, src: 187300 },
  2004: { wood: 152100, steel: 130600, rc: 176100, src: 190100 },
  2005: { wood: 151900, steel: 132800, rc: 171500, src: 185700 },
  2006: { wood: 152900, steel: 133700, rc: 178600, src: 170500 },
  2007: { wood: 153600, steel: 135600, rc: 185800, src: 182500 },
  2008: { wood: 156000, steel: 158300, rc: 206100, src: 229100 },
  2009: { wood: 156600, steel: 169500, rc: 219000, src: 265200 },
  2010: { wood: 156500, steel: 163000, rc: 205900, src: 226400 },
  2011: { wood: 156800, steel: 158900, rc: 197000, src: 238400 },
  2012: { wood: 157600, steel: 155600, rc: 193900, src: 223300 },
  2013: { wood: 159900, steel: 164300, rc: 203800, src: 258500 },
  2014: { wood: 163000, steel: 176400, rc: 228000, src: 276200 },
  2015: { wood: 165400, steel: 197300, rc: 240200, src: 262200 },
  2016: { wood: 165900, steel: 204100, rc: 254200, src: 308300 },
  2017: { wood: 166700, steel: 214600, rc: 265500, src: 350400 },
  2018: { wood: 168500, steel: 214100, rc: 263100, src: 304200 },
  2019: { wood: 170100, steel: 228800, rc: 285600, src: 363300 },
  2020: { wood: 172000, steel: 230200, rc: 276900, src: 279200 },
  2021: { wood: 172200, steel: 227300, rc: 288200, src: 338400 },
  2022: { wood: 176200, steel: 241500, rc: 277500, src: 434400 },
  2023: { wood: 204100, steel: 281100, rc: 314300, src: 366700 },
  2024: { wood: 220600, steel: 308500, rc: 369100, src: 568600 },
  2025: { wood: 232500, steel: 371300, rc: 409700, src: 479700 },
};

// ─── 暫定判定ロジック ────────────────────────────────────────────────────────
// 1965-1981: NTA公表値と完全一致 → is_provisional = false
// 1982:      微小乖離（最大2.3%）→ is_provisional = false
// 1983-2011: NTA公表値と有意な乖離 → is_provisional = true
// 2012-2025: NTA公表値と一致 → is_provisional = false
// 軽量鉄骨:  NTAに独立列なし → 全年度 is_provisional = true

function isProvisionalYear(year: number): boolean {
  return year >= 1983 && year <= 2011;
}

// ─── 構造マッピング ─────────────────────────────────────────────────────────
const STRUCTURES: Array<{
  dbName: string;
  priceKey: 'wood' | 'lightSteel' | 'steel' | 'rc' | 'src';
  ntaKey: 'wood' | 'steel' | 'rc' | 'src' | null; // null = NTAに独立列なし
}> = [
  { dbName: '木造',             priceKey: 'wood',       ntaKey: 'wood'  },
  { dbName: '軽量鉄骨',         priceKey: 'lightSteel', ntaKey: null    }, // NTAに独立列なし
  { dbName: '鉄骨',             priceKey: 'steel',      ntaKey: 'steel' },
  { dbName: '鉄筋コンクリート', priceKey: 'rc',         ntaKey: 'rc'    },
  { dbName: '鉄骨鉄筋コンクリート', priceKey: 'src',    ntaKey: 'src'   },
];

// ─── 行データ生成 ────────────────────────────────────────────────────────────
function buildRows() {
  const rows: Record<string, unknown>[] = [];
  const years = Object.keys(CURRENT_PRICES).map(Number).sort();

  for (const year of years) {
    const current = CURRENT_PRICES[year];
    const nta = NTA_PRICES[year];

    for (const st of STRUCTURES) {
      const pricePerSqm = current[st.priceKey];
      const ntaPrice   = nta && st.ntaKey ? nta[st.ntaKey] : null;

      // NTA一致判定（差異が200円以内 = 一致とみなす）
      const matchesNTA = ntaPrice !== null && Math.abs(pricePerSqm - ntaPrice) <= 200;

      // 暫定フラグ
      const isLightSteel  = st.dbName === '軽量鉄骨';
      const isProvisional = isLightSteel || isProvisionalYear(year);

      // 暫定理由
      let provisionalReason: string | null = null;
      if (isLightSteel) {
        provisionalReason = 'NTAに軽量鉄骨独立列なし。鉄骨値を暫定使用（第5段階でe-Stat等から独立値算出予定）';
      } else if (isProvisionalYear(year)) {
        provisionalReason = '旧スプレッドシート出典。NTA公表値と乖離あり（第5段階で見直し予定）';
      }

      // 出典
      let priceSource: string;
      let derivationNote: string | null = null;
      let coefficient: number | null = null;
      let coefficientSource: string | null = null;

      if (isLightSteel) {
        priceSource     = 'nta_with_coefficient';
        coefficient     = 1.0;
        coefficientSource = '旧ハードコード設定（鉄骨と同値）。係数の明確な根拠なし。第5段階で見直し予定';
        derivationNote  = '軽量鉄骨はNTAに独立列なし。鉄骨値を係数1.0（同値）で設定。';
      } else if (matchesNTA) {
        priceSource = 'nta';
      } else if (isProvisionalYear(year)) {
        priceSource   = 'hardcode_initial';
        derivationNote = `旧スプレッドシート値。NTA公表値との差: ${ntaPrice !== null ? pricePerSqm - ntaPrice : 'NTA値不明'}円`;
      } else {
        // 1982: 微小乖離でNTAと近いが完全一致ではない
        priceSource = 'hardcode_initial';
      }

      rows.push({
        year,
        structure:          st.dbName,
        price_per_sqm:      pricePerSqm,
        nta_price:          ntaPrice,
        estat_price:        null,
        custom_price:       null,
        price_source:       priceSource,
        derivation_note:    derivationNote,
        coefficient:        coefficient,
        coefficient_source: coefficientSource,
        published_year:     year,
        fetched_at:         null,
        is_approved:        true,
        approved_at:        new Date().toISOString(),
        approved_by:        'migration_stage3',
        is_provisional:     isProvisional,
        provisional_reason: provisionalReason,
        version:            1,
      });
    }
  }
  return rows;
}

// ─── メイン ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏗️  建築単価テーブル シードスクリプト開始');

  const rows = buildRows();
  console.log(`📊 登録対象: ${rows.length}行（${Object.keys(CURRENT_PRICES).length}年 × ${STRUCTURES.length}構造）`);

  // 件数確認（dry-run）
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('\n🔍 DRY RUN モード: DBには書き込みません');
    const provisional = rows.filter(r => r.is_provisional);
    const nta = rows.filter(r => r.price_source === 'nta');
    const hardcode = rows.filter(r => r.price_source === 'hardcode_initial');
    console.log(`  ✅ NTA公表値と一致 (price_source='nta'):       ${nta.length}行`);
    console.log(`  ⚠️  旧ハードコード (price_source='hardcode_initial'): ${hardcode.length}行`);
    console.log(`  🔶 軽量鉄骨係数設定:                           ${rows.filter(r => r.price_source === 'nta_with_coefficient').length}行`);
    console.log(`  📍 is_provisional=true:                        ${provisional.length}行`);
    return;
  }

  // upsert（UNIQUE(year, structure) でコンフリクト → 既存行を更新）
  const BATCH_SIZE = 50;
  let inserted = 0;
  let errors   = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('construction_unit_prices')
      .upsert(batch, { onConflict: 'year,structure' });

    if (error) {
      console.error(`❌ バッチ ${i}〜${i + batch.length} でエラー:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`\r📥 登録中: ${inserted}/${rows.length}行`);
    }
  }

  console.log(`\n\n✅ 完了: ${inserted}行 登録 / ${errors}行 エラー`);

  // ─── 移行後の検証 ───────────────────────────────────────────────────────
  console.log('\n🔍 移行後検証 ─ 全年度・全構造のサンプルチェック');

  const { data: checkData, error: checkError } = await supabase
    .from('construction_unit_prices')
    .select('year, structure, price_per_sqm, is_approved, is_provisional, price_source')
    .eq('is_approved', true)
    .order('year')
    .order('structure');

  if (checkError || !checkData) {
    console.error('❌ 検証クエリ失敗:', checkError?.message);
    return;
  }

  console.log(`  取得行数: ${checkData.length}行（期待値: ${rows.length}行）`);

  // 値の一致確認（全行）
  let mismatchCount = 0;
  for (const row of checkData) {
    const year = row.year as number;
    const st   = STRUCTURES.find(s => s.dbName === row.structure);
    if (!st || !CURRENT_PRICES[year]) continue;
    const expected = CURRENT_PRICES[year][st.priceKey];
    if (row.price_per_sqm !== expected) {
      console.warn(`  ❌ MISMATCH: ${year}/${row.structure} → DB=${row.price_per_sqm} 期待値=${expected}`);
      mismatchCount++;
    }
  }

  if (mismatchCount === 0) {
    console.log('  ✅ 全行の price_per_sqm が現行ハードコード値と一致しました');
  } else {
    console.warn(`  ⚠️  ${mismatchCount}行で値の不一致があります`);
  }

  // サマリー
  const provisional = checkData.filter(r => r.is_provisional).length;
  const ntaRows     = checkData.filter(r => r.price_source === 'nta').length;
  const hardcode    = checkData.filter(r => r.price_source === 'hardcode_initial').length;
  const coeffRows   = checkData.filter(r => r.price_source === 'nta_with_coefficient').length;

  console.log('\n📋 登録内訳:');
  console.log(`  NTA公表値と一致 (price_source=nta):            ${ntaRows}行`);
  console.log(`  旧ハードコード  (price_source=hardcode_initial): ${hardcode}行`);
  console.log(`  軽量鉄骨係数設定 (price_source=nta_with_coefficient): ${coeffRows}行`);
  console.log(`  is_provisional=true:                            ${provisional}行`);
  console.log('\n🔶 is_provisional=true の行は第5段階（単価見直し）で更新予定');
  console.log('   1983〜2011年（旧スプレッドシート値）+ 全年度の軽量鉄骨が対象');
}

main().catch(e => {
  console.error('❌ 予期しないエラー:', e);
  process.exit(1);
});
