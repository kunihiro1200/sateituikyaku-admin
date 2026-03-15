# -*- coding: utf-8 -*-
"""
PriceSection.tsx の月々ローン支払い計算式を更新
新式: price * 0.0007916666667 * POWER(1+0.0007916666667, 420) / (POWER(1+0.0007916666667, 420) - 1)
"""

with open('frontend/frontend/src/components/PriceSection.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

old_calc = """// 月々ローン支払い計算（元利均等返済、金利3%/年、35年）
function calcMonthlyPayment(price: number): number {
  const r = 0.03 / 12;
  const n = 35 * 12;
  return Math.round(price * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
}"""

new_calc = """// 月々ローン支払い計算（元利均等返済、金利年3%/12、420回）
function calcMonthlyPayment(price: number): number {
  const r = 0.0007916666667;
  const n = 420;
  return Math.round(price * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
}"""

if old_calc in content:
    content = content.replace(old_calc, new_calc)
    print('計算式を更新しました')
else:
    print('対象の計算式が見つかりません。現在の内容を確認してください。')
    # 現在の calcMonthlyPayment 関数を表示
    import re
    match = re.search(r'function calcMonthlyPayment.*?\}', content, re.DOTALL)
    if match:
        print('現在の関数:', match.group())

with open('frontend/frontend/src/components/PriceSection.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done!')
