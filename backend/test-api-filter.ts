import axios from 'axios';

async function testApiFilter() {
  console.log('🔍 APIフィルターをテスト中...\n');

  const baseURL = 'https://sateituikyaku-admin-backend.vercel.app';
  
  // 「K 大分 石垣 マンション 追客中」フィルタのパラメータ
  const params = {
    page: 1,
    pageSize: 500,
    region: 'oita',
    townName: '石垣',
    propertyType: 'マンション',
    statusFilter: '追客中',
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
      console.log('📋 取得した売主（最初の20件）:');
      sellers.slice(0, 20).forEach((seller: any, index: number) => {
        const propertyAddress = seller.property?.address || seller.propertyAddress || '不明';
        const propertyType = seller.property?.propertyType || '不明';
        const status = seller.status || '不明';
        
        // 石垣を含むかチェック
        const hasIshigaki = propertyAddress.includes('石垣');
        const marker = hasIshigaki ? '✅' : '❌';
        
        console.log(`${index + 1}. ${marker} ${seller.sellerNumber} - ${propertyAddress} [${propertyType}] (${status})`);
      });

      // 石垣を含まない売主を探す
      const withoutIshigaki = sellers.filter((s: any) => {
        const addr = s.property?.address || s.propertyAddress || '';
        return !addr.includes('石垣');
      });

      if (withoutIshigaki.length > 0) {
        console.log('\n⚠️ 「石垣」を含まない売主が見つかりました:');
        withoutIshigaki.forEach((s: any) => {
          const addr = s.property?.address || s.propertyAddress || '';
          console.log(`  - ${s.sellerNumber}: ${addr}`);
        });
      } else {
        console.log('\n✅ すべての売主に「石垣」が含まれています');
      }
    }
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    if (error.response) {
      console.error('レスポンス:', error.response.data);
    }
  }
}

testApiFilter()
  .then(() => {
    console.log('\n✅ テスト完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
