#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
値下げメールの本文に価格変更テキストを自動生成する変更を適用するスクリプト（修正版）
"""

# ============================================================
# 1. gmailDistributionTemplates.ts の修正
# ============================================================
templates_path = 'frontend/frontend/src/utils/gmailDistributionTemplates.ts'

with open(templates_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 「現状の価格→変更後の価格」を {priceChangeText} に変更
text = text.replace(
    '現状の価格→変更後の価格',
    '{priceChangeText}'
)

# placeholders に priceChangeText を追加
text = text.replace(
    "placeholders: ['address', 'propertyNumber', 'publicUrl']",
    "placeholders: ['address', 'propertyNumber', 'publicUrl', 'priceChangeText']"
)

print('✅ gmailDistributionTemplates.ts を更新しました')

with open(templates_path, 'wb') as f:
    f.write(text.encode('utf-8'))

# ============================================================
# 2. GmailDistributionButton.tsx の修正
# ============================================================
button_path = 'frontend/frontend/src/components/GmailDistributionButton.tsx'

with open(button_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# props インターフェースに salesPrice と previousSalesPrice を追加
text = text.replace(
    "  distributionAreas?: string;\n  size?: 'small' | 'medium' | 'large';",
    "  distributionAreas?: string;\n  salesPrice?: number;\n  previousSalesPrice?: number;\n  size?: 'small' | 'medium' | 'large';"
)

# デストラクチャリングに salesPrice と previousSalesPrice を追加
text = text.replace(
    "  distributionAreas,\n  size = 'small',",
    "  distributionAreas,\n  salesPrice,\n  previousSalesPrice,\n  size = 'small',"
)

# generatePriceChangeText 関数を handleButtonClick の前に追加
text = text.replace(
    "  const handleButtonClick = () => {",
    """  // 価格変更テキストを生成
  const generatePriceChangeText = (): string => {
    if (previousSalesPrice && salesPrice && previousSalesPrice !== salesPrice) {
      const oldMan = Math.floor(previousSalesPrice / 10000);
      const newMan = Math.floor(salesPrice / 10000);
      const diffMan = oldMan - newMan;
      if (diffMan > 0) {
        return `${oldMan}万円から${newMan}万円に${diffMan}万円値下げしました！問合せが増えることが予想されますので、ご興味のある方はお早めにご連絡ください！`;
      }
    }
    return '現状の価格→変更後の価格';
  };

  const handleButtonClick = () => {"""
)

# handleConfirmationConfirm の body 置換に priceChangeText を追加
# 「バックエンドAPIを使用してメール送信」の直前の body 置換を更新
old_confirm_body = """      const body = selectedTemplate.body
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)
        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl);

      // バックエンドAPIを使用してメール送信"""

new_confirm_body = """      const body = selectedTemplate.body
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)
        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl)
        .replace(/\\{priceChangeText\\}/g, generatePriceChangeText());

      // バックエンドAPIを使用してメール送信"""

if old_confirm_body in text:
    text = text.replace(old_confirm_body, new_confirm_body)
    print('✅ GmailDistributionButton.tsx: handleConfirmationConfirm の body 置換を更新しました')
else:
    print('❌ handleConfirmationConfirm の body が見つかりませんでした')

# fallbackToGmailWebUI の body 置換に priceChangeText を追加
old_fallback_body = """      const body = selectedTemplate.body
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)
        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl);

      // Gmail Compose URLを生成"""

new_fallback_body = """      const body = selectedTemplate.body
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)
        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl)
        .replace(/\\{priceChangeText\\}/g, generatePriceChangeText());

      // Gmail Compose URLを生成"""

if old_fallback_body in text:
    text = text.replace(old_fallback_body, new_fallback_body)
    print('✅ GmailDistributionButton.tsx: fallbackToGmailWebUI の body 置換を更新しました')
else:
    print('❌ fallbackToGmailWebUI の body が見つかりませんでした')

# bodyPreview にも priceChangeText を追加
old_preview = """          .replace(/\\{publicUrl\\}/g, publicUrl || '') : ''}"""
new_preview = """          .replace(/\\{publicUrl\\}/g, publicUrl || '')
          .replace(/\\{priceChangeText\\}/g, generatePriceChangeText()) : ''}"""

if old_preview in text:
    text = text.replace(old_preview, new_preview)
    print('✅ GmailDistributionButton.tsx: bodyPreview を更新しました')
else:
    print('❌ bodyPreview が見つかりませんでした')

print('✅ GmailDistributionButton.tsx を更新しました')

with open(button_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n✅ 全ての変更が完了しました')
