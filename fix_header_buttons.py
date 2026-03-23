import re

# ===== PropertyListingsPage.tsx =====
with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# PublicSiteButtons import を削除
content = content.replace("import PublicSiteButtons from '../components/PublicSiteButtons';\n", "")

# PublicSiteButtons の使用箇所を削除（ヘッダー部分）
# <PublicSiteButtons /> を含む行を削除
content = content.replace("        <PublicSiteButtons />\n", "")

with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('PropertyListingsPage.tsx: PublicSiteButtons 削除完了')

# ===== SellersPage.tsx =====
with open('frontend/frontend/src/pages/SellersPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# ManualSyncButton import を削除
content = content.replace("import { ManualSyncButton } from '../components/ManualSyncButton';\n", "")

# ManualSyncButton の使用箇所を削除（複数行にわたる）
manual_sync_block = """            {/* 手動更新ボタン */}
            <ManualSyncButton
              onSyncComplete={(result) => {
                if (result.success) {
                  setSyncError(null); // エラーをクリア
                  fetchSellers();
                }
              }}
              onSyncError={(error: any) => {
                setSyncError({
                  message: error.message,
                  recoverable: error.recoverable || false,
                });
              }}
            />
"""
content = content.replace(manual_sync_block, "")

# 「活動ログ」ボタンを削除
activity_log_button = """            <Button
              variant="outlined"
              onClick={() => navigate('/activity-logs')}
            >
              活動ログ
            </Button>
"""
content = content.replace(activity_log_button, "")

with open('frontend/frontend/src/pages/SellersPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('SellersPage.tsx: ManualSyncButton・活動ログボタン 削除完了')
print('完了！')
