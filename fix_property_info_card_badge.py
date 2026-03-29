"""
PropertyInfoCard.tsx に PurchaseStatusBadge を追加するスクリプト
"""
with open('frontend/frontend/src/components/PropertyInfoCard.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# インポートを追加（import api の後）
old_import = "import api from '../services/api';"
new_import = """import api from '../services/api';
import PurchaseStatusBadge from './PurchaseStatusBadge';
import { getPurchaseStatusText } from '../utils/purchaseStatusUtils';"""

text = text.replace(old_import, new_import, 1)

# return文の Paper の直後（Header Box の前）にバッジを挿入
old_header = """      {/* Header - 外部リンクアイコンと閉じるボタンのみ */}
      <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>"""

new_header = """      {/* 買付状況バッジ - 最上部に表示 */}
      <PurchaseStatusBadge
        statusText={getPurchaseStatusText(buyer?.latest_status, null)}
      />
      {/* Header - 外部リンクアイコンと閉じるボタンのみ */}
      <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>"""

text = text.replace(old_header, new_header, 1)

with open('frontend/frontend/src/components/PropertyInfoCard.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done')
