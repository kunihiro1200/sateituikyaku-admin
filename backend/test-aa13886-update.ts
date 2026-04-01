import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testUpdate() {
  try {
    console.log('🧪 Testing AA13886 update via API...\n');
    
    // Step 1: Get seller ID
    const { data: seller, error } = await supabase
      .from('sellers')
      .select('id')
      .eq('seller_number', 'AA13886')
      .single();
    
    if (error || !seller) {
      console.error('❌ Seller not found:', error);
      return;
    }
    
    console.log(`✅ Found seller ID: ${seller.id}\n`);
    
    // Step 2: Update via API (simulating CallModePage request)
    const apiUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/sellers/${seller.id}`
      : `http://localhost:3000/api/sellers/${seller.id}`;
    
    console.log(`📝 Updating via API: ${apiUrl}\n`);
    
    const updateData = {
      landAreaVerified: 123.45,
      buildingAreaVerified: 67.89,
    };
    
    console.log('📤 Request data:', JSON.stringify(updateData, null, 2));
    
    try {
      const response = await axios.put(apiUrl, updateData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('\n✅ API response:', response.status);
      console.log('📊 Response data:', JSON.stringify(response.data, null, 2));
    } catch (apiError: any) {
      console.error('\n❌ API error:', apiError.response?.data || apiError.message);
    }
    
    // Step 3: Verify database
    console.log('\n🔍 Verifying database...');
    const { data: updated, error: checkError } = await supabase
      .from('sellers')
      .select('seller_number, land_area_verified, building_area_verified')
      .eq('id', seller.id)
      .single();
    
    if (checkError) {
      console.error('❌ Check error:', checkError);
      return;
    }
    
    console.log('\n📊 Database values:');
    console.log(`   - land_area_verified: ${updated.land_area_verified}`);
    console.log(`   - building_area_verified: ${updated.building_area_verified}`);
    
    if (updated.land_area_verified === 123.45 && updated.building_area_verified === 67.89) {
      console.log('\n✅ Update successful!');
    } else {
      console.log('\n❌ Values do not match!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testUpdate();
