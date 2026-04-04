import axios from 'axios';

const API_BASE_URL = 'https://sateituikyaku-admin-backend.vercel.app';

async function testBuyerSidebarAPI() {
  console.log('📊 /api/buyers/status-categories-with-buyers をテスト中...\n');

  try {
    const response = await axios.get(`${API_BASE_URL}/api/buyers/status-categories-with-buyers`);
    
    const { statusCategoriesWithBuyers, buyers, normalStaffInitials } = response.data;
    
    console.log('✅ APIレスポンス:\n');
    console.log('📊 statusCategoriesWithBuyers:');
    console.log(JSON.stringify(statusCategoriesWithBuyers, null, 2));
    console.log('\n📊 buyers配列の件数:', buyers?.length || 0);
    console.log('📊 normalStaffInitials:', normalStaffInitials);
    
    // statusCategoriesWithBuyers が空でないか確認
    if (statusCategoriesWithBuyers && statusCategoriesWithBuyers.length > 0) {
      console.log('\n✅ サイドバーカテゴリーが正常に表示されています');
      console.log(`   カテゴリー数: ${statusCategoriesWithBuyers.length}`);
      
      // 主要なカテゴリーが含まれているか確認
      const categories = statusCategoriesWithBuyers.map((c: any) => c.category);
      const hasViewingDayBefore = categories.includes('viewingDayBefore');
      const hasTodayCall = categories.includes('todayCall');
      const hasAssigned = categories.some((c: string) => c.startsWith('assigned_'));
      
      console.log(`   内覧日前日: ${hasViewingDayBefore ? '✅' : '❌'}`);
      console.log(`   当日TEL: ${hasTodayCall ? '✅' : '❌'}`);
      console.log(`   担当(イニシャル): ${hasAssigned ? '✅' : '❌'}`);
      
      if (hasViewingDayBefore && hasTodayCall && hasAssigned) {
        console.log('\n🎉 バグが修正されました！全ての主要カテゴリーが表示されています。');
      } else {
        console.log('\n⚠️ 一部のカテゴリーが不足しています。');
      }
    } else {
      console.log('\n❌ サイドバーカテゴリーが空です（バグが存在します）');
    }
  } catch (error: any) {
    console.error('❌ APIエラー:', error.message);
  }
}

testBuyerSidebarAPI().catch(console.error);
