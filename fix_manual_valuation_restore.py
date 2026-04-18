#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx の loadAllData() 内の査定額初期化ブロックを修正するスクリプト
手入力査定額の復元ロジックを追加する
"""

file_path = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 変更前のコード（バグのあるコード）
old_code = """      // 常に自動計算モードとして扱う
      // （手入力査定額は将来的にmanualValuationAmount1を使用）
      setIsManualValuation(false);
      setEditedManualValuationAmount1('');
      setEditedManualValuationAmount2('');
      setEditedManualValuationAmount3('');
      console.log('査定額を査定計算セクションに表示');"""

# 変更後のコード（修正後）
new_code = """      // 手入力査定額の復元ロジック
      // valuationAmount1が存在し、かつfixedAssetTaxRoadPriceがnullの場合は手入力モード
      const hasManualValuation = sellerData.valuationAmount1 != null
                                 && sellerData.fixedAssetTaxRoadPrice == null;

      if (hasManualValuation) {
        setIsManualValuation(true);
        setEditedManualValuationAmount1(
          String(Math.round(sellerData.valuationAmount1 / 10000))
        );
        setEditedManualValuationAmount2(
          sellerData.valuationAmount2
            ? String(Math.round(sellerData.valuationAmount2 / 10000))
            : ''
        );
        setEditedManualValuationAmount3(
          sellerData.valuationAmount3
            ? String(Math.round(sellerData.valuationAmount3 / 10000))
            : ''
        );
        console.log('手入力査定額を復元:', sellerData.valuationAmount1);
      } else {
        setIsManualValuation(false);
        setEditedManualValuationAmount1('');
        setEditedManualValuationAmount2('');
        setEditedManualValuationAmount3('');
        console.log('査定額を査定計算セクションに表示');
      }"""

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ 変更箇所を発見し、置換しました')
else:
    print('❌ 変更箇所が見つかりませんでした')
    # デバッグ用：前後の文字列を確認
    idx = text.find('常に自動計算モードとして扱う')
    if idx >= 0:
        print(f'  「常に自動計算モードとして扱う」は {idx} 文字目に存在します')
        print(repr(text[idx-10:idx+200]))
    exit(1)

# UTF-8（BOMなし）で書き込む
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを UTF-8 で書き込みました')

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes)} (b\'\\xef\\xbb\\xbf\' はBOM付き、それ以外はOK)')
