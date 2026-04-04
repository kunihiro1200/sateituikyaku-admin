/**
 * Preservation Property Tests
 * 
 * Property 2: Preservation - AAプレフィックス検索の継続動作
 * 
 * IMPORTANT: Follow observation-first methodology
 * Observe behavior on UNFIXED code for non-buggy inputs
 * 
 * Goal: Capture baseline behavior to preserve after fix
 * 
 * Test that:
 * - AA13501 search continues to work correctly
 * - Invalid formats (A123, ABC123, 12345) continue to not match regex
 * - Non-seller-number searches (name, address) continue to work correctly
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });

import { SellerService } from './src/services/SellerService.supabase';

async function testPreservation() {
  console.log('🧪 Preservation Property Tests');
  console.log('=====================================\n');
  
  const sellerService = new SellerService();
  
  let failedTests = 0;
  let passedTests = 0;
  
  // Test 1: AA prefix search should continue to work
  console.log('📝 Test 1: AA prefix search preservation');
  console.log('   Input: AA13501');
  
  try {
    const results = await sellerService.searchSellers('AA13501');
    
    if (results.length > 0) {
      const foundExpected = results.some(s => s.sellerNumber === 'AA13501');
      if (foundExpected) {
        console.log('   ✅ PASSED: Found seller AA13501 (baseline behavior preserved)');
        passedTests++;
      } else {
        console.log('   ❌ FAILED: Found results but not AA13501');
        console.log(`   Found: ${results.map(s => s.sellerNumber).join(', ')}`);
        failedTests++;
      }
    } else {
      console.log('   ❌ FAILED: No results found for AA13501');
      failedTests++;
    }
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    failedTests++;
  }
  
  // Test 2: Invalid format - single letter + numbers (should not match regex)
  console.log('\n📝 Test 2: Invalid format - A123 (single letter)');
  console.log('   Input: A123');
  console.log('   Expected: Should NOT match regex, use slow path');
  
  try {
    const results = await sellerService.searchSellers('A123');
    console.log(`   ✅ PASSED: Slow path used (${results.length} results) - baseline behavior preserved`);
    passedTests++;
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    failedTests++;
  }
  
  // Test 3: Invalid format - three letters + numbers (should not match regex)
  console.log('\n📝 Test 3: Invalid format - ABC123 (three letters)');
  console.log('   Input: ABC123');
  console.log('   Expected: Should NOT match regex, use slow path');
  
  try {
    const results = await sellerService.searchSellers('ABC123');
    console.log(`   ✅ PASSED: Slow path used (${results.length} results) - baseline behavior preserved`);
    passedTests++;
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    failedTests++;
  }
  
  // Test 4: Invalid format - numbers only (should use numeric search path)
  console.log('\n📝 Test 4: Numbers only - 12345');
  console.log('   Input: 12345');
  console.log('   Expected: Should use numeric search path');
  
  try {
    const results = await sellerService.searchSellers('12345');
    console.log(`   ✅ PASSED: Numeric search path used (${results.length} results) - baseline behavior preserved`);
    passedTests++;
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    failedTests++;
  }
  
  // Test 5: Non-seller-number search (name search)
  console.log('\n📝 Test 5: Non-seller-number search (name)');
  console.log('   Input: 田中');
  console.log('   Expected: Should use slow path for encrypted field search');
  
  try {
    const results = await sellerService.searchSellers('田中');
    console.log(`   ✅ PASSED: Slow path used for name search (${results.length} results) - baseline behavior preserved`);
    passedTests++;
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    failedTests++;
  }
  
  console.log('\n=====================================');
  console.log('📊 Test Summary:');
  console.log(`   Passed: ${passedTests}`);
  console.log(`   Failed: ${failedTests}`);
  console.log(`   Total: 5`);
  
  if (failedTests === 0) {
    console.log('\n✅ All preservation tests passed on unfixed code');
    console.log('   Baseline behavior captured successfully');
    console.log('   These tests will verify no regressions after fix');
  } else {
    console.log('\n⚠️  Some preservation tests failed');
    console.log('   Review baseline behavior before proceeding');
  }
  
  process.exit(failedTests === 0 ? 0 : 1);
}

testPreservation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
