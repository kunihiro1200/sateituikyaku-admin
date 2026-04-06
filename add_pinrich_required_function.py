# -*- coding: utf-8 -*-
"""
BuyerDetailPage.tsx に isPinrichRequired 関数を追加するスクリプト
"""

# ファイルをUTF-8で読み込む
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 挿入位置を探す（isHomeHearingResultRequired 関数の直前）
insert_marker = '  // owned_home_hearing_result が必須かどうかを判定するヘルパー'

if insert_marker not in text:
    print('Error: 挿入位置が見つかりません')
    exit(1)

# isPinrichRequired 関数を定義
is_pinrich_required_function = '''  // Pinrich が必須かどうかを判定するヘルパー
  // AND(ISNOTBLANK([メールアドレス]), ISBLANK([業者問合せ]))
  const isPinrichRequired = (data: any): boolean => {
    if (!data) return false;
    
    // 条件1: メールアドレスが空白でないこと
    if (!data.email) return false;
    const emailTrimmed = String(data.email).trim();
    if (emailTrimmed.length === 0) return false;

    // 条件2: 業者問合せが空白であること
    if (data.broker_inquiry) {
      const brokerTrimmed = String(data.broker_inquiry).trim();
      if (brokerTrimmed.length > 0) return false;
    }

    return true;
  };

'''

# 挿入位置の直前に関数を追加
text = text.replace(insert_marker, is_pinrich_required_function + insert_marker)

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ isPinrichRequired 関数を追加しました')
