#!/usr/bin/env python3
# 2点の修正:
# 1. 次電日（date型）空文字送信時のエラー修正 → null に変換
# 2. 業者問合せをチップ選択UIに変更

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# ===== 1. handleInlineFieldSave で date フィールドの空文字を null に変換 =====
old_save = """  // インライン編集用のフィールド更新ハンドラー
  const handleInlineFieldSave = async (fieldName: string, newValue: any) => {
    if (!buyer) return;

    try {
      // 更新するフィールドのみを送信（双方向同期を有効化）
      const result = await buyerApi.update(
        buyer_number!,
        { [fieldName]: newValue },
        { sync: true }  // スプレッドシートへの同期を有効化
      );"""

new_save = """  // インライン編集用のフィールド更新ハンドラー
  const handleInlineFieldSave = async (fieldName: string, newValue: any) => {
    if (!buyer) return;

    try {
      // 日付フィールドの空文字は null に変換（timestamp エラー防止）
      const DATE_FIELDS = ['next_call_date', 'reception_date', 'visit_date', 'contract_date'];
      const sanitizedValue = DATE_FIELDS.includes(fieldName) && newValue === '' ? null : newValue;

      // 更新するフィールドのみを送信（双方向同期を有効化）
      const result = await buyerApi.update(
        buyer_number!,
        { [fieldName]: sanitizedValue },
        { sync: true }  // スプレッドシートへの同期を有効化
      );"""

if old_save in text:
    text = text.replace(old_save, new_save)
    print('OK: 日付空文字→null変換を追加')
else:
    print('NG: handleInlineFieldSave パターンが見つかりません')

# ===== 2. broker_inquiry をチップ選択UIに変更 =====
# 選択肢: 業者問合せ / 個人
old_broker = """                    // broker_inquiryフィールドは特別処理（条件付きドロップダウン）
                    if (field.key === 'broker_inquiry') {
                      // company_name が空の場合は非表示
                      if (!buyer.company_name || !buyer.company_name.trim()) {
                        return null;
                      }
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
                            fieldType="text"
                            onSave={handleFieldSave}
                            onChange={(fieldName, newValue) => handleFieldChange(section.title, fieldName, newValue)}
                            buyerId={buyer_number}
                            enableConflictDetection={true}
                            showEditIndicator={true}
                          />
                        </Grid>
                      );
                    }"""

new_broker = """                    // broker_inquiryフィールドは特別処理（チップ選択）
                    if (field.key === 'broker_inquiry') {
                      // company_name が空の場合は非表示
                      if (!buyer.company_name || !buyer.company_name.trim()) {
                        return null;
                      }
                      const BROKER_OPTIONS = ['業者', '個人'];
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            {field.label}
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {BROKER_OPTIONS.map((option) => (
                              <Chip
                                key={option}
                                label={option}
                                size="small"
                                onClick={async () => {
                                  const newValue = buyer.broker_inquiry === option ? '' : option;
                                  handleFieldChange(section.title, field.key, newValue);
                                  await handleInlineFieldSave(field.key, newValue);
                                }}
                                color={buyer.broker_inquiry === option ? 'primary' : 'default'}
                                variant={buyer.broker_inquiry === option ? 'filled' : 'outlined'}
                                sx={{ cursor: 'pointer', fontWeight: buyer.broker_inquiry === option ? 'bold' : 'normal' }}
                              />
                            ))}
                          </Box>
                        </Grid>
                      );
                    }"""

if old_broker in text:
    text = text.replace(old_broker, new_broker)
    print('OK: broker_inquiry をチップ選択UIに変更')
else:
    print('NG: broker_inquiry パターンが見つかりません')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
