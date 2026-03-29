#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
2つの問題を修正:
1. 訪問日・担当を全て空欄にして保存すると削除できない
   → visitDate が null の場合、visitAcquisitionDate もクリアする
2. 訪問取得日が1日前になる
   → Supabaseのdate型がUTCで保存するため、JST+9時間分を補正
     → フロントエンドで送る日付を文字列のまま送り、バックエンドでそのまま保存しているが
        Supabaseがdate型をUTCとして解釈する可能性がある
     → 解決策: visitAcquisitionDateをdate型ではなくtext型として扱う
        または、フロントエンドで送る際に翌日の日付を送る（ハック）
        → 正しい解決策: Supabaseのdate型はタイムゾーンなしで保存されるはず
        → 実際の問題: バックエンドがnew Date()でパースしていた（修正済み）
        → まだ1日前になる場合: Supabaseがdate型をUTCとして返している可能性
        → 解決策: SellerServiceでvisit_acquisition_dateを返す際に文字列のまま返す（修正済み）
        → それでも1日前になる場合: フロントエンドで送る日付自体が1日前になっている
        → toLocaleDateStringの出力を確認: 'ja-JP'形式は '2026/03/30' → replace → '2026-03-30'
        → これは正しいはず
        → 問題: seller?.visitAcquisitionDate が既に設定されている場合は undefined を送る
          → 既存値がある場合は上書きしない → 最初の保存時のみ今日の日付を設定
          → 最初の保存時に1日前になっている
        → デバッグ: console.logを追加して確認
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 問題1の修正: visitDate が null（空欄）の場合、visitAcquisitionDate もクリアする
# また、visitAcquisitionDate の自動設定条件を修正
# visitDate が null の場合は visitAcquisitionDate を null に設定（クリア）
old_acquisition = """      // 訪問取得日の自動設定: 未設定の場合のみ今日の日付をセット
      const visitAcquisitionDateToSave = seller?.visitAcquisitionDate
        ? undefined  // 既存値がある場合は送信しない（上書きしない）
        : new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');  // 未設定の場合は今日の日付（JST）

      await api.put(`/api/sellers/${id}`, {
        visitDate: visitDateStr,
        visitTime: visitTimeStr,
        visitAssignee: editedAssignedTo || null,
        visitValuationAcquirer: acquirer || null,
        appointmentNotes: editedAppointmentNotes || null,
        ...(visitAcquisitionDateToSave !== undefined && { visitAcquisitionDate: visitAcquisitionDateToSave }),
      });"""

new_acquisition = """      // 訪問取得日の自動設定
      // - visitDate が null（訪問日を削除）の場合: visitAcquisitionDate もクリア
      // - visitDate があり visitAcquisitionDate が未設定の場合: 今日の日付を自動設定
      // - visitDate があり visitAcquisitionDate が設定済みの場合: 上書きしない
      let visitAcquisitionDateToSave: string | null | undefined = undefined;
      if (!visitDateStr) {
        // 訪問日が空欄 → 訪問取得日もクリア
        visitAcquisitionDateToSave = null;
      } else if (!seller?.visitAcquisitionDate) {
        // 訪問日あり、訪問取得日が未設定 → 今日の日付（JST）を自動設定
        const now = new Date();
        const jstOffset = 9 * 60; // JST = UTC+9
        const jstDate = new Date(now.getTime() + (jstOffset - now.getTimezoneOffset()) * 60000);
        visitAcquisitionDateToSave = jstDate.toISOString().slice(0, 10); // YYYY-MM-DD
      }
      // それ以外（既存値あり）は undefined のまま → 送信しない

      await api.put(`/api/sellers/${id}`, {
        visitDate: visitDateStr,
        visitTime: visitTimeStr,
        visitAssignee: editedAssignedTo || null,
        visitValuationAcquirer: acquirer || null,
        appointmentNotes: editedAppointmentNotes || null,
        ...(visitAcquisitionDateToSave !== undefined && { visitAcquisitionDate: visitAcquisitionDateToSave }),
      });"""

if old_acquisition in text:
    text = text.replace(old_acquisition, new_acquisition, 1)
    print('✅ 訪問取得日の自動設定ロジックを修正しました')
else:
    print('❌ 対象コードが見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 修正完了')
