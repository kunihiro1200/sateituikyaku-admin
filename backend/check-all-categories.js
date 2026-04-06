const categories = [
  'viewingDayBefore',
  'todayCall',
  'threeCallUnchecked',
  'inquiryEmailUnanswered',
  'brokerInquiry',
  'generalViewingSellerContactPending',
  'viewingPromotionRequired',
  'pinrichUnregistered'
];

(async () => {
  console.log('📊 全カテゴリーのcalculated_status確認\n');
  
  for (const category of categories) {
    const response = await fetch(`https://sateituikyaku-admin-backend.vercel.app/api/buyers?statusCategory=${category}&limit=1`);
    const data = await response.json();
    
    console.log(`カテゴリー: ${category}`);
    console.log(`  件数: ${data.total}`);
    
    if (data.data && data.data.length > 0) {
      const buyer = data.data[0];
      console.log(`  買主番号: ${buyer.buyer_number}`);
      console.log(`  calculated_status: ${buyer.calculated_status}`);
      if (buyer.calculated_status) {
        console.log(`  ✅ calculated_statusあり`);
      } else {
        console.log(`  ❌ calculated_statusなし`);
      }
    } else {
      console.log(`  該当なし`);
    }
    console.log('');
  }
  
  console.log('✅ 確認完了');
})();
