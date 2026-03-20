import subprocess
import os

# スプレッドシートに6935が存在するか確認（import形式を修正）
script = """
import { EnhancedAutoSyncService } from './src/services/EnhancedAutoSyncService';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function check() {
  const service = new EnhancedAutoSyncService();
  await (service as any)['initializeBuyer']();
  const rows = await (service as any)['getBuyerSpreadsheetData'](true);
  
  // 6935を探す
  const found = rows.filter((r: any) => {
    const num = r['買主番号'];
    return String(num).trim() === '6935';
  });
  
  console.log('Total rows:', rows.length);
  console.log('Found 6935:', found.length);
  if (found.length > 0) {
    const row = found[0];
    console.log('buyer_number value:', JSON.stringify(row['買主番号']));
    console.log('type:', typeof row['買主番号']);
  }
  
  // 買主番号列のサンプル
  const sample = rows.slice(0, 5).map((r: any) => ({ num: r['買主番号'], type: typeof r['買主番号'] }));
  console.log('Sample:', JSON.stringify(sample));
}
check().catch((e: any) => console.error('Error:', e.message));
"""

backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
tmp_file = os.path.join(backend_dir, '_tmp_sheet_check.ts')

with open(tmp_file, 'w', encoding='utf-8') as f:
    f.write(script)

result = subprocess.run(
    ['node_modules\\.bin\\ts-node', '_tmp_sheet_check.ts'],
    capture_output=True, cwd=backend_dir, shell=True, timeout=90
)
stdout = result.stdout.decode('utf-8', errors='replace') if result.stdout else '(empty)'
stderr = result.stderr.decode('utf-8', errors='replace') if result.stderr else '(empty)'
print("STDOUT:", stdout[-3000:])
print("STDERR:", stderr[-800:] if stderr != '(empty)' else '')

os.remove(tmp_file)
