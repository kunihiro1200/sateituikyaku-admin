#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pinrich500万以上登録未 サイドバーフィルターバグ修正スクリプト

修正内容:
1. getBuyersByStatus に pinrich500manUnregistered の専用分岐を追加
2. getSidebarCountsFallback のカウント計算に reception_date 条件を追加
3. updateBuyerSidebarCounts のカウント計算にも reception_date 条件を追加
"""

with open('src/services/BuyerService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 修正1: getBuyersByStatus に pinrich500manUnregistered の専用分岐を追加
# ============================================================

OLD_1 = """      } else if (status === 'inquiryEmailUnanswered' || status === 'brokerInquiry' || 
                 status === 'generalViewingSellerContactPending' || status === 'viewingPromotionRequired' || 
                 status === 'pinrichUnregistered') {
        // 新カテゴリの場合（2026年4月追加）
        // これらのカテゴリはGASで計算されたカウントのみを使用し、フィルタリングは実装しない
        console.log(`[getBuyersByStatus] 新カテゴリ検出: status=${status}`);
        console.log(`[getBuyersByStatus] 新カテゴリはフィルタリング未実装のため、空配列を返します`);
        filteredBuyers = [];"""

NEW_1 = """      } else if (status === 'pinrich500manUnregistered') {
        // Pinrich500万以上登録未: 4条件でフィルタリング
        // email非空 AND price<=500万 AND pinrich_500man_registration未 AND reception_date>=2026-01-01
        console.log(`[getBuyersByStatus] pinrich500manUnregistered カテゴリ検出`);
        filteredBuyers = allBuyers.filter((buyer: any) => {
          return (
            buyer.email && String(buyer.email).trim() &&
            buyer.inquiry_property_price !== null &&
            buyer.inquiry_property_price !== undefined &&
            Number(buyer.inquiry_property_price) <= 5000000 &&
            (!buyer.pinrich_500man_registration || buyer.pinrich_500man_registration === '未') &&
            buyer.reception_date && buyer.reception_date >= '2026-01-01'
          );
        });
        console.log(`[getBuyersByStatus] pinrich500manUnregistered フィルタ結果: ${filteredBuyers.length}件`);
      } else if (status === 'inquiryEmailUnanswered' || status === 'brokerInquiry' || 
                 status === 'generalViewingSellerContactPending' || status === 'viewingPromotionRequired' || 
                 status === 'pinrichUnregistered') {
        // 新カテゴリの場合（2026年4月追加）
        // これらのカテゴリはGASで計算されたカウントのみを使用し、フィルタリングは実装しない
        console.log(`[getBuyersByStatus] 新カテゴリ検出: status=${status}`);
        console.log(`[getBuyersByStatus] 新カテゴリはフィルタリング未実装のため、空配列を返します`);
        filteredBuyers = [];"""

if OLD_1 in text:
    text = text.replace(OLD_1, NEW_1, 1)
    print('✅ 修正1完了: getBuyersByStatus に pinrich500manUnregistered の専用分岐を追加')
else:
    print('❌ 修正1失敗: 対象文字列が見つかりません')
    exit(1)

# ============================================================
# 修正2: getSidebarCountsFallback のカウント計算に reception_date 条件を追加
# ============================================================

OLD_2 = """      // Pinrich500万以上登録未: email非空 AND price<=500万 AND (pinrich_500man_registration が '未' または null/空)
      allBuyers.forEach((buyer: any) => {
        if (
          buyer.email && String(buyer.email).trim() &&
          buyer.inquiry_property_price !== null &&
          buyer.inquiry_property_price !== undefined &&
          Number(buyer.inquiry_property_price) <= 5000000 &&
          (!buyer.pinrich_500man_registration || buyer.pinrich_500man_registration === '未')
        ) {
          result.pinrich500manUnregistered++;
        }
      });"""

NEW_2 = """      // Pinrich500万以上登録未: email非空 AND price<=500万 AND pinrich_500man_registration未 AND reception_date>=2026-01-01
      allBuyers.forEach((buyer: any) => {
        if (
          buyer.email && String(buyer.email).trim() &&
          buyer.inquiry_property_price !== null &&
          buyer.inquiry_property_price !== undefined &&
          Number(buyer.inquiry_property_price) <= 5000000 &&
          (!buyer.pinrich_500man_registration || buyer.pinrich_500man_registration === '未') &&
          buyer.reception_date && buyer.reception_date >= '2026-01-01'
        ) {
          result.pinrich500manUnregistered++;
        }
      });"""

if OLD_2 in text:
    text = text.replace(OLD_2, NEW_2, 1)
    print('✅ 修正2完了: getSidebarCountsFallback のカウント計算に reception_date 条件を追加')
else:
    print('❌ 修正2失敗: 対象文字列が見つかりません')
    exit(1)

# ============================================================
# 修正3: updateBuyerSidebarCounts のカウント計算にも reception_date 条件を追加
# ============================================================
# updateBuyerSidebarCounts 内でも同様のカウント計算があるか確認
# getSidebarCountsFallback と同じパターンが2箇所目にあれば修正する

# 修正2で既に1箇所目を修正済み。2箇所目があるか確認
if OLD_2 in text:
    text = text.replace(OLD_2, NEW_2, 1)
    print('✅ 修正3完了: updateBuyerSidebarCounts のカウント計算にも reception_date 条件を追加')
else:
    print('ℹ️  修正3: 2箇所目のカウント計算は見つかりませんでした（修正不要）')

# ============================================================
# ファイルに書き込む
# ============================================================

with open('src/services/BuyerService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('')
print('✅ 全修正完了: backend/src/services/BuyerService.ts を更新しました')
