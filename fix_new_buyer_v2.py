# NewBuyerPage.tsx の修正スクリプト
# 1. vendor_survey: 新規登録時は常時表示のまま（スプシから「未」が来た場合の対応はBuyerDetailで行う）
#    → 新規登録時は「未」を選択できるようにする（選択肢はそのまま）
# 2. three_calls_confirmed: 選択肢を「3回架電OK」「3回架電未」「他」の3択に変更

with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# --- 変更: three_calls_confirmed の選択肢を3択に変更 ---
old_three = """                        {['確認済み', '未'].map((opt) => {
                          const isSelected = threeCallsConfirmed === opt;"""

new_three = """                        {['3回架電OK', '3回架電未', '他'].map((opt) => {
                          const isSelected = threeCallsConfirmed === opt;"""

if old_three in text:
    text = text.replace(old_three, new_three)
    print('変更: three_calls_confirmed 3択に変更完了')
else:
    print('エラー: ターゲットが見つかりません')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了: NewBuyerPage.tsx を更新しました')
