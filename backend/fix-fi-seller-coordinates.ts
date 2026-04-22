/**
 * FI売主の座標再ジオコーディングスクリプト
 *
 * 目的:
 * FIプレフィックスの売主で、誤った座標（大分県内の座標）が保存されている売主の
 * 座標を修正後の geocodeAddress(address, 'FI') を使って正しい座標に更新する。
 *
 * 実行方法:
 *   npx ts-node backend/fix-fi-seller-coordinates.ts
 *
 * 必要な環境変数:
 *   GOOGLE_MAPS_API_KEY - Google Maps Geocoding API キー
 *   SUPABASE_URL        - Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase Service Role Key
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// .env ファイルを読み込む（backend/.env）
// 注意: .env.local の GOOGLE_MAPS_API_KEY が空の場合があるため、
// まず .env.local を読み込み、その後 .env で上書きする（override: true）
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

import { createClient } from '@supabase/supabase-js';
import { GeocodingService } from './src/services/GeocodingService';

// 処理間の遅延（Google Maps API レート制限対策）
const DELAY_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== FI売主 座標再ジオコーディングスクリプト ===');
  console.log('開始時刻:', new Date().toISOString());
  console.log('');

  // 環境変数チェック
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!supabaseUrl) {
    console.error('エラー: SUPABASE_URL が設定されていません');
    process.exit(1);
  }
  if (!supabaseKey) {
    console.error('エラー: SUPABASE_SERVICE_ROLE_KEY が設定されていません');
    process.exit(1);
  }
  if (!googleMapsApiKey) {
    console.error('エラー: GOOGLE_MAPS_API_KEY が設定されていません');
    process.exit(1);
  }

  console.log('✅ 環境変数チェック OK');
  console.log(`   SUPABASE_URL: ${supabaseUrl}`);
  console.log(`   GOOGLE_MAPS_API_KEY: ${googleMapsApiKey.substring(0, 10)}...`);
  console.log('');

  // Supabase クライアント初期化
  const supabase = createClient(supabaseUrl, supabaseKey);

  // GeocodingService 初期化
  const geocodingService = new GeocodingService();

  // FIプレフィックスの売主を取得
  console.log('📋 FIプレフィックスの売主を取得中...');
  const { data: sellers, error: fetchError } = await supabase
    .from('sellers')
    .select('id, seller_number, property_address, latitude, longitude')
    .like('seller_number', 'FI%')
    .order('seller_number');

  if (fetchError) {
    console.error('エラー: 売主データの取得に失敗しました:', fetchError);
    process.exit(1);
  }

  if (!sellers || sellers.length === 0) {
    console.log('FIプレフィックスの売主が見つかりませんでした。');
    process.exit(0);
  }

  console.log(`✅ FI売主 ${sellers.length} 件を取得しました`);
  console.log('');

  // 処理結果の集計
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const results: Array<{
    sellerNumber: string;
    address: string;
    oldLat: number | null;
    oldLng: number | null;
    newLat: number | null;
    newLng: number | null;
    status: 'success' | 'skip' | 'error';
    message: string;
  }> = [];

  // 各売主を処理
  for (let i = 0; i < sellers.length; i++) {
    const seller = sellers[i];
    const sellerNumber = seller.seller_number;
    const address = seller.property_address;

    console.log(`[${i + 1}/${sellers.length}] ${sellerNumber} 処理中...`);

    // property_address が存在しない場合はスキップ
    if (!address) {
      console.log(`  ⏭️  スキップ: property_address が未設定`);
      skipCount++;
      results.push({
        sellerNumber,
        address: '',
        oldLat: seller.latitude,
        oldLng: seller.longitude,
        newLat: null,
        newLng: null,
        status: 'skip',
        message: 'property_address が未設定',
      });
      continue;
    }

    console.log(`  住所: ${address}`);
    console.log(`  現在の座標: lat=${seller.latitude}, lng=${seller.longitude}`);

    try {
      // 修正後の geocodeAddress を使用（sellerPrefix='FI' を渡す）
      const coordinates = await geocodingService.geocodeAddress(address, 'FI');

      if (!coordinates) {
        console.log(`  ❌ ジオコーディング失敗: 座標を取得できませんでした`);
        errorCount++;
        results.push({
          sellerNumber,
          address,
          oldLat: seller.latitude,
          oldLng: seller.longitude,
          newLat: null,
          newLng: null,
          status: 'error',
          message: 'ジオコーディング失敗: 座標を取得できませんでした',
        });
        continue;
      }

      console.log(`  新しい座標: lat=${coordinates.lat}, lng=${coordinates.lng}`);

      // sellers テーブルの latitude, longitude を更新
      const { error: updateError } = await supabase
        .from('sellers')
        .update({
          latitude: coordinates.lat,
          longitude: coordinates.lng,
        })
        .eq('id', seller.id);

      if (updateError) {
        console.log(`  ❌ DB更新失敗:`, updateError);
        errorCount++;
        results.push({
          sellerNumber,
          address,
          oldLat: seller.latitude,
          oldLng: seller.longitude,
          newLat: coordinates.lat,
          newLng: coordinates.lng,
          status: 'error',
          message: `DB更新失敗: ${updateError.message}`,
        });
        continue;
      }

      console.log(`  ✅ 更新成功`);
      successCount++;
      results.push({
        sellerNumber,
        address,
        oldLat: seller.latitude,
        oldLng: seller.longitude,
        newLat: coordinates.lat,
        newLng: coordinates.lng,
        status: 'success',
        message: '更新成功',
      });
    } catch (err: any) {
      console.log(`  ❌ エラー:`, err.message);
      errorCount++;
      results.push({
        sellerNumber,
        address,
        oldLat: seller.latitude,
        oldLng: seller.longitude,
        newLat: null,
        newLng: null,
        status: 'error',
        message: `エラー: ${err.message}`,
      });
    }

    // レート制限対策: 次のリクエストまで待機
    if (i < sellers.length - 1) {
      await delay(DELAY_MS);
    }
  }

  // 処理結果サマリー
  console.log('');
  console.log('=== 処理結果サマリー ===');
  console.log(`総件数:   ${sellers.length} 件`);
  console.log(`成功:     ${successCount} 件`);
  console.log(`スキップ: ${skipCount} 件`);
  console.log(`エラー:   ${errorCount} 件`);
  console.log('');

  // 詳細結果
  console.log('=== 詳細結果 ===');
  for (const result of results) {
    const icon = result.status === 'success' ? '✅' : result.status === 'skip' ? '⏭️' : '❌';
    console.log(`${icon} ${result.sellerNumber}: ${result.message}`);
    if (result.status === 'success') {
      console.log(
        `   旧座標: lat=${result.oldLat}, lng=${result.oldLng}`
      );
      console.log(
        `   新座標: lat=${result.newLat}, lng=${result.newLng}`
      );
    }
  }

  console.log('');
  console.log('終了時刻:', new Date().toISOString());
  console.log('=== スクリプト完了 ===');
}

main().catch((err) => {
  console.error('予期しないエラーが発生しました:', err);
  process.exit(1);
});
