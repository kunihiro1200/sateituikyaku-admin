/**
 * Check AA13729 visit date and time data
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkAA13729() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('🔍 Checking AA13729 visit date and time data\n');

  const { data: seller, error } = await supabase
    .from('sellers')
    .select('seller_number, visit_date, visit_time, visit_assignee')
    .eq('seller_number', 'AA13729')
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('Seller Number:', seller.seller_number);
  console.log('Visit Date:', seller.visit_date);
  console.log('Visit Time:', seller.visit_time);
  console.log('Visit Assignee:', seller.visit_assignee);
  console.log('\n');

  // Check if visit_date contains space
  if (seller.visit_date && typeof seller.visit_date === 'string' && seller.visit_date.includes(' ')) {
    console.log('✅ Bug Condition CONFIRMED: visit_date contains space');
    console.log('   Format:', seller.visit_date);
    const parts = seller.visit_date.split(' ');
    console.log('   First date:', parts[0]);
    console.log('   Second date:', parts[1]);
  } else {
    console.log('❌ Bug Condition NOT FOUND: visit_date does not contain space');
  }

  console.log('\n');

  // Check if visit_time is in date format
  if (seller.visit_time && typeof seller.visit_time === 'string' && seller.visit_time.match(/\d{4}-\d{2}-\d{2}/)) {
    console.log('✅ Bug Condition CONFIRMED: visit_time is in date format');
    console.log('   Format:', seller.visit_time);
  } else {
    console.log('❌ Bug Condition NOT FOUND: visit_time is not in date format');
    console.log('   Current value:', seller.visit_time);
  }
}

checkAA13729();
