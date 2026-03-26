#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerDesiredConditionsPage.tsx に配信メール「要」時の保存バリデーションを追加する。
エリア・予算・種別のいずれかが空の場合、保存をブロックしてエラーメッセージを表示する。
"""

with open('frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. handleInlineFieldSave に配信メール「要」バリデーションを追加
old_save = """  const handleInlineFieldSave = async (fieldName: string, newValue: any) => {
    if (!buyer) return;

    try {
      const result = await buyerApi.update("""

new_save = """  // 配信メール「要」時の希望条件必須チェック
  const checkDistributionRequiredFields = (fieldName: string, newValue: any): string | null => {
    if (!buyer) return null;

    // 保存後の値を仮想的に計算
    const updatedBuyer = { ...buyer, [fieldName]: newValue };

    // 配信メールが「要」かどうか確認
    const distributionType = String(updatedBuyer.distribution_type || '').trim();
    if (distributionType !== '要') return null;

    // エリア・予算・種別の未入力チェック
    const desiredArea = String(updatedBuyer.desired_area || '').trim();
    const budget = String(updatedBuyer.budget || '').trim();
    const desiredPropertyType = String(updatedBuyer.desired_property_type || '').trim();

    const missing: string[] = [];
    if (!desiredArea) missing.push('エリア');
    if (!budget) missing.push('予算');
    if (!desiredPropertyType) missing.push('希望種別');

    if (missing.length > 0) {
      return `配信メールが「要」の場合、${missing.join('・')}は必須です。希望条件を入力してください。`;
    }
    return null;
  };

  const handleInlineFieldSave = async (fieldName: string, newValue: any) => {
    if (!buyer) return;

    // 配信メール「要」時の必須チェック
    const validationError = checkDistributionRequiredFields(fieldName, newValue);
    if (validationError) {
      setSnackbar({
        open: true,
        message: validationError,
        severity: 'error',
      });
      return { success: false, error: validationError };
    }

    try {
      const result = await buyerApi.update("""

text = text.replace(old_save, new_save, 1)

# 2. エリア（multiselect）の onClose 保存にもバリデーションを追加
old_area_save = """                      onClose={() => {
                        // ドロップダウンを閉じた時に保存
                        // selectedAreasRef.current を使うことで onChange との順序問題を回避
                        if (pendingAreasRef.current !== null) {
                          const valueToSave = selectedAreasRef.current.join('|');
                          pendingAreasRef.current = null;
                          handleInlineFieldSave(field.key, valueToSave);
                        }
                      }}"""

new_area_save = """                      onClose={() => {
                        // ドロップダウンを閉じた時に保存
                        // selectedAreasRef.current を使うことで onChange との順序問題を回避
                        if (pendingAreasRef.current !== null) {
                          const valueToSave = selectedAreasRef.current.join('|');
                          pendingAreasRef.current = null;
                          handleInlineFieldSave(field.key, valueToSave);
                        }
                      }}"""

# エリアのチップ削除時の保存にもバリデーションが自動適用される（handleInlineFieldSave 経由）

# 3. 配信メール「要」の場合、必須フィールドにラベルを強調表示する
# ★エリア・予算・希望種別のラベルに警告を追加
old_field_label = """                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {field.label}
                </Typography>"""

new_field_label = """                <Typography
                  variant="caption"
                  color={
                    buyer.distribution_type === '要' &&
                    ['desired_area', 'budget', 'desired_property_type'].includes(field.key) &&
                    !buyer[field.key]
                      ? 'error'
                      : 'text.secondary'
                  }
                  sx={{ display: 'block', mb: 0.5, fontWeight:
                    buyer.distribution_type === '要' &&
                    ['desired_area', 'budget', 'desired_property_type'].includes(field.key) &&
                    !buyer[field.key]
                      ? 'bold'
                      : 'normal'
                  }}
                >
                  {field.label}
                  {buyer.distribution_type === '要' &&
                   ['desired_area', 'budget', 'desired_property_type'].includes(field.key) &&
                   !buyer[field.key] && ' ※必須'}
                </Typography>"""

text = text.replace(old_field_label, new_field_label, 1)

# 4. 配信メール「要」かつ必須項目未入力の場合、ページ上部に警告バナーを表示
old_paper = """      {/* 希望条件フィールド */}
      <Paper sx={{ 
        p: 3,
        borderTop: `4px solid ${SECTION_COLORS.buyer.main}`,
      }}>"""

new_paper = """      {/* 配信メール「要」時の必須項目警告バナー */}
      {buyer.distribution_type === '要' && (
        (() => {
          const missingItems: string[] = [];
          if (!buyer.desired_area) missingItems.push('エリア');
          if (!buyer.budget) missingItems.push('予算');
          if (!buyer.desired_property_type) missingItems.push('希望種別');
          return missingItems.length > 0 ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              <strong>配信メールが「要」に設定されています。</strong>
              以下の必須項目を入力してください：{missingItems.join('・')}
            </Alert>
          ) : null;
        })()
      )}

      {/* 希望条件フィールド */}
      <Paper sx={{ 
        p: 3,
        borderTop: `4px solid ${SECTION_COLORS.buyer.main}`,
      }}>"""

text = text.replace(old_paper, new_paper, 1)

with open('frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! BuyerDesiredConditionsPage.tsx updated.')
