#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
値下げメールの本文に価格変更テキストを自動生成する変更を適用するスクリプト
"""

import re

# ============================================================
# 1. gmailDistributionTemplates.ts の修正
# ============================================================
templates_path = 'frontend/frontend/src/utils/gmailDistributionTemplates.ts'

with open(templates_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 「現状の価格→変更後の価格」を {priceChangeText} に変更
old_body = '''    body: `お世話になっております。

{address}の物件価格が変更となりました。

現状の価格→変更後の価格

詳細：{publicUrl}

詳細はお問い合わせください。

よろしくお願いいたします。`,
    placeholders: ['address', 'propertyNumber', 'publicUrl']'''

new_body = '''    body: `お世話になっております。

{address}の物件価格が変更となりました。

{priceChangeText}

詳細：{publicUrl}

詳細はお問い合わせください。

よろしくお願いいたします。`,
    placeholders: ['address', 'propertyNumber', 'publicUrl', 'priceChangeText']'''

if old_body in text:
    text = text.replace(old_body, new_body)
    print('✅ gmailDistributionTemplates.ts: priceChangeText プレースホルダーを追加しました')
else:
    print('❌ gmailDistributionTemplates.ts: 対象テキストが見つかりませんでした')
    print('--- 現在のファイル内容 ---')
    print(text[:2000])

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
old_interface = '''interface GmailDistributionButtonProps {
  propertyNumber: string;
  propertyAddress?: string;
  publicUrl?: string;
  distributionAreas?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'text' | 'outlined' | 'contained';
}'''

new_interface = '''interface GmailDistributionButtonProps {
  propertyNumber: string;
  propertyAddress?: string;
  publicUrl?: string;
  distributionAreas?: string;
  salesPrice?: number;
  previousSalesPrice?: number;
  size?: 'small' | 'medium' | 'large';
  variant?: 'text' | 'outlined' | 'contained';
}'''

if old_interface in text:
    text = text.replace(old_interface, new_interface)
    print('✅ GmailDistributionButton.tsx: props インターフェースを更新しました')
else:
    print('❌ GmailDistributionButton.tsx: インターフェースが見つかりませんでした')

# デストラクチャリングに salesPrice と previousSalesPrice を追加
old_destructure = '''export default function GmailDistributionButton({
  propertyNumber,
  propertyAddress,
  publicUrl,
  distributionAreas,
  size = 'small',
  variant = 'outlined'
}: GmailDistributionButtonProps) {'''

new_destructure = '''export default function GmailDistributionButton({
  propertyNumber,
  propertyAddress,
  publicUrl,
  distributionAreas,
  salesPrice,
  previousSalesPrice,
  size = 'small',
  variant = 'outlined'
}: GmailDistributionButtonProps) {'''

if old_destructure in text:
    text = text.replace(old_destructure, new_destructure)
    print('✅ GmailDistributionButton.tsx: デストラクチャリングを更新しました')
else:
    print('❌ GmailDistributionButton.tsx: デストラクチャリングが見つかりませんでした')

# 価格変更テキスト生成ヘルパー関数を追加（handleButtonClick の前に）
old_handle_button = '''  const handleButtonClick = () => {'''

new_handle_button = '''  // 価格変更テキストを生成
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

  const handleButtonClick = () => {'''

if old_handle_button in text:
    text = text.replace(old_handle_button, new_handle_button)
    print('✅ GmailDistributionButton.tsx: generatePriceChangeText 関数を追加しました')
else:
    print('❌ GmailDistributionButton.tsx: handleButtonClick が見つかりませんでした')

# handleConfirmationConfirm の propertyData に priceChangeText を追加
old_property_data = '''      // 物件データを準備してテンプレートを置換
      const propertyData = {
        address: propertyAddress || '',
        propertyNumber: propertyNumber,
        publicUrl: publicUrl || ''
      };

      // テンプレートのプレースホルダーを置換
      const subject = selectedTemplate.subject
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)
        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl);
      
      const body = selectedTemplate.body
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)
        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl);

      // バックエンドAPIを使用してメール送信'''

new_property_data = '''      // 物件データを準備してテンプレートを置換
      const propertyData = {
        address: propertyAddress || '',
        propertyNumber: propertyNumber,
        publicUrl: publicUrl || '',
        priceChangeText: generatePriceChangeText()
      };

      // テンプレートのプレースホルダーを置換
      const subject = selectedTemplate.subject
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)
        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl);
      
      const body = selectedTemplate.body
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)
        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl)
        .replace(/\\{priceChangeText\\}/g, propertyData.priceChangeText);

      // バックエンドAPIを使用してメール送信'''

if old_property_data in text:
    text = text.replace(old_property_data, new_property_data)
    print('✅ GmailDistributionButton.tsx: handleConfirmationConfirm の置換処理を更新しました')
else:
    print('❌ GmailDistributionButton.tsx: handleConfirmationConfirm の propertyData が見つかりませんでした')

# fallbackToGmailWebUI の propertyData にも priceChangeText を追加
old_fallback_data = '''      // 物件データを準備してテンプレートを置換
      const propertyData = {
        address: propertyAddress || '',
        propertyNumber: propertyNumber,
        publicUrl: publicUrl || ''
      };

      // テンプレートのプレースホルダーを置換
      const subject = selectedTemplate.subject
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)
        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl);
      
      const body = selectedTemplate.body
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)
        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl);

      // Gmail Compose URLを生成'''

new_fallback_data = '''      // 物件データを準備してテンプレートを置換
      const propertyData = {
        address: propertyAddress || '',
        propertyNumber: propertyNumber,
        publicUrl: publicUrl || '',
        priceChangeText: generatePriceChangeText()
      };

      // テンプレートのプレースホルダーを置換
      const subject = selectedTemplate.subject
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)
        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl);
      
      const body = selectedTemplate.body
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)
        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl)
        .replace(/\\{priceChangeText\\}/g, propertyData.priceChangeText);

      // Gmail Compose URLを生成'''

if old_fallback_data in text:
    text = text.replace(old_fallback_data, new_fallback_data)
    print('✅ GmailDistributionButton.tsx: fallbackToGmailWebUI の置換処理を更新しました')
else:
    print('❌ GmailDistributionButton.tsx: fallbackToGmailWebUI の propertyData が見つかりませんでした')

# bodyPreview にも priceChangeText を追加
old_body_preview = '''        bodyPreview={selectedTemplate ? selectedTemplate.body
          .replace(/\\{address\\}/g, propertyAddress || '')
          .replace(/\\{propertyNumber\\}/g, propertyNumber)
          .replace(/\\{publicUrl\\}/g, publicUrl || '') : ''}'''

new_body_preview = '''        bodyPreview={selectedTemplate ? selectedTemplate.body
          .replace(/\\{address\\}/g, propertyAddress || '')
          .replace(/\\{propertyNumber\\}/g, propertyNumber)
          .replace(/\\{publicUrl\\}/g, publicUrl || '')
          .replace(/\\{priceChangeText\\}/g, generatePriceChangeText()) : ''}'''

if old_body_preview in text:
    text = text.replace(old_body_preview, new_body_preview)
    print('✅ GmailDistributionButton.tsx: bodyPreview の置換処理を更新しました')
else:
    print('❌ GmailDistributionButton.tsx: bodyPreview が見つかりませんでした')

with open(button_path, 'wb') as f:
    f.write(text.encode('utf-8'))

# ============================================================
# 3. PropertyListingDetailPage.tsx の修正
# ============================================================
page_path = 'frontend/frontend/src/pages/PropertyListingDetailPage.tsx'

with open(page_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# GmailDistributionButton に salesPrice と previousSalesPrice を追加
old_gmail_button = '''          <GmailDistributionButton
            propertyNumber={data.property_number}
            propertyAddress={data.address || data.display_address}
            publicUrl={`https://property-site-frontend-kappa.vercel.app/public/properties/${data.property_number}`}
            distributionAreas={editedData.distribution_areas !== undefined ? editedData.distribution_areas : data.distribution_areas}
            size="medium"
            variant="contained"
          />'''

new_gmail_button = '''          <GmailDistributionButton
            propertyNumber={data.property_number}
            propertyAddress={data.address || data.display_address}
            publicUrl={`https://property-site-frontend-kappa.vercel.app/public/properties/${data.property_number}`}
            distributionAreas={editedData.distribution_areas !== undefined ? editedData.distribution_areas : data.distribution_areas}
            salesPrice={editedData.sales_price !== undefined ? editedData.sales_price : data.sales_price}
            previousSalesPrice={data.sales_price}
            size="medium"
            variant="contained"
          />'''

if old_gmail_button in text:
    text = text.replace(old_gmail_button, new_gmail_button)
    print('✅ PropertyListingDetailPage.tsx: GmailDistributionButton に価格情報を追加しました')
else:
    print('❌ PropertyListingDetailPage.tsx: GmailDistributionButton が見つかりませんでした')

with open(page_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n✅ 全ての変更が完了しました')
