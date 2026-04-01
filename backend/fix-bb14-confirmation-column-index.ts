// BB14の確認フィールドの列インデックスを修正するスクリプト
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixConfirmationColumnIndex() {
  console.log('🔧 確認フィールドの列インデックスを修正中...\n');

  // 修正内容を表示
  console.log('📋 修正内容:');
  console.log('  ファイル: backend/src/services/PropertyListingSpreadsheetSync.ts');
  console.log('  行番号: 207');
  console.log('  修正前: const confirmation = row[119]; // DQ列（0-indexed: 119）');
  console.log('  修正後: const confirmation = row[118]; // DQ列（0-indexed: 118、B列から開始のため120-2=118）');
  console.log('');

  // 説明
  console.log('📝 説明:');
  console.log('  - 読み取り範囲: B:DQ（B列から開始）');
  console.log('  - B列: 配列のインデックス0');
  console.log('  - DQ列: 120番目の列（A=1, B=2, ..., DQ=120）');
  console.log('  - B列から開始しているため、DQ列は配列のインデックス118（120 - 2 = 118）');
  console.log('  - 現在のコードは row[119] を読み取っているため、DR列（121番目の列）を読み取ってしまっている');
  console.log('');

  // BB14の現在の状態を確認
  console.log('🔍 BB14の現在の状態を確認:');
  const { data: bb14, error: bb14Error } = await supabase
    .from('property_listings')
    .select('property_number, confirmation')
    .eq('property_number', 'BB14')
    .single();

  if (bb14Error) {
    console.error('❌ エラー:', bb14Error);
    return;
  }

  if (!bb14) {
    console.log('❌ BB14が見つかりません');
    return;
  }

  console.log('  物件番号:', bb14.property_number);
  console.log('  確認（現在）:', bb14.confirmation);
  console.log('');

  console.log('✅ 修正が必要です。以下のコマンドを実行してください:');
  console.log('');
  console.log('  1. backend/src/services/PropertyListingSpreadsheetSync.ts を開く');
  console.log('  2. 207行目を以下のように修正:');
  console.log('     const confirmation = row[118]; // DQ列（0-indexed: 118、B列から開始のため120-2=118）');
  console.log('  3. バックエンドサーバーを再起動');
  console.log('  4. スプレッドシート同期を実行（GASの10分トリガーを待つか、手動で実行）');
  console.log('');
}

fixConfirmationColumnIndex().catch(console.error);
