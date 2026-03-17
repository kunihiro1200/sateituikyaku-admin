#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""GmailDistributionButton に publicUrl props を追加"""

def fix_file(path, replacements):
    with open(path, 'rb') as f:
        raw = f.read()
    content = raw.decode('utf-8').replace('\r\n', '\n')
    
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            print(f"✅ 更新: {old[:50].strip()!r}...")
        else:
            print(f"❌ 見つからず: {old[:50].strip()!r}...")
    
    with open(path, 'wb') as f:
        f.write(content.replace('\n', '\r\n').encode('utf-8'))

# GmailDistributionButton.tsx
print("=== GmailDistributionButton.tsx ===")
fix_file('frontend/src/components/GmailDistributionButton.tsx', [
    # interface に publicUrl を追加
    (
        """interface GmailDistributionButtonProps {
  propertyNumber: string;
  propertyAddress?: string;
  distributionAreas?: string;""",
        """interface GmailDistributionButtonProps {
  propertyNumber: string;
  propertyAddress?: string;
  publicUrl?: string;
  distributionAreas?: string;"""
    ),
    # 分割代入に publicUrl を追加
    (
        """export default function GmailDistributionButton({
  propertyNumber,
  propertyAddress,
  distributionAreas,""",
        """export default function GmailDistributionButton({
  propertyNumber,
  propertyAddress,
  publicUrl,
  distributionAreas,"""
    ),
    # handleConfirmationConfirm の propertyData
    (
        """      const propertyData = {
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

      // バックエンドAPIを使用してメール送信""",
        """      const propertyData = {
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
    ),
    # fallbackToGmailWebUI の propertyData
    (
        """      const propertyData = {
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

      // Gmail Compose URLを生成""",
        """      const propertyData = {
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
    ),
    # DistributionConfirmationModal の bodyPreview
    (
        """        bodyPreview={selectedTemplate ? selectedTemplate.body
          .replace(/\\{address\\}/g, propertyAddress || '')
          .replace(/\\{propertyNumber\\}/g, propertyNumber) : ''}""",
        """        bodyPreview={selectedTemplate ? selectedTemplate.body
          .replace(/\\{address\\}/g, propertyAddress || '')
          .replace(/\\{propertyNumber\\}/g, propertyNumber)
          .replace(/\\{publicUrl\\}/g, publicUrl || '') : ''}"""
    ),
])

# PropertyListingDetailPage.tsx
print("\n=== PropertyListingDetailPage.tsx ===")
fix_file('frontend/src/pages/PropertyListingDetailPage.tsx', [
    (
        """          <GmailDistributionButton
            propertyNumber={data.property_number}
            propertyAddress={data.address || data.display_address}
            distributionAreas={editedData.distribution_areas !== undefined ? editedData.distribution_areas : data.distribution_areas}""",
        """          <GmailDistributionButton
            propertyNumber={data.property_number}
            propertyAddress={data.address || data.display_address}
            publicUrl={`https://property-site-frontend-kappa.vercel.app/public/properties/${data.property_number}`}
            distributionAreas={editedData.distribution_areas !== undefined ? editedData.distribution_areas : data.distribution_areas}"""
    ),
])

print("\n=== 完了 ===")
