/**
 * Bug Condition Exploration Test for Buyer 7272
 * 
 * This test checks if the desired_area field is synced from spreadsheet to database.
 * 
 * Expected behavior (BEFORE fix):
 * - Spreadsheet T列「★エリア」= "㊵㊶"
 * - Database desired_area = NULL
 * - Test FAILS (this confirms the bug exists)
 * 
 * Expected behavior (AFTER fix):
 * - Spreadsheet T列「★エリア」= "㊵㊶"
 * - Database desired_area = "㊵㊶"
 * - Test PASSES (this confirms the bug is fixed)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface BuyerSyncInput {
  buyer_number: string;
  spreadsheet_desired_area: string | null;
  db_desired_area: string | null;
}

/**
 * Bug Condition Function
 * 
 * Returns true if the buyer satisfies the bug condition:
 * - Spreadsheet desired_area is NOT NULL
 * - Spreadsheet desired_area != Database desired_area
 */
function isBugCondition(input: BuyerSyncInput): boolean {
  return input.spreadsheet_desired_area !== null &&
         input.spreadsheet_desired_area !== input.db_desired_area;
}

/**
 * Property 1: Bug Condition - desired_area フィールドの同期失敗
 * 
 * This test MUST FAIL on unfixed code.
 * Failure confirms the bug exists.
 */
async function testBugCondition() {
  console.log('🧪 Bug Condition Exploration Test: Buyer 7272');
  console.log('='.repeat(60));
  
  // Get buyer 7272 from database
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('buyer_number, desired_area')
    .eq('buyer_number', '7272')
    .maybeSingle();
  
  if (error) {
    console.error('❌ Error fetching buyer 7272:', error);
    return false;
  }
  
  if (!buyer) {
    console.error('❌ Buyer 7272 not found in database');
    return false;
  }
  
  console.log('📊 Database state:');
  console.log('  buyer_number:', buyer.buyer_number);
  console.log('  desired_area:', buyer.desired_area);
  
  // Expected spreadsheet value (actual value from spreadsheet)
  const expectedSpreadsheetValue = '②中学校（滝尾、城東、原川）';
  
  console.log('\n📋 Expected spreadsheet state:');
  console.log('  T列「★エリア」:', expectedSpreadsheetValue);
  
  // Create test input
  const input: BuyerSyncInput = {
    buyer_number: '7272',
    spreadsheet_desired_area: expectedSpreadsheetValue,
    db_desired_area: buyer.desired_area
  };
  
  console.log('\n🔍 Bug condition check:');
  console.log('  spreadsheet_desired_area:', input.spreadsheet_desired_area);
  console.log('  db_desired_area:', input.db_desired_area);
  console.log('  isBugCondition:', isBugCondition(input));
  
  // Test assertion
  if (isBugCondition(input)) {
    console.log('\n❌ TEST FAILED (EXPECTED on unfixed code)');
    console.log('   Bug confirmed: desired_area is not synced from spreadsheet to database');
    console.log('   Spreadsheet has "②中学校（滝尾、城東、原川）" but database has:', buyer.desired_area);
    return false;
  } else {
    console.log('\n✅ TEST PASSED');
    console.log('   desired_area is correctly synced');
    console.log('   Database value matches spreadsheet value:', buyer.desired_area);
    return true;
  }
}

/**
 * Additional test: Buyer 7271
 * 
 * Another counterexample from bugfix.md
 */
