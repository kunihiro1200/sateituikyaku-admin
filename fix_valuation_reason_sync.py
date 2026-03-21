#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EnhancedAutoSyncService.ts に valuation_reason（査定理由）の同期を追加する
"""

with open('backend/src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# --- updateSingleSeller に追加 ---
# 「査定方法を追加」の直前に査定理由を追加（updateSingleSeller内）
# updateSingleSeller は updateData を使う

old_update = """    // 査定方法を追加
    const valuationMethod = row['査定方法'];
    if (valuationMethod) {
      updateData.valuation_method = String(valuationMethod);
    }

    // I列「査定額」（テキスト形式）を追加
    // 例: "1900～2200万円", "2000万円前後"
    const valuationText = row['査定額'];
    if (valuationText) {
      updateData.valuation_text = String(valuationText);
    }

    // 契約年月を追加
    const contractYearMonth = row['契約年月 他決は分かった時点'];
    if (contractYearMonth && contractYearMonth !== '') {
      updateData.contract_year_month = this.formatContractYearMonth(contractYearMonth);
    }

    // 査定額を追加（万円→円に変換）
    const val1 = this.parseNumeric(valuation1);
    const val2 = this.parseNumeric(valuation2);
    const val3 = this.parseNumeric(valuation3);
    if (val1 !== null) updateData.valuation_amount_1 = val1 * 10000;
    if (val2 !== null) updateData.valuation_amount_2 = val2 * 10000;
    if (val3 !== null) updateData.valuation_amount_3 = val3 * 10000;

    const { error: updateError } = await this.supabase
      .from('sellers')
      .update(updateData)
      .eq('seller_number', sellerNumber);"""

new_update = """    // 査定方法を追加
    const valuationMethod = row['査定方法'];
    if (valuationMethod) {
      updateData.valuation_method = String(valuationMethod);
    }

    // 査定理由（AO列）を追加
    const valuationReason = row['査定理由'];
    if (valuationReason !== undefined) {
      updateData.valuation_reason = valuationReason ? String(valuationReason) : null;
    }

    // I列「査定額」（テキスト形式）を追加
    // 例: "1900～2200万円", "2000万円前後"
    const valuationText = row['査定額'];
    if (valuationText) {
      updateData.valuation_text = String(valuationText);
    }

    // 契約年月を追加
    const contractYearMonth = row['契約年月 他決は分かった時点'];
    if (contractYearMonth && contractYearMonth !== '') {
      updateData.contract_year_month = this.formatContractYearMonth(contractYearMonth);
    }

    // 査定額を追加（万円→円に変換）
    const val1 = this.parseNumeric(valuation1);
    const val2 = this.parseNumeric(valuation2);
    const val3 = this.parseNumeric(valuation3);
    if (val1 !== null) updateData.valuation_amount_1 = val1 * 10000;
    if (val2 !== null) updateData.valuation_amount_2 = val2 * 10000;
    if (val3 !== null) updateData.valuation_amount_3 = val3 * 10000;

    const { error: updateError } = await this.supabase
      .from('sellers')
      .update(updateData)
      .eq('seller_number', sellerNumber);"""

if old_update in text:
    text = text.replace(old_update, new_update)
    print("✅ updateSingleSeller に valuation_reason を追加しました")
else:
    print("❌ updateSingleSeller のターゲット文字列が見つかりません")

# --- syncSingleSeller に追加 ---
# syncSingleSeller は encryptedData を使う

old_sync = """    // 査定方法を追加
    const valuationMethod = row['査定方法'];
    if (valuationMethod) {
      encryptedData.valuation_method = String(valuationMethod);
    }

    // I列「査定額」（テキスト形式）を追加
    // 例: "1900～2200万円", "2000万円前後"
    const valuationText = row['査定額'];
    if (valuationText) {
      encryptedData.valuation_text = String(valuationText);
    }

    // 契約年月を追加
    const contractYearMonth = row['契約年月 他決は分かった時点'];
    if (contractYearMonth && contractYearMonth !== '') {
      encryptedData.contract_year_month = this.formatContractYearMonth(contractYearMonth);
    }

    // 査定額を追加（万円→円に変換）
    const val1 = this.parseNumeric(valuation1);
    const val2 = this.parseNumeric(valuation2);
    const val3 = this.parseNumeric(valuation3);
    if (val1 !== null) encryptedData.valuation_amount_1 = val1 * 10000;
    if (val2 !== null) encryptedData.valuation_amount_2 = val2 * 10000;
    if (val3 !== null) encryptedData.valuation_amount_3 = val3 * 10000;

    // UPSERT: 既存データがあれば更新、なければ挿入"""

new_sync = """    // 査定方法を追加
    const valuationMethod = row['査定方法'];
    if (valuationMethod) {
      encryptedData.valuation_method = String(valuationMethod);
    }

    // 査定理由（AO列）を追加
    const valuationReason = row['査定理由'];
    if (valuationReason !== undefined) {
      encryptedData.valuation_reason = valuationReason ? String(valuationReason) : null;
    }

    // I列「査定額」（テキスト形式）を追加
    // 例: "1900～2200万円", "2000万円前後"
    const valuationText = row['査定額'];
    if (valuationText) {
      encryptedData.valuation_text = String(valuationText);
    }

    // 契約年月を追加
    const contractYearMonth = row['契約年月 他決は分かった時点'];
    if (contractYearMonth && contractYearMonth !== '') {
      encryptedData.contract_year_month = this.formatContractYearMonth(contractYearMonth);
    }

    // 査定額を追加（万円→円に変換）
    const val1 = this.parseNumeric(valuation1);
    const val2 = this.parseNumeric(valuation2);
    const val3 = this.parseNumeric(valuation3);
    if (val1 !== null) encryptedData.valuation_amount_1 = val1 * 10000;
    if (val2 !== null) encryptedData.valuation_amount_2 = val2 * 10000;
    if (val3 !== null) encryptedData.valuation_amount_3 = val3 * 10000;

    // UPSERT: 既存データがあれば更新、なければ挿入"""

if old_sync in text:
    text = text.replace(old_sync, new_sync)
    print("✅ syncSingleSeller に valuation_reason を追加しました")
else:
    print("❌ syncSingleSeller のターゲット文字列が見つかりません")

with open('backend/src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ ファイルを保存しました")
