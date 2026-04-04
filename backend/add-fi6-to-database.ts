import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function addFI6ToDatabase() {
  console.log('🔍 Adding FI6 to database for testing...\n');
  
  // Check if FI00006 already exists
  const { data: existing } = await supabase
    .from('sellers')
    .select('seller_number')
    .eq('seller_number', 'FI00006')
    .single();
  
  if (existing) {
    console.log('✅ FI00006 already exists in database');
    return;
  }
  
  // Add FI00006 as test data
  const { data, error } = await supabase
    .from('sellers')
    .insert({
      seller_number: 'FI00006',
      name: null, // Will be encrypted if needed
      address: '不可',
      phone_number: null,
      email: null,
      status: 'テスト',
      inquiry_date: '2026-04-04',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error adding FI00006:', error);
    return;
  }
  
  console.log('✅ Successfully added FI00006 to database');
  console.log('   Seller Number:', data.seller_number);
  console.log('   Address:', data.address);
  
  // Also add FI00002 for more test coverage
  const { data: existing2 } = await supabase
    .from('sellers')
    .select('seller_number')
    .eq('seller_number', 'FI00002')
    .single();
  
  if (!existing2) {
    const { data: data2, error: error2 } = await supabase
      .from('sellers')
      .insert({
        seller_number: 'FI00002',
        name: null,
        address: '不可',
        phone_number: null,
        email: null,
        status: 'テスト',
        inquiry_date: '2026-04-04',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (!error2) {
      console.log('✅ Successfully added FI00002 to database');
      console.log('   Seller Number:', data2.seller_number);
    }
  } else {
    console.log('✅ FI00002 already exists in database');
  }
}

addFI6ToDatabase().catch(console.error);
