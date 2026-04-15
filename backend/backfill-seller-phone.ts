/**
 * seller_phone バックフィルスクリプト
 * property_listings.seller_phone を sellers テーブルから一括補完
 * 
 * 実行方法:
 * cd backend
 * npx ts-node backfill-seller-phone.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ENCRYPTION_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function decrypt(encryptedText: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.substring(0, 32), 'utf8');
  const buffer = Buffer.from(encryptedText, 'base64');
  const iv = buffer.slice(0, 12);
  const authTag = buffer.slice(12, 28);
  const encrypted = buffer.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

async function main() {
  console.log('seller_phone バックフィル開始...');

  // seller_phone が NULL の物件を全件取得
  const { data: listings, error: listErr } = await supabase
    .from('property_listings')
    .select('property_number')
    .is('seller_phone', null);

  if (listErr) { console.error('listings取得エラー:', listErr.message); process.exit(1); }
  if (!listings || listings.length === 0) {
    console.log('seller_phone が NULL の物件はありません');
    return;
  }

  console.log(`対象物件数: ${listings.length}`);

  const propertyNumbers = listings.map((l: any) => l.property_number).filter(Boolean);

  // sellers テーブルから phone_number を取得（1000件ずつ）
  const phoneMap: Record<string, string> = {};
  const CHUNK = 500;
  for (let i = 0; i < propertyNumbers.length; i += CHUNK) {
    const chunk = propertyNumbers.slice(i, i + CHUNK);
    const { data: sellers, error: sellerErr } = await supabase
      .from('sellers')
      .select('seller_number, phone_number')
      .in('seller_number', chunk);

    if (sellerErr) { console.error('sellers取得エラー:', sellerErr.message); continue; }

    for (const s of sellers || []) {
      if (s.phone_number) {
        try {
          phoneMap[s.seller_number] = decrypt(s.phone_number);
        } catch {
          // 復号失敗はスキップ
        }
      }
    }
  }

  console.log(`電話番号取得済み売主数: ${Object.keys(phoneMap).length}`);

  // バッチ更新
  let updated = 0;
  let skipped = 0;
  for (const listing of listings) {
    const phone = phoneMap[listing.property_number];
    if (!phone) { skipped++; continue; }
    const { error: upErr } = await supabase
      .from('property_listings')
      .update({ seller_phone: phone })
      .eq('property_number', listing.property_number);
    if (upErr) {
      console.error(`更新エラー ${listing.property_number}:`, upErr.message);
    } else {
      updated++;
    }
  }

  console.log(`完了: ${updated}件更新, ${skipped}件スキップ（売主データなし）`);
}

main().catch(console.error);
