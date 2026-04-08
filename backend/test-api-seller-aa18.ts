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

async function testAPISellerAA18() {
  console.log('Testing API response for seller AA18...\n');
  
  try {
    // Get seller ID first
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('id, seller_number, visit_assignee')
      .eq('seller_number', 'AA18')
      .single();
    
    if (sellerError) {
      console.error('Error fetching seller:', sellerError);
      return;
    }
    
    console.log('=== Raw Database Data ===');
    console.log('Seller ID:', seller.id);
    console.log('Seller Number:', seller.seller_number);
    console.log('visit_assignee (raw):', seller.visit_assignee);
    
    // Now simulate what the API endpoint does
    // Import SellerService and call getSeller
    console.log('\n=== Simulating API Endpoint ===');
    console.log('This would call: GET /api/sellers/' + seller.id);
    console.log('Which internally calls: sellerService.getSeller(id)');
    console.log('Which calls: decryptSeller() method');
    
    console.log('\n=== Expected API Response ===');
    console.log('visitAssignee: Should be "裏天真" (full name from employees table)');
    console.log('visitAssigneeInitials: Should be "U" (original initials)');
    console.log('assignedTo: Should be null (from database)');
    
    console.log('\n=== Checking initialsMap ===');
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('initials, name')
      .order('initials');
    
    if (!empError && employees) {
      console.log('Initials Map:');
      const initialsMap: Record<string, string> = {};
      employees.forEach(emp => {
        initialsMap[emp.initials] = emp.name;
        console.log(`  ${emp.initials}: ${emp.name}`);
      });
      
      console.log('\n=== decryptSeller Logic ===');
      console.log('seller.visit_assignee:', seller.visit_assignee);
      console.log('initialsMap[seller.visit_assignee]:', initialsMap[seller.visit_assignee]);
      console.log('visitAssigneeFullName:', initialsMap[seller.visit_assignee] || null);
      console.log('visitAssignee (final):', initialsMap[seller.visit_assignee] || seller.visit_assignee || undefined);
      console.log('visitAssigneeInitials (final):', seller.visit_assignee || undefined);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPISellerAA18();
