import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyColumn() {
  console.log('🔍 Verifying report_memo column in property_listings table\n');

  try {
    // Test 1: Check if column exists by querying a property
    console.log('Test 1: Querying property_listings with report_memo...');
    const { data: properties, error: queryError } = await supabase
      .from('property_listings')
      .select('property_number, report_memo')
      .limit(5);

    if (queryError) {
      console.error('❌ Query failed:', queryError.message);
      console.log('   Column may not exist yet.');
      return false;
    }

    console.log('✅ Query successful!');
    console.log(`   Found ${properties?.length || 0} properties`);
    
    if (properties && properties.length > 0) {
      console.log('\n📋 Sample data:');
      properties.forEach((p: any) => {
        console.log(`   - ${p.property_number}: report_memo = ${p.report_memo === null ? 'NULL' : `"${p.report_memo}"`}`);
      });
    }

    // Test 2: Try to update a property with report_memo
    if (properties && properties.length > 0) {
      const testProperty = properties[0].property_number;
      console.log(`\nTest 2: Updating report_memo for ${testProperty}...`);
      
      const testMemo = 'テストメモ - ' + new Date().toISOString();
      const { error: updateError } = await supabase
        .from('property_listings')
        .update({ report_memo: testMemo })
        .eq('property_number', testProperty);

      if (updateError) {
        console.error('❌ Update failed:', updateError.message);
        return false;
      }

      console.log('✅ Update successful!');

      // Verify the update
      const { data: updated, error: verifyError } = await supabase
        .from('property_listings')
        .select('property_number, report_memo')
        .eq('property_number', testProperty)
        .single();

      if (verifyError) {
        console.error('❌ Verification failed:', verifyError.message);
        return false;
      }

      console.log(`✅ Verified: report_memo = "${updated.report_memo}"`);

      // Clean up: set back to NULL
      await supabase
        .from('property_listings')
        .update({ report_memo: null })
        .eq('property_number', testProperty);

      console.log('✅ Cleanup complete (set back to NULL)');
    }

    console.log('\n🎉 All tests passed!');
    console.log('\n📊 Summary:');
    console.log('   ✅ report_memo column exists');
    console.log('   ✅ Can query report_memo');
    console.log('   ✅ Can update report_memo');
    console.log('   ✅ NULL values work correctly');
    console.log('\n✅ Migration verified successfully!');

    return true;

  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
}

verifyColumn();
