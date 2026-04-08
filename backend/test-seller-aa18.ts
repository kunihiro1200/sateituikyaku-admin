import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env file
dotenv.config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

console.log('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Not set');
console.log('SUPABASE_SERVICE_KEY:', supabaseServiceKey ? 'Set' : 'Not set');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSellerAA18() {
  console.log('Testing seller AA18...');
  
  try {
    // Get raw seller data from database
    const { data: rawSeller, error } = await supabase
      .from('sellers')
      .select('*')
      .eq('seller_number', 'AA18')
      .single();
    
    if (error) {
      console.error('Error fetching seller:', error);
      return;
    }
    
    console.log('\n=== Raw Seller AA18 Data (from database) ===');
    console.log('seller_number:', rawSeller.seller_number);
    console.log('visit_assignee (raw):', rawSeller.visit_assignee);
    console.log('visit_date:', rawSeller.visit_date);
    console.log('visit_valuation_acquirer:', rawSeller.visit_valuation_acquirer);
    console.log('assigned_to:', rawSeller.assigned_to);
    
    // Check employees table for initials mapping
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('initials', rawSeller.visit_assignee)
      .single();
    
    if (empError) {
      console.log('\n❌ No employee found for initials:', rawSeller.visit_assignee);
      console.log('Error:', empError);
    } else {
      console.log('\n✅ Employee found for initials:', rawSeller.visit_assignee);
      console.log('Employee name:', employee.name);
      console.log('Employee email:', employee.email);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSellerAA18();
