import subprocess
import os

script = """
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function restore() {
  // deleted_at を NULL に戻す（復元）
  const { data, error } = await supabase
    .from('buyers')
    .update({ deleted_at: null })
    .eq('buyer_number', '6935');
  if (error) {
    console.log('ERROR:', JSON.stringify(error));
  } else {
    console.log('OK: buyer 6935 restored (deleted_at set to null)');
  }

  // 確認
  const { data: check } = await supabase
    .from('buyers')
    .select('buyer_number, deleted_at')
    .eq('buyer_number', '6935');
  console.log('After restore:', JSON.stringify(check));
}
restore();
"""

backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
tmp_file = os.path.join(backend_dir, '_tmp_restore.ts')

with open(tmp_file, 'w', encoding='utf-8') as f:
    f.write(script)

result = subprocess.run(
    ['node_modules\\.bin\\ts-node', '_tmp_restore.ts'],
    capture_output=True, cwd=backend_dir, shell=True
)
stdout = result.stdout.decode('utf-8', errors='replace') if result.stdout else '(empty)'
stderr = result.stderr.decode('utf-8', errors='replace') if result.stderr else '(empty)'
print("STDOUT:", stdout)
print("STDERR:", stderr[-300:] if stderr != '(empty)' else '')

os.remove(tmp_file)
