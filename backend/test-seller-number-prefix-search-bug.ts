/**
 * Bug Condition Exploration Test
 * 
 * Property 1: Bug Condition - 任意の2文字アルファベットプレフィックス検索
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * Goal: Surface counterexamples that demonstrate the bug exists
 * 
 * Test that searchSellers with FI123, BB456, CC789 returns matching sellers
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });

import { SellerService } from './src/services/SellerService.supabase';

async function testBugCondition() {
  console.log('🧪 Bug Condition Exploration Test');
  console.log('=====================================\n');
  
  const sellerService = new SellerService();
  
  // Test cases: AA以外のプレフィックスを持つ売主番号
  const testCases = [
    { input: 'FI123', expected: 'FI00123', description: 'FIプレフィックス' },
    { input: 'BB456', expected: 'BB00456', description: 'BBプレフィックス' },
    { input: 'CC789', expected: 'CC00789', description: 'CCプレフィックス' },
  ];
  
  let failedTests = 0;
  let passedTests = 0;
  
  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.description}`);
    console.log(`   Input: ${testCase.input}`);
    console.log(`   Expected seller_number: ${testCase.expected}`);
    
    try {
      const results = await sellerService.searchSellers(testCase.input);
      
      if (results.length === 0) {
        console.log(`   ❌ FAILED: No results found (bug confirmed)`);
        console.log(`   Expected: Should find seller with number ${testCase.expected}`);
        failedTests++;
      } else {
        const foundExpected = results.some(s => s.sellerNumber === testCase.expected);
        if (foundExpected) {
          console.log(`   ✅ PASSED: Found seller ${testCase.expected}`);
          passedTests++;
        } else {
          console.log(`   ❌ FAILED: Found ${results.length} results but not ${testCase.expected}`);
          console.log(`   Found: ${results.map(s => s.sellerNumber).join(', ')}`);
          failedTests++;
        }
      }
    } catch (error: any) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failedTests++;
    }
  }
  
  console.log('\n=====================================');
  console.log('📊 Test Summary:');
  console.log(`   Passed: ${passedTests}`);
  console.log(`   Failed: ${failedTests}`);
  console.log(`   Total: ${testCases.length}`);
  
  if (failedTests > 0) {
    console.log('\n🔍 Root Cause Analysis:');
    console.log('   The regex /^aa\\d+$/i only matches AA prefix');
    console.log('   Other prefixes (FI, BB, CC) do not match and are not searched');
    console.log('   Expected: All tests should FAIL on unfixed code');
    console.log('   This confirms the bug exists');
  } else {
    console.log('\n⚠️  WARNING: All tests passed - bug may already be fixed');
  }
  
  process.exit(failedTests > 0 ? 0 : 1); // Exit 0 if tests failed (expected on unfixed code)
}

testBugCondition().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
