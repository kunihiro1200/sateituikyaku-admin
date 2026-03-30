# fix_post_viewing_seller_contact.py
# BuyerViewingResultPage.tsx の「内覧後売主連絡」フィールドを更新する
# 1. 表示条件を atbb_status ベースから viewing_mobile/viewing_type_general ベースに変更
# 2. 必須バリデーション追加
# 3. SYNC_FIELDS に post_viewing_seller_contact を追加
# 4. button-select-layout-rule.md 準拠のレイアウトに更新

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 変更1: SYNC_FIELDS に post_viewing_seller_contact を追加
old_sync = """        'notification_sender',
        'inquiry_hearing',
      ];"""
new_sync = """        'notification_sender',
        'inquiry_hearing',
        'post_viewing_seller_contact',
      ];"""
text = text.replace(old_sync, new_sync)

# 変更2: 内覧後売主連絡の表示条件とUIを更新
# 旧: atbb_status ベースの条件 + シンプルなボタン
old_block = """            {/* 内覧後売主連絡（atbb_statusが「一般・公開中」の場合のみ表示） */}
            {linkedProperties?.some((p: any) => p.atbb_status && p.atbb_status.includes('一般・公開中')) && (
              <Box sx={{ mt: 1, mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                  内覧後売主連絡
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {(['済', '未', '不要'] as const).map((option) => (
                    <Button
                      key={option}
                      variant={buyer.post_viewing_seller_contact === option ? 'contained' : 'outlined'}
                      color={option === '済' ? 'success' : option === '未' ? 'error' : 'inherit'}
                      size="small"
                      onClick={async () => {
                        const newValue = buyer.post_viewing_seller_contact === option ? '' : option;
                        await handleInlineFieldSave('post_viewing_seller_contact', newValue);
                      }}
                      sx={{ fontSize: '0.75rem', padding: '2px 10px' }}
                    >
                      {option}
                    </Button>
                  ))}
                </Box>
              </Box>
            )}"""

# 新: viewing_mobile/viewing_type_general ベースの条件 + button-select-layout-rule 準拠レイアウト + 必須バリデーション
new_block = """            {/* 内覧後売主連絡（viewing_mobile または viewing_type_general に「一般」が含まれる場合のみ表示） */}
            {(() => {
              const showPostViewingSellerContact =
                (buyer.viewing_mobile && buyer.viewing_mobile.includes('一般')) ||
                (buyer.viewing_type_general && buyer.viewing_type_general.includes('一般'));
              if (!showPostViewingSellerContact) return null;

              // 必須条件判定
              // mediation_type === "一般・公開中" AND latest_viewing_date >= "2025-07-05" AND <= today AND viewing_result_follow_up が非空
              const isPostViewingSellerContactRequired = (() => {
                const mediationType = linkedProperties?.find((p: any) => p.atbb_status)?.atbb_status || '';
                if (mediationType !== '一般・公開中') return false;
                if (!buyer.latest_viewing_date) return false;
                const viewingDate = new Date(buyer.latest_viewing_date);
                if (isNaN(viewingDate.getTime())) return false;
                const minDate = new Date('2025-07-05');
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                if (viewingDate < minDate || viewingDate > today) return false;
                return !!(buyer.viewing_result_follow_up && String(buyer.viewing_result_follow_up).trim());
              })();

              return (
                <Box sx={{ mt: 1, mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.7rem' }}>
                      内覧後売主連絡{isPostViewingSellerContactRequired ? '*' : ''}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                      {(['済', '未', '不要'] as const).map((option) => {
                        const isSelected = buyer.post_viewing_seller_contact === option;
                        return (
                          <Button
                            key={option}
                            size="small"
                            variant={isSelected ? 'contained' : 'outlined'}
                            color="primary"
                            onClick={async () => {
                              const newValue = isSelected ? '' : option;
                              await handleInlineFieldSave('post_viewing_seller_contact', newValue);
                            }}
                            sx={{ flex: 1, py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1, fontSize: '0.75rem' }}
                          >
                            {option}
                          </Button>
                        );
                      })}
                    </Box>
                  </Box>
                </Box>
              );
            })()}"""

text = text.replace(old_block, new_block)

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('変更1: SYNC_FIELDS に post_viewing_seller_contact を追加')
print('変更2: 内覧後売主連絡の表示条件とUIを更新')
