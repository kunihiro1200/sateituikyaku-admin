"""
PropertyListingDetailPage.tsx に PurchaseStatusBadge を追加するスクリプト
- Buyerインターフェースに latest_status フィールドを追加
- PurchaseStatusBadge, getPurchaseStatusText, hasBuyerPurchaseStatus をインポート
- ヘッダーの Box 内にバッジを挿入
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. getDisplayStatus インポートの後に PurchaseStatusBadge 等のインポートを追加
old_import = "import { getDisplayStatus } from '../utils/atbbStatusDisplayMapper';"
new_import = """import { getDisplayStatus } from '../utils/atbbStatusDisplayMapper';
import PurchaseStatusBadge from '../components/PurchaseStatusBadge';
import { getPurchaseStatusText, hasBuyerPurchaseStatus } from '../utils/purchaseStatusUtils';"""

if old_import in text:
    text = text.replace(old_import, new_import)
    print('✅ インポートを追加しました')
else:
    print('❌ インポート箇所が見つかりませんでした')

# 2. Buyer インターフェースに latest_status を追加
old_buyer_interface = """interface Buyer {
  buyer_id?: string;
  id?: number;
  name: string;
  buyer_number?: string;
  confidence_level?: string;
  inquiry_confidence?: string;
  phone?: string;
  phone_number?: string;
  email?: string;
  reception_date?: string;
  latest_viewing_date?: string;
}"""

new_buyer_interface = """interface Buyer {
  buyer_id?: string;
  id?: number;
  name: string;
  buyer_number?: string;
  confidence_level?: string;
  inquiry_confidence?: string;
  phone?: string;
  phone_number?: string;
  email?: string;
  reception_date?: string;
  latest_viewing_date?: string;
  latest_status?: string;
}"""

if old_buyer_interface in text:
    text = text.replace(old_buyer_interface, new_buyer_interface)
    print('✅ Buyer インターフェースに latest_status を追加しました')
else:
    print('❌ Buyer インターフェースが見つかりませんでした')

# 3. ヘッダーの Box 内（物件番号・コピーボタン付近）にバッジを挿入
# コピーボタンの Tooltip の後、公開URLボタンの前に挿入
old_header = """              <Tooltip title={copiedPropertyNumber ? 'コピーしました' : '物件番号をコピー'}>
                <IconButton
                  size="small"
                  onClick={handleCopyPropertyNumber}
                  sx={{ color: copiedPropertyNumber ? 'success.main' : SECTION_COLORS.property.main }}
                >
                  {copiedPropertyNumber ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              {/* 公開URLボタン */}"""

new_header = """              <Tooltip title={copiedPropertyNumber ? 'コピーしました' : '物件番号をコピー'}>
                <IconButton
                  size="small"
                  onClick={handleCopyPropertyNumber}
                  sx={{ color: copiedPropertyNumber ? 'success.main' : SECTION_COLORS.property.main }}
                >
                  {copiedPropertyNumber ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              {/* 買付状況バッジ */}
              <PurchaseStatusBadge
                statusText={getPurchaseStatusText(
                  buyers.find(b => hasBuyerPurchaseStatus(b.latest_status))?.latest_status,
                  data.offer_status
                )}
              />
              {/* 公開URLボタン */}"""

if old_header in text:
    text = text.replace(old_header, new_header)
    print('✅ ヘッダーにバッジを挿入しました')
else:
    print('❌ ヘッダー箇所が見つかりませんでした')

# UTF-8 (BOMなし) で書き込む
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')

# BOM チェック
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM チェック: {repr(first_bytes[:3])} (BOMなしなら先頭が import の文字コードになるはず)')