async function testBuyer7271() {
  console.log('\n🧪 Bug Condition Exploration Test: Buyer 7271');
  console.log('='.repeat(60));
  
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('buyer_number, desired_area')
    .eq('buyer_number', '7271')
    .maybeSingle();
  
  if (error) {
    console.error('❌ Error fetching buyer 7271:', error);
    return false;
  }
  
  if (!buyer) {
    console.error('❌ Buyer 7271 not found in database');
    return false;
  }
  
  console.log('📊 Database state:');
  console.log('  buyer_number:', buyer.buyer_number);
  console.log('  desired_area:', buyer.desired_area);
  
  const expectedSpreadsheetValue = '㊶別府';
  
  console.log('\n📋 Expected spreadsheet state:');
  console.log('  T列「★エリア」:', expectedSpreadsheetValue);
  
  const input: BuyerSyncInput = {
    buyer_number: '7271',
    spreadsheet_desired_area: expectedSpreadsheetValue,
    db_desired_area: buyer.desired_area
  };
  
  console.log('\n🔍 Bug condition check:');
  console.log('  spreadsheet_desired_area:', input.spreadsheet_desired_area);
  console.log('  db_desired_area:', input.db_desired_area);
  console.log('  isBugCondition:', isBugCondition(input));
  
  if (isBugCondition(input)) {
    console.log('\n❌ TEST FAILED (EXPECTED on unfixed code)');
    console.log('   Bug confirmed: desired_area is not synced');
    return false;
  } else {
    console.log('\n✅ TEST PASSED');
    console.log('   desired_area is correctly synced');
    return true;
  }
}

/**
 * Test: Buyer with empty desired_area (should not trigger bug condition)
 */
async function testEmptyDesiredArea() {
  console.log('\n🧪 Test: Buyer with empty desired_area');
  console.log('='.repeat(60));
  
  // This test checks that buyers with empty desired_area in spreadsheet
  // do not trigger the bug condition
  
  const input: BuyerSyncInput = {
    buyer_number: '7269',
    spreadsheet_desired_area: null,
    db_desired_area: null
  };
  
  console.log('📊 Test input:');
  console.log('  buyer_number:', input.buyer_number);
  console.log('  spreadsheet_desired_area:', input.spreadsheet_desired_area);
  console.log('  db_desired_area:', input.db_desired_area);
  console.log('  isBugCondition:', isBugCondition(input));
  
  if (!isBugCondition(input)) {
    console.log('\n✅ TEST PASSED');
    console.log('   Empty desired_area does not trigger bug condition');
    return true;
  } else {
    console.log('\n❌ TEST FAILED');
    console.log('   Empty desired_area should not trigger bug condition');
    return false;
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('🚀 Bug Condition Exploration Test Suite');
  console.log('='.repeat(60));
  console.log('');
  console.log('⚠️  IMPORTANT: This test MUST FAIL on unfixed code');
  console.log('   Failure confirms the bug exists');
  console.log('');
  
  const results = {
    buyer7272: await testBugCondition(),
    buyer7271: await testBuyer7271(),
    emptyDesiredArea: await testEmptyDesiredArea()
  };
  
  console.log('\n📊 Test Summary');
  console.log('='.repeat(60));
  console.log('Buyer 7272:', results.buyer7272 ? '✅ PASS' : '❌ FAIL (EXPECTED)');
  console.log('Buyer 7271:', results.buyer7271 ? '✅ PASS' : '❌ FAIL (EXPECTED)');
  console.log('Empty desired_area:', results.emptyDesiredArea ? '✅ PASS' : '❌ FAIL');
  
  const failedCount = Object.values(results).filter(r => !r).length;
  
  if (failedCount === 2 && results.emptyDesiredArea) {
    console.log('\n✅ Bug condition exploration test completed successfully');
    console.log('   2 counterexamples found (Buyer 7272, Buyer 7271)');
    console.log('   Bug confirmed: desired_area field is not synced');
    process.exit(0);
  } else if (failedCount === 0) {
    console.log('\n✅ All tests passed');
    console.log('   Bug is fixed: desired_area field is correctly synced');
    process.exit(0);
  } else {
    console.log('\n❌ Unexpected test results');
    console.log('   Expected: Buyer 7272 and 7271 to fail, empty desired_area to pass');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Test execution error:', error);
  process.exit(1);
});
