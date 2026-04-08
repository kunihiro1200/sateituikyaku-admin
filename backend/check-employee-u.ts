import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkEmployeeU() {
  console.log('Checking for employee with initials "U"...');
  
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('initials', 'U');
  
  if (error) {
    console.error('Error querying employees:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('✅ Found employee(s) with initials "U":');
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('❌ No employee found with initials "U"');
    console.log('Need to add employee: 名前: "裏天真", イニシャル: "U"');
  }
  
  // Also check all employees to see what initials exist
  const { data: allEmployees, error: allError } = await supabase
    .from('employees')
    .select('initials, name')
    .order('initials');
  
  if (!allError && allEmployees) {
    console.log('\nAll employees initials:');
    allEmployees.forEach(emp => {
      console.log(`  ${emp.initials}: ${emp.name}`);
    });
  }
}

checkEmployeeU();
