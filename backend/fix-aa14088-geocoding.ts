import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { GeocodingService } from './src/services/GeocodingService';
import fs from 'fs';

// .envファイルを直接読み込む
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');
let googleMapsApiKey = '';

for (const line of envLines) {
  if (line.startsWith('GOOGLE_MAPS_API_KEY=')) {
    googleMapsApiKey = line.split('=')[1].trim();
    break;
  }
}

// 他の環境変数は通常通り読み込む
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local'), override: true });

async function fixAA14088Geocoding() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase環境変数が設定されていません');
    process.exit(1);
  }

  if (!googleMapsApiKey) {
    console.error('❌ GOOGLE_MAPS_API_KEY が設定されていません');
    process.exit(1);
  }

  // GeocodingServiceに直接APIキーを設定
  process.env.GOOGLE_MAPS_API_KEY = googleMapsApiKey;

  console.log('✅ 環境変数チェック OK');
  console.log(`   SUPABASE_URL: ${supabaseUrl}`);
  console.log(`   GOOGLE_MAPS_API_KEY: ${googleMapsApiKey.substring(0, 10)}...`);
  console.log('');

  const supabase = createClient(supabaseUrl, supabaseKey);
  const geocodingService = new GeocodingService();

  console.log('=== AA14088 座標修正 ===');
  console.log('');

  // 現在のデータを取得
  const { data: seller, error: fetchError } = await supabase
    .from('sellers')
    .select('seller_number, property_address, latitude, longitude')
    .eq('seller_number', 'AA14088')
    .single();

  if (fetchError || !seller) {
    console.error('❌ データ取得エラー:', fetchError);
    process.exit(1);
  }

  console.log(`物件番号: ${seller.seller_number}`);
  console.log(`物件住所: ${seller.property_address}`);
  console.log(`現在の緯度: ${seller.latitude}`);
  console.log(`現在の経度: ${seller.longitude}`);
  console.log(`現在のURL: https://www.google.com/maps?q=${seller.latitude},${seller.longitude}`);
  console.log('');

  // ジオコーディング実行
  console.log(`ジオコーディング実行: ${seller.property_address}`);
  console.log('');

  const coordinates = await geocodingService.geocodeAddress(seller.property_address, 'AA');

  if (!coordinates) {
    console.error('❌ ジオコーディング失敗');
    process.exit(1);
  }

  console.log(`新しい緯度: ${coordinates.lat}`);
  console.log(`新しい経度: ${coordinates.lng}`);
  console.log(`新しいURL: https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`);
  console.log('');

  // 距離を計算
  const distance = geocodingService.calculateDistance(
    seller.latitude,
    seller.longitude,
    coordinates.lat,
    coordinates.lng
  );
  console.log(`現在の座標からの距離: ${distance.toFixed(2)}km`);
  console.log('');

  // データベースを更新
  console.log('データベースを更新中...');
  const { data: updateData, error: updateError } = await supabase
    .from('sellers')
    .update({
      latitude: coordinates.lat,
      longitude: coordinates.lng,
    })
    .eq('seller_number', 'AA14088')
    .select();

  if (updateError) {
    console.error('❌ 更新エラー:', updateError);
    process.exit(1);
  }

  console.log('✅ 座標を更新しました');
  console.log('');
  console.log('確認:');
  console.log(`新しいGoogleマップURL: https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`);
  console.log('このURLをブラウザで開いて、正しい場所が表示されるか確認してください');
}

fixAA14088Geocoding().catch((error) => {
  console.error('❌ 実行中にエラーが発生しました:', error);
  process.exit(1);
});
