import re

# ===== SellersPage.tsx =====
with open('frontend/frontend/src/pages/SellersPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# ManualSyncButton import を削除
content = content.replace("import { ManualSyncButton } from '../components/ManualSyncButton';\n", "")

# ManualSyncButton の使用箇所を削除（正確な文字列）
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
if manual_sync_block in content:
    content = content.replace(manual_sync_block, "")
    print('ManualSyncButton 削除成功')
else:
    print('ManualSyncButton が見つかりません。バイト列を確認します...')
    # バイト列で確認
    idx = content.find('ManualSyncButton')
    print(f'ManualSyncButton の位置: {idx}')
    if idx >= 0:
        print(repr(content[idx-50:idx+200]))

# 「活動ログ」ボタンを削除
activity_log_button = """            <Button
              variant="outlined"
              onClick={() => navigate('/activity-logs')}
            >
              活動ログ
            </Button>
"""
if activity_log_button in content:
    content = content.replace(activity_log_button, "")
    print('活動ログボタン 削除成功')
else:
    print('活動ログボタンが見つかりません')
    idx = content.find('活動ログ')
    if idx >= 0:
        print(repr(content[idx-100:idx+100]))

with open('frontend/frontend/src/pages/SellersPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('完了！')
