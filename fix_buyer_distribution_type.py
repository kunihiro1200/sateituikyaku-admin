# BuyerDetailPage.tsx の修正スクリプト
# 1. DISTRIBUTION_TYPE_OPTIONS をインポートに追加
# 2. BUYER_FIELD_SECTIONS の latest_status の直後に distribution_type を追加
# 3. distribution_type のレンダリング（必須・ドロップダウン）を追加

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# --- 変更1: DISTRIBUTION_TYPE_OPTIONS をインポートに追加 ---
old_import = """import { 
  INQUIRY_EMAIL_PHONE_OPTIONS, 
  THREE_CALLS_CONFIRMED_OPTIONS, 
} from '../utils/buyerFieldOptions';"""

new_import = """import { 
  INQUIRY_EMAIL_PHONE_OPTIONS, 
  THREE_CALLS_CONFIRMED_OPTIONS,
  DISTRIBUTION_TYPE_OPTIONS,
} from '../utils/buyerFieldOptions';"""

if old_import in text:
    text = text.replace(old_import, new_import)
    print('変更1: DISTRIBUTION_TYPE_OPTIONS インポート追加完了')
else:
    print('エラー: 変更1のターゲットが見つかりません')

# --- 変更2: BUYER_FIELD_SECTIONS の latest_status の直後に distribution_type を追加 ---
old_section = """      { key: 'latest_status', label: '★最新状況', inlineEditable: true },
      { key: 'inquiry_email_phone', label: '【問合メール】電話対応', inlineEditable: true, fieldType: 'dropdown' },"""

new_section = """      { key: 'latest_status', label: '★最新状況', inlineEditable: true },
      { key: 'distribution_type', label: '配信メール', inlineEditable: true, fieldType: 'dropdown', required: true },
      { key: 'inquiry_email_phone', label: '【問合メール】電話対応', inlineEditable: true, fieldType: 'dropdown' },"""

if old_section in text:
    text = text.replace(old_section, new_section)
    print('変更2: distribution_type フィールド追加完了')
else:
    print('エラー: 変更2のターゲットが見つかりません')

# --- 変更3: 必須フィールドの missingRequiredFields に distribution_type を追加 ---
# getMissingRequiredFields 関数内
old_missing_check = """    if (!buyer.latest_status || !String(buyer.latest_status).trim()) {
      missing.push('latest_status');
    }"""

new_missing_check = """    if (!buyer.latest_status || !String(buyer.latest_status).trim()) {
      missing.push('latest_status');
    }
    if (!buyer.distribution_type || !String(buyer.distribution_type).trim()) {
      missing.push('distribution_type');
    }"""

if old_missing_check in text:
    text = text.replace(old_missing_check, new_missing_check, 1)
    print('変更3: distribution_type 必須チェック追加完了')
else:
    print('エラー: 変更3のターゲットが見つかりません')

# --- 変更4: REQUIRED_FIELD_LABELS に distribution_type を追加 ---
old_labels = """        initial_assignee: '初動担当',
        inquiry_source: '問合せ元',
        latest_status: '★最新状況',
        inquiry_email_phone: '【問合メール】電話対応',"""

new_labels = """        initial_assignee: '初動担当',
        inquiry_source: '問合せ元',
        latest_status: '★最新状況',
        distribution_type: '配信メール',
        inquiry_email_phone: '【問合メール】電話対応',"""

if old_labels in text:
    text = text.replace(old_labels, new_labels)
    print('変更4: REQUIRED_FIELD_LABELS に distribution_type 追加完了')
else:
    print('エラー: 変更4のターゲットが見つかりません')

# --- 変更5: 初期ロード時の必須チェックに distribution_type を追加 ---
old_initial_check = """      if (!res.data.latest_status || !String(res.data.latest_status).trim()) {
        initialMissing.push('latest_status');
      }"""

new_initial_check = """      if (!res.data.latest_status || !String(res.data.latest_status).trim()) {
        initialMissing.push('latest_status');
      }
      if (!res.data.distribution_type || !String(res.data.distribution_type).trim()) {
        initialMissing.push('distribution_type');
      }"""

if old_initial_check in text:
    text = text.replace(old_initial_check, new_initial_check, 1)
    print('変更5: 初期ロード時の distribution_type 必須チェック追加完了')
else:
    print('エラー: 変更5のターゲットが見つかりません')

# --- 変更6: distribution_type のレンダリングを latest_status の直後に追加 ---
# latest_statusのレンダリングブロックの後に distribution_type のブロックを挿入
old_after_latest = """                    // vendor_surveyフィールドは特別処理（値が入っている場合は常時表示、「未」のときはオレンジ強調）"""

new_after_latest = """                    // distribution_typeフィールドは特別処理（必須・ドロップダウン）
                    if (field.key === 'distribution_type') {
                      const handleDistributionSave = async (newValue: any) => {
                        setBuyer((prev: any) => prev ? { ...prev, distribution_type: newValue } : prev);
                        handleFieldChange(section.title, field.key, newValue);
                        setMissingRequiredFields(prev => {
                          const next = new Set(prev);
                          if (newValue && String(newValue).trim()) next.delete('distribution_type');
                          else next.add('distribution_type');
                          return next;
                        });
                      };
                      const isDistributionMissing = missingRequiredFields.has('distribution_type');
                      return (
                        <Grid item {...gridSize} key={`${section.title}-${field.key}`}>
                          {isDistributionMissing && (
                            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>
                              ⚠ 配信メール（必須）
                            </Typography>
                          )}
                          <InlineEditableField
                            key={`distribution_type-${isDistributionMissing}`}
                            label={isDistributionMissing ? '' : field.label}
                            value={buyer[field.key] || ''}
                            fieldName={field.key}
                            fieldType="dropdown"
                            options={DISTRIBUTION_TYPE_OPTIONS}
                            buyerNumber={buyer.buyer_number}
                            onSave={handleDistributionSave}
                            onChange={(fieldName, newValue) => {
                              setBuyer((prev: any) => prev ? { ...prev, [fieldName]: newValue } : prev);
                              if (newValue && String(newValue).trim()) {
                                setMissingRequiredFields(prev => {
                                  const next = new Set(prev);
                                  next.delete('distribution_type');
                                  return next;
                                });
                              }
                            }}
                          />
                        </Grid>
                      );
                    }

                    // vendor_surveyフィールドは特別処理（値が入っている場合は常時表示、「未」のときはオレンジ強調）"""

if old_after_latest in text:
    text = text.replace(old_after_latest, new_after_latest)
    print('変更6: distribution_type レンダリング追加完了')
else:
    print('エラー: 変更6のターゲットが見つかりません')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了: BuyerDetailPage.tsx を更新しました')
