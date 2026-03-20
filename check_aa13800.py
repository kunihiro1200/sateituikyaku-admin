import subprocess
import json
import os

script = """
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('sellers')
    .select('id, seller_number, property_address, property_type, google_map_url, valuation_amount_1, valuation_amount_2, valuation_amount_3')
    .eq('seller_number', 'AA13800')
    .single();
  
  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

check().catch(console.error);
"""

with open('check_aa13800_temp.ts', 'w', encoding='utf-8') as f:
    f.write(script)

result = subprocess.run(
    ['npx', 'ts-node', 'check_aa13800_temp.ts'],
    capture_output=True,
    text=True,
    cwd=os.path.join(os.getcwd(), 'backend')
)

print("STDOUT:", result.stdout)
print("STDERR:", result.stderr[:500] if result.stderr else "")

os.remove('backend/check_aa13800_temp.ts')
