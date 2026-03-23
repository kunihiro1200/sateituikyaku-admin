import re

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# inquiry_email_phoneフィールドの特別処理ブロックを置換
old_block = """                    // inquiry_email_phoneフィールドは特別処理（ドロップダウン）
                    if (field.key === 'inquiry_email_phone') {
                      const handleFieldSave = async (newValue: any) => {
                        const result = await handleInlineFieldSave(field.key, newValue);
                        if (result && !result.success && result.error) {
                          throw new Error(result.error);
                        }
                      };

                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <InlineEditableField
                            label={field.label}
                            value={value || ''}
                            fieldName={field.key}
                            fieldType="dropdown"
                            options={INQUIRY_EMAIL_PHONE_OPTIONS}
                            onSave={handleFieldSave}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                          />
                        </Grid>
                      );
                    }"""

new_block = """                    // inquiry_email_phoneフィールドは特別処理（ボタン選択 + 即時保存）
                    if (field.key === 'inquiry_email_phone') {
                      // 問合せ元に「電話」が含まれる場合は非表示
                      if (buyer.inquiry_source && buyer.inquiry_source.includes('電話')) {
                        return null;
                      }
                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              {['済', '未'].map((opt) => (
                                <Button
                                  key={opt}
                                  size="small"
                                  variant={value === opt ? 'contained' : 'outlined'}
                                  color={opt === '済' ? 'success' : 'error'}
                                  onClick={() => handleInlineFieldSave('inquiry_email_phone', opt)}
                                  sx={{ minWidth: 48 }}
                                >
                                  {opt}
                                </Button>
                              ))}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    }"""

if old_block in text:
    text = text.replace(old_block, new_block)
    print('✅ inquiry_email_phone ブロックを置換しました')
else:
    print('❌ 対象ブロックが見つかりませんでした')
    # デバッグ用：前後の文字列を確認
    idx = text.find('inquiry_email_phoneフィールドは特別処理')
    if idx >= 0:
        print(f'  → 部分一致あり（位置: {idx}）')
        print(repr(text[idx:idx+200]))

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
