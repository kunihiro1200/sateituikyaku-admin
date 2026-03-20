import os

backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
filepath = os.path.join(backend_dir, 'src', 'services', 'BuyerService.ts')

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = """      .eq('distribution_type', '要')
      .not('latest_status', 'ilike', '%成約%')
      .not('latest_status', 'ilike', '%D%');"""

new = """      .eq('distribution_type', '要')
      .is('deleted_at', null)
      .not('latest_status', 'ilike', '%成約%')
      .not('latest_status', 'ilike', '%D%');"""

if old in text:
    text = text.replace(old, new)
    print("OK: deleted_at IS NULL フィルターを追加しました")
else:
    print("ERROR: 対象文字列が見つかりません")

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))
