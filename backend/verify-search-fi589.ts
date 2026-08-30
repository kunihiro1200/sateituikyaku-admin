/**
 * 検索修正の検証スクリプト
 *
 * FI589（海出 務 / 08039968317 / 福岡県大野城市紫台18）が
 * 電話番号・名前・物件住所のどれで検索してもヒットすることを確認する。
 *
 * 使い方: npx ts-node backend/verify-search-fi589.ts
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.production') });
dotenv.config({ path: path.resolve(__dirname, '.env.vercel.check') });

import { SellerService } from './src/services/SellerService.supabase';

const QUERIES = [
  '08039968317',      // 電話番号（ハイフンなし）
  '080-3996-8317',    // 電話番号（ハイフンあり）
  '海出',              // 名前（部分）
  '海出 務',           // 名前（フル）
  '大野城市紫台',       // 物件住所（部分）
  '福岡県大野城市紫台18', // 物件住所（フル）
  'FI589',            // 売主番号
];

async function main() {
  const service = new SellerService();

  console.log('='.repeat(80));
  console.log('検索検証: FI589 が各クエリでヒットするか');
  console.log('='.repeat(80));

  for (const q of QUERIES) {
    const start = Date.now();
    try {
      const results = await service.searchSellers(q);
      const hit = results.find((s: any) => s.sellerNumber === 'FI589');
      const elapsed = Date.now() - start;
      console.log(
        `${hit ? '✅' : '❌'} "${q}"`.padEnd(32) +
          ` 結果${String(results.length).padStart(3)}件 / ${elapsed}ms` +
          (hit ? ` → FI589 (${hit.name})` : ' → FI589が見つからない')
      );
    } catch (e: any) {
      console.log(`💥 "${q}" エラー: ${e.message}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
