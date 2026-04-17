#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
フロントエンドのpinrich500manUnregisteredフィルタリング修正

問題1: キャッシュあり時（フロント側フィルタリング）
  pinrich500manUnregistered が else ブロックに落ちて
  calculated_status === 'Pinrich500万以上登録未' で比較 → 0件

問題2: キャッシュなし時（API経由）
  calculatedStatus=Pinrich500万以上登録未（日本語）をAPIに渡すが
  バックエンドは英語キー pinrich500manUnregistered を期待 → 0件

修正:
1. フロント側フィルタリングに pinrich500manUnregistered の専用分岐を追加
2. APIコール時は日本語変換せず英語キーをそのまま渡す
"""

with open('frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 修正1: フロント側フィルタリングに pinrich500manUnregistered の専用分岐を追加
# ============================================================

OLD_1 = """                } else {
                  // サイドバーのカテゴリキーを日本語の表示名に変換
                  const displayName = categoryKeyToDisplayName[selectedCalculatedStatus] || selectedCalculatedStatus;
                  
                  // バックエンドのcalculated_statusは既に日本語（例: "内覧日前日", "担当(Y)", "当日TEL(Y)"）
                  // フィルタリングは日本語の表示名で直接比較
                  const matches = b.calculated_status === displayName;
                  
                  return matches;
                }"""

NEW_1 = """                } else if (selectedCalculatedStatus === 'pinrich500manUnregistered') {
                  // Pinrich500万以上登録未: 4条件でフィルタリング（バックエンドと同じロジック）
                  const matches = (
                    b.email && String(b.email).trim() &&
                    b.inquiry_property_price !== null &&
                    b.inquiry_property_price !== undefined &&
                    Number(b.inquiry_property_price) <= 5000000 &&
                    (!b.pinrich_500man_registration || b.pinrich_500man_registration === '未') &&
                    b.reception_date && b.reception_date >= '2026-01-01'
                  );
                  return matches;
                } else {
                  // サイドバーのカテゴリキーを日本語の表示名に変換
                  const displayName = categoryKeyToDisplayName[selectedCalculatedStatus] || selectedCalculatedStatus;
                  
                  // バックエンドのcalculated_statusは既に日本語（例: "内覧日前日", "担当(Y)", "当日TEL(Y)"）
                  // フィルタリングは日本語の表示名で直接比較
                  const matches = b.calculated_status === displayName;
                  
                  return matches;
                }"""

if OLD_1 in text:
    text = text.replace(OLD_1, NEW_1, 1)
    print('✅ 修正1完了: フロント側フィルタリングに pinrich500manUnregistered の専用分岐を追加')
else:
    print('❌ 修正1失敗: 対象文字列が見つかりません')
    exit(1)

# ============================================================
# 修正2: APIコール時は英語キーをそのまま渡す（日本語変換しない）
# ============================================================

OLD_2 = """        // 全件データ未取得時でもselectedCalculatedStatusが指定されている場合はAPIにフィルタパラメータを渡す
        if (selectedCalculatedStatus && !viewingMonth && !assigneeParam) {
          // カテゴリキーを日本語表示名に変換してからAPIに渡す
          const displayName = categoryKeyToDisplayName[selectedCalculatedStatus] || selectedCalculatedStatus;
          quickParams.calculatedStatus = displayName;
        }"""

NEW_2 = """        // 全件データ未取得時でもselectedCalculatedStatusが指定されている場合はAPIにフィルタパラメータを渡す
        if (selectedCalculatedStatus && !viewingMonth && !assigneeParam) {
          // pinrich500manUnregistered は英語キーをそのままAPIに渡す（バックエンドが英語キーで処理）
          // その他のカテゴリはカテゴリキーを日本語表示名に変換してからAPIに渡す
          if (selectedCalculatedStatus === 'pinrich500manUnregistered') {
            quickParams.calculatedStatus = selectedCalculatedStatus;
          } else {
            const displayName = categoryKeyToDisplayName[selectedCalculatedStatus] || selectedCalculatedStatus;
            quickParams.calculatedStatus = displayName;
          }
        }"""

if OLD_2 in text:
    text = text.replace(OLD_2, NEW_2, 1)
    print('✅ 修正2完了: APIコール時は英語キーをそのまま渡すように修正')
else:
    print('❌ 修正2失敗: 対象文字列が見つかりません')
    exit(1)

# ============================================================
# ファイルに書き込む
# ============================================================

with open('frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('')
print('✅ 全修正完了: frontend/src/pages/BuyersPage.tsx を更新しました')
