import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findBuyerWithViewingTypeGeneral() {
  try {
    console.log('\n📊 FQ列（内覧形態_一般媒介）に値がある買主を検索\n');

    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // データを取得
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:GZ`,
    });

    const rows = dataResponse.data.values || [];
    const buyerNumberIndex = 4;  // E列
    const fqIndex = 172;  // FQ列（内覧形態_一般媒介）

    // FQ列に値がある買主を検索
    const buyersWithValue: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const buyerNumber = rows[i][buyerNumberIndex];
      const viewingTypeGeneral = rows[i][fqIndex];
      
      if (viewingTypeGeneral && viewingTypeGeneral !== '') {
        buyersWithValue.push({
          buyerNumber,
          viewingTypeGeneral,
          rowIndex: i + 1
        });
        
        if (buyersWithValue.length >= 5) break;
      }
    }

    console.log(`検索範囲: ${rows.length}行`);

    if (buyersWithValue.length === 0) {
      console.log('⚠️ FQ列に値がある買主が見つかりませんでした');
      return;
    }

    console.log(`✅ ${buyersWithValue.length}件の買主が見つかりました:\n`);

    for (const buyer of buyersWithValue) {
      console.log(`📋 買主${buyer.buyerNumber}（行${buyer.rowIndex}）:`);
      console.log(`  スプレッドシート: "${buyer.viewingTypeGeneral}"`);

      // データベースから取得
      const { data: dbBuyer, error } = await supabase
        .from('buyers')
        .select('buyer_number, viewing_type_general')
        .eq('buyer_number', buyer.buyerNumber)
        .single();

      if (error) {
        console.log(`  データベース: ❌ エラー（${error.message}）`);
      } else {
        console.log(`  データベース: "${dbBuyer.viewing_type_general || ''}"`);
        
        const match = buyer.viewingTypeGeneral === (dbBuyer.viewing_type_general || '');
        console.log(`  同期状態: ${match ? '✅ 一致' : '❌ 不一致'}`);
      }
      console.log('');
    }

  } catch (error: any) {
    console.error('❌ エラー:', error.message);
  }
}

findBuyerWithViewingTypeGeneral();
