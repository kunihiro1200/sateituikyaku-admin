/**
 * 全売主の電話番号・メールアドレスのSHA-256ハッシュをDBに保存するバックフィルスクリプト
 * 実行: npx ts-node backend/backfill-phone-email-hash.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function main() {
  console.log('=== 電話番号・メールハッシュ バックフィル開始 ===\n');

  const { decrypt } = await import('./src/utils/encryption');

  // 全売主を取得（削除済み含む）
  let page = 0;
  const pageSize = 200;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  while (true) {
    const { data: sellers, error } = await supabase
      .from('sellers')
      .select('id, phone_number, email')
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('取得エラー:', error);
      break;
    }

    if (!sellers || sellers.length === 0) break;

    console.log(`ページ ${page + 1}: ${sellers.length}件処理中...`);

    for (const seller of sellers) {
      totalProcessed++;
      try {
        const updates: any = {};

        if (seller.phone_number) {
          try {
            const plain = decrypt(seller.phone_number);
            updates.phone_number_hash = sha256(plain);
          } catch { /* 復号失敗はスキップ */ }
        }

        if (seller.email) {
          try {
            const plain = decrypt(seller.email);
            updates.email_hash = sha256(plain);
          } catch { /* 復号失敗はスキップ */ }
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('sellers')
            .update(updates)
            .eq('id', seller.id);

          if (updateError) {
            console.error(`  ❌ ${seller.id}: ${updateError.message}`);
            totalErrors++;
          } else {
            totalUpdated++;
          }
        }
      } catch (e) {
        console.error(`  ❌ ${seller.id}: ${e}`);
        totalErrors++;
      }
    }

    if (sellers.length < pageSize) break;
    page++;
  }

  console.log(`\n=== 完了 ===`);
  console.log(`処理件数: ${totalProcessed}`);
  console.log(`更新件数: ${totalUpdated}`);
  console.log(`エラー件数: ${totalErrors}`);
}

main().catch(console.error);
