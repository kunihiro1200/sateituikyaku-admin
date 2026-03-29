"""
NewBuyerPage.tsx に PurchaseStatusBadge を追加するスクリプト
"""
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# インポートを追加（import api の後）
old_import = "import api from '../services/api';"
new_import = """import api from '../services/api';
import PurchaseStatusBadge from '../components/PurchaseStatusBadge';
import { getPurchaseStatusText } from '../utils/purchaseStatusUtils';"""

text = text.replace(old_import, new_import, 1)

# 物件情報Paperの先頭（Typography「物件情報」の前）にバッジを挿入
old_paper_header = """          <Paper sx={{ p: 3, position: 'sticky', top: 16 }}>
            <Typography variant="h6" gutterBottom>物件情報</Typography>"""

new_paper_header = """          <Paper sx={{ p: 3, position: 'sticky', top: 16 }}>
            {/* 買付状況バッジ - 物件情報エリアの最上部に表示 */}
            <PurchaseStatusBadge
              statusText={getPurchaseStatusText(latestStatus, propertyInfo?.offer_status)}
            />
            <Typography variant="h6" gutterBottom>物件情報</Typography>"""

text = text.replace(old_paper_header, new_paper_header, 1)

with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done')
