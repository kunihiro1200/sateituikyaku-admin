#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
値下げメールテンプレートの本文変更 + GmailDistributionButtonにpublicUrl追加
"""
import re

# 1. gmailDistributionTemplates.ts の値下げテンプレート本文を変更
print("=== 1. gmailDistributionTemplates.ts を更新 ===")
with open('frontend/src/utils/gmailDistributionTemplates.ts', 'rb') as f:
    content = f.read().decode('utf-8')

old_price_reduction = """{
    id: 'price-reduction',
    name: '値下げメール配信',
    subject: '【価格変更】{address}',
    body: `お世話になっております。

{address}の物件価格が変更となりました。

物件番号: {propertyNumber}

詳細はお問い合わせください。

よろしくお願いいたします。`,
    placeholders: ['address', 'propertyNumber']
  },"""

new_price_reduction = """{
    id: 'price-reduction',
    name: '値下げメール配信',
    subject: '【価格変更】{address}',
    body: `お世話になっております。

{address}の物件価格が変更となりました。

現状の価格→変更後の価格

詳細：{publicUrl}

詳細はお問い合わせください。

よろしくお願いいたします。`,
    placeholders: ['address', 'propertyNumber', 'publicUrl']
  },"""

if old_price_reduction in content:
    content = content.replace(old_price_reduction, new_price_reduction)
    print("✅ 値下げテンプレート本文を更新しました")
else:
    print("❌ 値下げテンプレートが見つかりません")
    print("--- 現在の内容 ---")
    idx = content.find("price-reduction")
    if idx >= 0:
        print(content[idx:idx+400])

with open('frontend/src/utils/gmailDistributionTemplates.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

# 2. GmailDistributionButton.tsx に publicUrl props を追加
print("\n=== 2. GmailDistributionButton.tsx を更新 ===")
with open('frontend/src/components/GmailDistributionButton.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# interface に publicUrl を追加
old_interface = """interface GmailDistributionButtonProps {
  propertyNumber: string;
  propertyAddress?: string;
  distributionAreas?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'text' | 'outlined' | 'contained';
}"""

new_interface = """interface GmailDistributionButtonProps {
  propertyNumber: string;
  propertyAddress?: string;
  publicUrl?: string;
  distributionAreas?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'text' | 'outlined' | 'contained';
}"""

if old_interface in content:
    content = content.replace(old_interface, new_interface)
    print("✅ interface に publicUrl を追加しました")
else:
    print("❌ interface が見つかりません")

# 分割代入に publicUrl を追加
old_destructure = """export default function GmailDistributionButton({
  propertyNumber,
  propertyAddress,
  distributionAreas,
  size = 'small',
  variant = 'outlined'
}: GmailDistributionButtonProps) {"""

new_destructure = """export default function GmailDistributionButton({
  propertyNumber,
  propertyAddress,
  publicUrl,
  distributionAreas,
  size = 'small',
  variant = 'outlined'
}: GmailDistributionButtonProps) {"""

if old_destructure in content:
    content = content.replace(old_destructure, new_destructure)
    print("✅ 分割代入に publicUrl を追加しました")
else:
    print("❌ 分割代入が見つかりません")

# propertyData に publicUrl を追加（handleConfirmationConfirm 内）
old_property_data = """      // 物件データを準備してテンプレートを置換
      const propertyData = {
        address: propertyAddress || '',
        propertyNumber: propertyNumber
      };

      // テンプレートのプレースホルダーを置換
      const subject = selectedTemplate.subject
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber);
      
      const body = selectedTemplate.body
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber);

      // バックエンドAPIを使用してメール送信"""

new_property_data = """      // 物件データを準備してテンプレートを置換
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

      // バックエンドAPIを使用してメール送信"""

if old_property_data in content:
    content = content.replace(old_property_data, new_property_data)
    print("✅ handleConfirmationConfirm の propertyData に publicUrl を追加しました")
else:
    print("❌ handleConfirmationConfirm の propertyData が見つかりません")

# fallbackToGmailWebUI 内の propertyData にも publicUrl を追加
old_fallback_data = """      // 物件データを準備してテンプレートを置換
      const propertyData = {
        address: propertyAddress || '',
        propertyNumber: propertyNumber
      };

      // テンプレートのプレースホルダーを置換
      const subject = selectedTemplate.subject
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber);
      
      const body = selectedTemplate.body
        .replace(/\\{address\\}/g, propertyData.address)
        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber);

      // Gmail Compose URLを生成"""

new_fallback_data = """      // 物件データを準備してテンプレートを置換
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

      // Gmail Compose URLを生成"""

if old_fallback_data in content:
    content = content.replace(old_fallback_data, new_fallback_data)
    print("✅ fallbackToGmailWebUI の propertyData に publicUrl を追加しました")
else:
    print("❌ fallbackToGmailWebUI の propertyData が見つかりません")

# DistributionConfirmationModal の bodyPreview にも publicUrl を追加
old_body_preview = """        bodyPreview={selectedTemplate ? selectedTemplate.body
          .replace(/\\{address\\}/g, propertyAddress || '')
          .replace(/\\{propertyNumber\\}/g, propertyNumber) : ''}"""

new_body_preview = """        bodyPreview={selectedTemplate ? selectedTemplate.body
          .replace(/\\{address\\}/g, propertyAddress || '')
          .replace(/\\{propertyNumber\\}/g, propertyNumber)
          .replace(/\\{publicUrl\\}/g, publicUrl || '') : ''}"""

if old_body_preview in content:
    content = content.replace(old_body_preview, new_body_preview)
    print("✅ DistributionConfirmationModal の bodyPreview に publicUrl を追加しました")
else:
    print("❌ DistributionConfirmationModal の bodyPreview が見つかりません")

with open('frontend/src/components/GmailDistributionButton.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

# 3. PropertyListingDetailPage.tsx に publicUrl を渡す
print("\n=== 3. PropertyListingDetailPage.tsx を更新 ===")
with open('frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

old_gmail_button = """          <GmailDistributionButton
            propertyNumber={data.property_number}
            propertyAddress={data.address || data.display_address}
            distributionAreas={editedData.distribution_areas !== undefined ? editedData.distribution_areas : data.distribution_areas}
            size="medium"
            variant="contained"
          />"""

new_gmail_button = """          <GmailDistributionButton
            propertyNumber={data.property_number}
            propertyAddress={data.address || data.display_address}
            publicUrl={`https://property-site-frontend-kappa.vercel.app/public/properties/${data.property_number}`}
            distributionAreas={editedData.distribution_areas !== undefined ? editedData.distribution_areas : data.distribution_areas}
            size="medium"
            variant="contained"
          />"""

if old_gmail_button in content:
    content = content.replace(old_gmail_button, new_gmail_button)
    print("✅ GmailDistributionButton に publicUrl を追加しました")
else:
    print("❌ GmailDistributionButton の呼び出し箇所が見つかりません")

with open('frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print("\n=== 完了 ===")
