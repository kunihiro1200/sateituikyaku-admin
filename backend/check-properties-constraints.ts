import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkConstraints() {
  console.log('🔍 Checking properties table constraints...\n');

  // Get all constraints on properties table
  const { data: constraints, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT 
        conname AS constraint_name,
        contype AS constraint_type,
        pg_get_constraintdef(oid) AS constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'properties'::regclass
      ORDER BY conname;
    `
  });

  if (error) {
    console.error('❌ Error fetching constraints:', error);
    
    // Try alternative method
    console.log('\n🔄 Trying alternative method...\n');
    
    const { data: altConstraints, error: altError } = await supabase
      .from('information_schema.table_constraints')
      .select('*')
      .eq('table_name', 'properties');
    
    if (altError) {
      console.error('❌ Alternative method also failed:', altError);
    } else {
      console.log('✅ Constraints found:', JSON.stringify(altConstraints, null, 2));
    }
    return;
  }

  console.log('✅ Constraints on properties table:\n');
  constraints?.forEach((c: any) => {
    console.log(`📋 ${c.constraint_name} (${c.constraint_type})`);
    console.log(`   ${c.constraint_definition}\n`);
  });
}

checkConstraints().catch(console.error);
