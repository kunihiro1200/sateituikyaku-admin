import axios from 'axios';

async function testFilterAPI() {
  console.log('🔍 フィルターAPIをテスト中...\n');

  const baseURL = 'https://sateituikyaku-admin-backend.vercel.app';
  
  // 「K 大分 石垣 マンション 追客中」フィルタのパラメータ
  const params = {
    page: 1,
    pageSize: 500,
    region: ['oita'],
    townName: '石垣',
    propertyType: ['マンション'],
    statusFilter: ['追客中'],
    sortBy: 'next_call_date',
    sortOrder: 'asc',
  };

  console.log('📤 送信するパラメータ:');
  console.log(JSON.stringify(params, null, 2));
  console.log('');

  try {
    const response = await axios.get(`${baseURL}/api/sellers`, { params });
    const sellers = response.data.data || [];
    const total = response.data.total || 0;

    console.log(`✅ APIレスポンス: ${total}件`);
    console.log('');

    if (sellers.length > 0) {
      console.log('📋 取得した売主（全件）:');
      sellers.forEach((seller: any, index: number) => {
        const sellerNumber = seller.sellerNumber || seller.seller_number || '不明';
        const propertyAddress = seller.property?.address || seller.propertyAddress || '不明';
        const propertyType = seller.property?.propertyType || '不明';
        const status = seller.status || '不明';
        
        // 石垣を含むかチェック
        const hasIshigaki = propertyAddress.includes('石垣');
        const marker = hasIshigaki ? '✅' : '❌';
        
        // FIプレフィックスチェック
        const isFI = sellerNumber.startsWith('FI');
        const regionMarker = isFI ? '福岡' : '大分';
        
        console.log(`${index + 1}. ${marker} ${sellerNumber} [${regionMarker}] - ${propertyAddress} [${propertyType}] (${status})`);
      });

      // 石垣を含まない売主を探す
      const withoutIshigaki = sellers.filter((s: any) => {
        const addr = s.property?.address || s.propertyAddress || '';
        return !addr.includes('石垣');
      });

      if (withoutIshigaki.length > 0) {
        console.log('\n⚠️ 「石垣」を含まない売主が見つかりました:');
        withoutIshigaki.forEach((s: any) => {
          const num = s.sellerNumber || s.seller_number || '不明';
          const addr = s.property?.address || s.propertyAddress || '';
          console.log(`  - ${num}: ${addr}`);
        });
      } else {
        console.log('\n✅ すべての売主に「石垣」が含まれています');
      }

      // FIプレフィックスの売主を探す
      const fiSellers = sellers.filter((s: any) => {
        const num = s.sellerNumber || s.seller_number || '';
        return num.startsWith('FI');
      });

      if (fiSellers.length > 0) {
        console.log('\n⚠️ FIプレフィックス（福岡）の売主が見つかりました:');
        fiSellers.forEach((s: any) => {
          const num = s.sellerNumber || s.seller_number || '';
          const addr = s.property?.address || s.propertyAddress || '';
          console.log(`  - ${num}: ${addr}`);
        });
      } else {
        console.log('\n✅ すべての売主が大分（FIプレフィックスなし）です');
      }
    } else {
      console.log('⚠️ 売主が見つかりませんでした');
    }
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    if (error.response) {
      console.error('レスポンス:', error.response.data);
    }
  }
}

testFilterAPI()
  .then(() => {
    console.log('\n✅ テスト完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
