# -*- coding: utf-8 -*-
"""
動的バリデーション用の useEffect を追加するスクリプト
"""

# ファイルをUTF-8で読み込む
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 挿入位置を探す（既存のuseEffectの直後）
insert_marker = '''  useEffect(() => {
    if (buyer_number && isValidBuyerNumber) {
      fetchBuyer();
      fetchLinkedProperties();
      fetchInquiryHistory();
      fetchInquiryHistoryTable();
      fetchRelatedBuyersCount();
      fetchActivities();
    }
  }, [buyer_number, isValidBuyerNumber]);'''

if insert_marker not in text:
    print('Error: 挿入位置が見つかりません')
    exit(1)

# 動的バリデーション用のuseEffectを定義
dynamic_validation_useeffect = '''

  // Pinrich の動的バリデーション
  useEffect(() => {
    if (buyer) {
      checkMissingFields();
    }
  }, [buyer?.email, buyer?.broker_inquiry, buyer?.pinrich]);'''

# 挿入位置の直後に追加
text = text.replace(insert_marker, insert_marker + dynamic_validation_useeffect)

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 動的バリデーション用の useEffect を追加しました')
