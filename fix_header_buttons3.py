import re

# ===== SellersPage.tsx =====
with open('frontend/frontend/src/pages/SellersPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# \r\n を \n に正規化
content_normalized = content.replace('\r\n', '\n')

# ManualSyncButton import を削除
content_normalized = content_normalized.replace("import { ManualSyncButton } from '../components/ManualSyncButton';\n", "")

# ManualSyncButton の使用箇所を削除
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
if manual_sync_block in content_normalized:
    content_normalized = content_normalized.replace(manual_sync_block, "")
    print('ManualSyncButton 削除成功')
else:
    print('ManualSyncButton が見つかりません')

# 「活動ログ」ボタンを削除
activity_log_button = """            <Button
              variant="outlined"
              onClick={() => navigate('/activity-logs')}
            >
              活動ログ
            </Button>
"""
if activity_log_button in content_normalized:
    content_normalized = content_normalized.replace(activity_log_button, "")
    print('活動ログボタン 削除成功')
else:
    print('活動ログボタンが見つかりません')

# UTF-8 で書き込み（\n のまま）
with open('frontend/frontend/src/pages/SellersPage.tsx', 'wb') as f:
    f.write(content_normalized.encode('utf-8'))

print('完了！')
