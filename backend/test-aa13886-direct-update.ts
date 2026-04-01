import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDirectUpdate() {
  try {
    console.log('🧪 Testing AA13886 direct database update...\n');
    
    // Step 1: Update database directly
    const { error: updateError } = await supabase
      .from('sellers')
      .update({
        land_area_verified: 123.45,
        building_area_verified: 67.89,
      })
      .eq('seller_number', 'AA13886');
    
    if (updateError) {
      console.error('❌ Update error:', updateError);
      return;
    }
    
    console.log('✅ Database update successful!\n');
    
    // Step 2: Verify
    const { data: seller, error: checkError } = await supabase
      .from('sellers')
      .select('seller_number, land_area_verified, building_area_verified, updated_at')
      .eq('seller_number', 'AA13886')
      .single();
    
    if (checkError) {
      console.error('❌ Check error:', checkError);
      return;
    }
    
    console.log('📊 Database values:');
    console.log(`   - seller_number: ${seller.seller_number}`);
    console.log(`   - land_area_verified: ${seller.land_area_verified}`);
    console.log(`   - building_area_verified: ${seller.building_area_verified}`);
    console.log(`   - updated_at: ${seller.updated_at}`);
    
    if (seller.land_area_verified === 123.45 && seller.building_area_verified === 67.89) {
      console.log('\n✅ Values match!');
      console.log('\n📝 Next: Check if SpreadsheetSyncService syncs these values to Google Spreadsheet');
      console.log('   (This should happen automatically when sellers table is updated)');
    } else {
      console.log('\n❌ Values do not match!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDirectUpdate();
