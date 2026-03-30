with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 受付日条件を外す：問合時持家ヒアリングに値がある場合のみ必須
old = """  // owned_home_hearing_result が必須かどうかを判定するヘルパー
  // AND([受付日]>="2026/3/30", ISNOTBLANK([問合時持家ヒアリング]))
  const isHomeHearingResultRequired = (data: any): boolean => {
    if (!data.reception_date) return false;
    if (new Date(data.reception_date) < new Date('2026-03-30')) return false;
    return !!(data.owned_home_hearing_inquiry && String(data.owned_home_hearing_inquiry).trim());
  };"""

new = """  // owned_home_hearing_result が必須かどうかを判定するヘルパー
  // ISNOTBLANK([問合時持家ヒアリング]) のみ（受付日条件なし）
  const isHomeHearingResultRequired = (data: any): boolean => {
    return !!(data.owned_home_hearing_inquiry && String(data.owned_home_hearing_inquiry).trim());
  };"""

if old in text:
    text = text.replace(old, new)
    print('✅ isHomeHearingResultRequired を修正しました')
else:
    print('❌ 対象箇所が見つかりませんでした')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
