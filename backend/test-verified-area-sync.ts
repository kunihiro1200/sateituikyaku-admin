import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSync() {
  try {
    console.log('🧪 Testing land_area_verified and building_area_verified sync...\n');
    
    // テスト用の売主を検索（最近更新されたもの）
    const { data: sellers, error } = await supabase
      .from('sellers')
      .select('id, seller_number, land_area_verified, building_area_verified, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log(`✅ Found ${sellers?.length || 0} recent sellers:\n`);
    
    sellers?.forEach((seller, index) => {
      console.log(`${index + 1}. ${seller.seller_number}`);
      console.log(`   - land_area_verified: ${seller.land_area_verified || '(null)'}`);
      console.log(`   - building_area_verified: ${seller.building_area_verified || '(null)'}`);
      console.log(`   - updated_at: ${seller.updated_at}`);
      console.log('');
    });
    
    // テスト: 最初の売主にテストデータを設定
    if (sellers && sellers.length > 0) {
      const testSeller = sellers[0];
      console.log(`\n🧪 Testing update for ${testSeller.seller_number}...`);
      
      const testLandArea = 100.50;
      const testBuildingArea = 80.25;
      
      const { error: updateError } = await supabase
        .from('sellers')
        .update({
          land_area_verified: testLandArea,
          building_area_verified: testBuildingArea,
        })
        .eq('id', testSeller.id);
      
      if (updateError) {
        console.error('❌ Update failed:', updateError);
        return;
      }
      
      console.log('✅ Update successful!');
      
      // 確認
      const { data: updated, error: checkError } = await supabase
        .from('sellers')
        .select('seller_number, land_area_verified, building_area_verified')
        .eq('id', testSeller.id)
        .single();
      
      if (checkError) {
        console.error('❌ Check failed:', checkError);
        return;
      }
      
      console.log('\n📊 Updated values:');
      console.log(`   - land_area_verified: ${updated.land_area_verified}`);
      console.log(`   - building_area_verified: ${updated.building_area_verified}`);
      
      if (updated.land_area_verified === testLandArea && updated.building_area_verified === testBuildingArea) {
        console.log('\n✅ Database update successful!');
        console.log('\n📝 Next step: Check if these values sync to Google Spreadsheet');
        console.log('   (This will happen automatically via SpreadsheetSyncService)');
      } else {
        console.log('\n❌ Values do not match!');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testSync();
