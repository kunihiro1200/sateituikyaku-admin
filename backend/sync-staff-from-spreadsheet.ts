import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

// backend/.envを読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function syncStaffFromSpreadsheet() {
  console.log('=== スタッフ管理シートから従業員データを同期 ===\n');

  try {
    // GoogleSheetsClientを使用してスプレッドシートから取得
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
      sheetName: 'スタッフ',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    
    await sheetsClient.authenticate();
    const rows = await sheetsClient.readAll();
    
    console.log(`✅ スプレッドシートから${rows.length}件のスタッフデータを取得しました\n`);

    let syncedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const initials = row['イニシャル'] || row['スタッフID'] || '';
      const name = row['姓名'] || row['名前'] || '';
      const email = row['メアド'] || row['メールアドレス'] || row['email'] || '';
      
      if (!email || !initials) {
        console.log(`⚠️  スキップ: ${name || initials} (メールアドレスまたはイニシャルなし)`);
        skippedCount++;
        continue;
      }

      // データベースに既存のレコードがあるか確認
      const { data: existing } = await supabase
        .from('employees')
        .select('id, name, initials')
        .ilike('email', email)
        .single();

      if (existing) {
        // 既存レコードを更新（イニシャルが異なる場合のみ）
        if (existing.initials !== initials) {
          const { error } = await supabase
            .from('employees')
            .update({
              name: name,
              initials: initials,
            })
            .eq('id', existing.id);

          if (error) {
            console.error(`❌ 更新失敗: ${email} - ${error.message}`);
          } else {
            console.log(`🔄 更新: ${email} (${existing.initials} → ${initials})`);
            updatedCount++;
          }
        } else {
          console.log(`✓  既存: ${email} (${initials})`);
          skippedCount++;
        }
      } else {
        // 新規レコードを作成
        const { error } = await supabase
          .from('employees')
          .insert({
            email: email,
            name: name,
            initials: initials,
            is_active: true,
            role: 'staff',
          });

        if (error) {
          console.error(`❌ 作成失敗: ${email} - ${error.message}`);
        } else {
          console.log(`✨ 新規作成: ${email} (${initials})`);
          syncedCount++;
        }
      }
    }

    console.log('\n=== 同期完了 ===');
    console.log(`新規作成: ${syncedCount}件`);
    console.log(`更新: ${updatedCount}件`);
    console.log(`スキップ: ${skippedCount}件`);
    console.log(`合計: ${rows.length}件`);

  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    throw error;
  }
}

syncStaffFromSpreadsheet().catch(console.error);
