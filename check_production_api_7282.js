#!/usr/bin/env node
/**
 * 本番環境のAPIレスポンスを確認（買主7282）
 */

const https = require('https');

const url = 'https://sateituikyaku-admin-backend.vercel.app/api/buyers/7282';

console.log('🔍 本番環境のAPIレスポンスを確認中...');
console.log(`URL: ${url}\n`);

https.get(url, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const buyer = JSON.parse(data);
      
      console.log('✅ APIレスポンスを取得しました\n');
      console.log('📊 内覧関連フィールド:');
      console.log('='.repeat(60));
      console.log(`viewing_date: ${buyer.viewing_date || '（null）'}`);
      console.log(`viewing_time: ${buyer.viewing_time || '（null）'}`);
      console.log(`latest_viewing_date: ${buyer.latest_viewing_date || '（null）'}`);
      console.log('='.repeat(60));
      
      console.log('\n📋 全フィールド:');
      Object.keys(buyer).sort().forEach(key => {
        if (key.includes('viewing') || key.includes('time')) {
          console.log(`✅ ${key}: ${buyer[key]}`);
        }
      });
      
      // 問題の診断
      console.log('\n🔍 診断:');
      if (buyer.viewing_date && buyer.viewing_time) {
        console.log('✅ viewing_dateとviewing_timeの両方がAPIレスポンスに含まれています');
        console.log('   → フロントエンドの問題の可能性が高い');
      } else if (buyer.latest_viewing_date && buyer.viewing_time) {
        console.log('⚠️  latest_viewing_dateが返されています（viewing_dateではない）');
        console.log('   → バックエンドのデプロイが完了していない可能性');
      } else {
        console.log('❌ viewing_dateまたはviewing_timeがAPIレスポンスに含まれていません');
        console.log('   → データベースまたはバックエンドの問題');
      }
      
    } catch (error) {
      console.error('❌ JSONパースエラー:', error.message);
      console.log('レスポンス:', data);
    }
  });
}).on('error', (error) => {
  console.error('❌ リクエストエラー:', error.message);
});
