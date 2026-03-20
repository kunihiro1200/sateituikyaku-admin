import subprocess
import json
import os

script = """
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function check() {
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_number, deleted_at, distribution_type, latest_status, desired_area, property_number')
    .eq('buyer_number', '6935');
  console.log(JSON.stringify({ data, error }, null, 2));
}
check();
"""

backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
tmp_file = os.path.join(backend_dir, '_tmp_check.ts')

with open(tmp_file, 'w', encoding='utf-8') as f:
    f.write(script)

result = subprocess.run(
    ['node_modules\\.bin\\ts-node', '_tmp_check.ts'],
    capture_output=True, cwd=backend_dir, shell=True
)
stdout = result.stdout.decode('utf-8', errors='replace') if result.stdout else '(empty)'
stderr = result.stderr.decode('utf-8', errors='replace') if result.stderr else '(empty)'
print("STDOUT:", stdout[-3000:])
print("STDERR:", stderr[-500:])

os.remove(tmp_file)
