#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
値下げメールの2つの問題を修正:
1. PropertyListingDetailPage.tsx: previousSalesPriceをprice_reduction_historyから取得
2. gmailDistributionTemplates.ts: 値下げテンプレートに追記文を追加
"""

import re

# ============================================================
# 1. PropertyListingDetailPage.tsx の修正
# ============================================================
page_path = 'frontend/frontend/src/pages/PropertyListingDetailPage.tsx'

with open(page_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# GmailDistributionButton の previousSalesPrice を修正
# 現在: previousSalesPrice={data.sales_price}
# 修正後: price_reduction_history の最初の行から前の価格を取得するヘルパーを使う

old_gmail_btn = '''          <GmailDistributionButton
            propertyNumber={data.property_number}
            propertyAddress={data.address || data.display_address}
            publicUrl={`https://property-site-frontend-kappa.vercel.app/public/properties/${data.property_number}`}
            distributionAreas={editedData.distribution_areas !== undefined ? editedData.distribution_areas : data.distribution_areas}
            salesPrice={editedData.sales_price !== undefined ? editedData.sales_price : data.sales_price}
            previousSalesPrice={data.sales_price}
            propertyType={editedData.property_type !== undefined ? editedData.property_type : data.property_type}
            size="medium"
            variant="contained"
          />'''

new_gmail_btn = '''          <GmailDistributionButton
            propertyNumber={data.property_number}
            propertyAddress={data.address || data.display_address}
            publicUrl={`https://property-site-frontend-kappa.vercel.app/public/properties/${data.property_number}`}
            distributionAreas={editedData.distribution_areas !== undefined ? editedData.distribution_areas : data.distribution_areas}
            salesPrice={editedData.sales_price !== undefined ? editedData.sales_price : data.sales_price}
            previousSalesPrice={getPreviousPriceFromHistory(data.price_reduction_history)}
            propertyType={editedData.property_type !== undefined ? editedData.property_type : data.property_type}
            size="medium"
            variant="contained"
          />'''

if old_gmail_btn in text:
    text = text.replace(old_gmail_btn, new_gmail_btn)
    print('✅ GmailDistributionButton の previousSalesPrice を修正しました')
else:
    print('❌ GmailDistributionButton の該当箇所が見つかりません')

# getPreviousPriceFromHistory ヘルパー関数を追加
# PropertyListingDetailPage コンポーネント関数の直前に追加
# "export default function PropertyListingDetailPage" の前に挿入

helper_func = '''// 値下げ履歴の最初の行から「前の価格」を取得するヘルパー
// 形式: "K3/17 1380万→1280万" → 13800000 を返す
function getPreviousPriceFromHistory(history: string | null | undefined): number | undefined {
  if (!history) return undefined;
  const lines = history.split('\\n').filter(l => l.trim());
  if (lines.length === 0) return undefined;
  // 最初の行から "1380万→1280万" のパターンを抽出
  const match = lines[0].match(/(\\d+(?:\\.\\d+)?)万→(\\d+(?:\\.\\d+)?)万/);
  if (!match) return undefined;
  const prevMan = parseFloat(match[1]);
  return Math.round(prevMan * 10000);
}

'''

# export default function PropertyListingDetailPage の前に挿入
target = 'export default function PropertyListingDetailPage'
if target in text and 'getPreviousPriceFromHistory' not in text:
    text = text.replace(target, helper_func + target)
    print('✅ getPreviousPriceFromHistory ヘルパー関数を追加しました')
elif 'getPreviousPriceFromHistory' in text:
    print('ℹ️  getPreviousPriceFromHistory は既に存在します')
else:
    print('❌ export default function PropertyListingDetailPage が見つかりません')

with open(page_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'✅ {page_path} を保存しました')

# ============================================================
# 2. gmailDistributionTemplates.ts の修正
# ============================================================
templates_path = 'frontend/frontend/src/utils/gmailDistributionTemplates.ts'

with open(templates_path, 'rb') as f:
    content2 = f.read()

text2 = content2.decode('utf-8')

# 値下げテンプレートの本文を修正
old_body = """`{buyerName}様
お世話になっております。

{address}の物件価格が変更となりました。

{priceChangeText}

詳細：{publicUrl}

詳細はお問い合わせください。

よろしくお願いいたします。

{signature}`"""

new_body = """`{buyerName}様
お世話になっております。

{address}の物件価格が変更となりました。

{priceChangeText}

お問合せが増えることが予想されますので、ご興味のある方はお早めにご連絡ください！

詳細：{publicUrl}

詳細はお問い合わせください。

よろしくお願いいたします。

{signature}`"""

if old_body in text2:
    text2 = text2.replace(old_body, new_body)
    print('✅ 値下げメールテンプレートに追記文を追加しました')
else:
    print('❌ 値下げメールテンプレートの該当箇所が見つかりません')
    # デバッグ用に現在の内容を確認
    idx = text2.find('price-reduction')
    if idx >= 0:
        print(f'  price-reduction テンプレート周辺:\n{text2[idx:idx+400]}')

with open(templates_path, 'wb') as f:
    f.write(text2.encode('utf-8'))

print(f'✅ {templates_path} を保存しました')
print('\n完了！')
