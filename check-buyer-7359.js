const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    // 買主7359の情報を取得
    const { data: buyer, error: buyerError } = await supabase
      .from('buyers')
      .select('buyer_number, name, property_number, follow_up_assignee')
      .eq('buyer_number', '7359')
      .single();
    
    if (buyerError) {
      console.log('買主取得エラー:', buyerError.message);
      return;
    }
    
    console.log('買主情報:');
    console.log('  買主番号:', buyer.buyer_number);
    console.log('  名前:', buyer.name);
    console.log('  物件番号:', buyer.property_number || '（未設定）');
    console.log('  後続担当:', buyer.follow_up_assignee || '（未設定）');
    
    if (buyer.property_number) {
      // 物件情報を取得
      const { data: property, error: propertyError } = await supabase
        .from('property_listings')
        .select('property_number, display_address, address, sales_assignee')
        .eq('property_number', buyer.property_number)
        .single();
      
      if (propertyError) {
        console.log('物件取得エラー:', propertyError.message);
        return;
      }
      
      console.log('\n物件情報:');
      console.log('  物件番号:', property.property_number);
      console.log('  住所:', property.display_address || property.address || '（未設定）');
      console.log('  物件担当:', property.sales_assignee || '（未設定）');
      
      if (property.sales_assignee) {
        // 物件担当の従業員情報を取得
        const { data: employees, error: employeeError } = await supabase
          .from('employees')
          .select('id, name, email, initials')
          .eq('initials', property.sales_assignee);
        
        if (employeeError) {
          console.log('従業員取得エラー:', employeeError.message);
        } else if (employees && employees.length > 0) {
          console.log('\n物件担当の従業員情報:');
          employees.forEach(emp => {
            console.log('  名前:', emp.name);
            console.log('  イニシャル:', emp.initials);
            console.log('  メールアドレス:', emp.email || '（未設定）');
          });
        } else {
          console.log('\n⚠️ 物件担当のイニシャル「' + property.sales_assignee + '」に一致する従業員が見つかりません');
        }
      } else {
        console.log('\n⚠️ 物件に物件担当が設定されていないため、メール送信はスキップされます');
      }
    } else {
      console.log('\n⚠️ 買主に物件番号が設定されていないため、メール送信はスキップされます');
    }
  } catch (error) {
    console.error('エラー:', error.message);
  }
})();
