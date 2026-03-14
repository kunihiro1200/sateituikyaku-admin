#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerGmailSendButton に company_name と buyer_number を渡すよう修正する
1. BuyerGmailSendButton.tsx: props追加 + APIリクエストに含める
2. BuyerDetailPage.tsx: company_name と buyer_number を渡す
"""

import re

# ===== 1. BuyerGmailSendButton.tsx =====
with open('frontend/frontend/src/components/BuyerGmailSendButton.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8').replace('\r\n', '\n')

# propsインターフェースに buyerCompanyName と buyerNumber を追加
old_interface = """interface BuyerGmailSendButtonProps {
  buyerId: string;
  buyerEmail: string;
  buyerName: string;"""

new_interface = """interface BuyerGmailSendButtonProps {
  buyerId: string;
  buyerEmail: string;
  buyerName: string;
  buyerCompanyName?: string;
  buyerNumber?: string;"""

text = text.replace(old_interface, new_interface)

# 関数引数に追加
old_args = """export default function BuyerGmailSendButton({
  buyerId,
  buyerEmail,
  buyerName,
  inquiryHistory,
  selectedPropertyIds,
  size = 'medium',
  variant = 'contained'
}: BuyerGmailSendButtonProps) {"""

new_args = """export default function BuyerGmailSendButton({
  buyerId,
  buyerEmail,
  buyerName,
  buyerCompanyName,
  buyerNumber,
  inquiryHistory,
  selectedPropertyIds,
  size = 'medium',
  variant = 'contained'
}: BuyerGmailSendButtonProps) {"""

text = text.replace(old_args, new_args)

# APIリクエストのbuyerオブジェクトに name, company_name, buyer_number を追加
old_buyer_req = """      const response = await api.post(`/api/email-templates/${template.id}/merge-multiple`, {
        buyer: {
          buyerName,
          email: buyerEmail
        },
        propertyIds
      });"""

new_buyer_req = """      const response = await api.post(`/api/email-templates/${template.id}/merge-multiple`, {
        buyer: {
          buyerName,
          name: buyerName,
          company_name: buyerCompanyName || '',
          buyer_number: buyerNumber || '',
          email: buyerEmail
        },
        propertyIds
      });"""

text = text.replace(old_buyer_req, new_buyer_req)

with open('frontend/frontend/src/components/BuyerGmailSendButton.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ BuyerGmailSendButton.tsx を修正しました")

# ===== 2. BuyerDetailPage.tsx =====
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8').replace('\r\n', '\n')

# BuyerGmailSendButton の呼び出しに buyerCompanyName と buyerNumber を追加
old_button = """          <BuyerGmailSendButton
            buyerId={buyer_number || ''}
            buyerEmail={buyer.email || ''}
            buyerName={buyer.name || ''}
            inquiryHistory={inquiryHistoryTable}
            selectedPropertyIds={selectedPropertyIds}
            size="small"
            variant="contained"
          />"""

new_button = """          <BuyerGmailSendButton
            buyerId={buyer_number || ''}
            buyerEmail={buyer.email || ''}
            buyerName={buyer.name || ''}
            buyerCompanyName={buyer.company_name || ''}
            buyerNumber={buyer_number || ''}
            inquiryHistory={inquiryHistoryTable}
            selectedPropertyIds={selectedPropertyIds}
            size="small"
            variant="contained"
          />"""

if old_button in text:
    text = text.replace(old_button, new_button)
    print("✅ BuyerDetailPage.tsx を修正しました")
else:
    print("⚠️ BuyerDetailPage.tsx のパターンが見つかりませんでした")

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ 完了")
