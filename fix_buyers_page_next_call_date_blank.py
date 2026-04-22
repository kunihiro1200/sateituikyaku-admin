#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyersPage.tsx に nextCallDateBlank:xxx フィルタリングを追加する
"""

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: フロントキャッシュのフィルタリングに nextCallDateBlank:xxx を追加
# todayCallAssigned: の else if の後に追加
old1 = """                } else if (selectedCalculatedStatus.startsWith('todayCallAssigned:')) {
                  const assignee = selectedCalculatedStatus.replace('todayCallAssigned:', '');
                  // バックエンドと同じロジック: follow_up_assignee が一致 AND next_call_date が今日以前
                  // 🚨 重要：タイムゾーン問題を回避するため、JST（日本時間）で今日の日付を取得
                  const now = new Date();
                  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
                  const jstTime = new Date(now.getTime() + JST_OFFSET_MS);
                  const todayStr = jstTime.toISOString().split('T')[0];  // JST日付（YYYY-MM-DD）
                  const nextCallDateStr = b.next_call_date ? b.next_call_date.substring(0, 10) : null;
                  
                  const matches = (
                    b.follow_up_assignee === assignee &&
                    nextCallDateStr !== null &&
                    nextCallDateStr <= todayStr
                  );
                  
                  return matches;
                } else if (selectedCalculatedStatus === 'pinrich500manUnregistered') {"""

new1 = """                } else if (selectedCalculatedStatus.startsWith('todayCallAssigned:')) {
                  const assignee = selectedCalculatedStatus.replace('todayCallAssigned:', '');
                  // バックエンドと同じロジック: follow_up_assignee が一致 AND next_call_date が今日以前
                  // 🚨 重要：タイムゾーン問題を回避するため、JST（日本時間）で今日の日付を取得
                  const now = new Date();
                  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
                  const jstTime = new Date(now.getTime() + JST_OFFSET_MS);
                  const todayStr = jstTime.toISOString().split('T')[0];  // JST日付（YYYY-MM-DD）
                  const nextCallDateStr = b.next_call_date ? b.next_call_date.substring(0, 10) : null;
                  
                  const matches = (
                    b.follow_up_assignee === assignee &&
                    nextCallDateStr !== null &&
                    nextCallDateStr <= todayStr
                  );
                  
                  return matches;
                } else if (selectedCalculatedStatus.startsWith('nextCallDateBlank:')) {
                  // 次電日空欄(イニシャル): follow_up_assignee = イニシャル AND latest_status IN (A, B) AND next_call_date NULL AND broker_inquiry NULL/空
                  const assignee = selectedCalculatedStatus.replace('nextCallDateBlank:', '');
                  const STATUS_A = 'A:この物件を気に入っている（こちらからの一押しが必要）';
                  const STATUS_B = 'B:1年以内に引っ越し希望だが、この物件ではない。駐車場の要件や、日当たり等が合わない。';
                  const matches = (
                    b.follow_up_assignee === assignee &&
                    (b.latest_status === STATUS_A || b.latest_status === STATUS_B) &&
                    !b.next_call_date &&
                    (!b.broker_inquiry || b.broker_inquiry === '')
                  );
                  return matches;
                } else if (selectedCalculatedStatus === 'pinrich500manUnregistered') {"""

# 修正2: APIフォールバック時に nextCallDateBlank:xxx を statusCategory として渡す
old2 = """          const backendEnglishKeyCategories = [
            'threeCallUnchecked',          // ３回架電未
            'pinrichUnregistered',         // ピンリッチ未登録
            'pinrich500manUnregistered',   // Pinrich500万以上登録未
          ];
          if (backendEnglishKeyCategories.includes(selectedCalculatedStatus)) {
            quickParams.calculatedStatus = selectedCalculatedStatus;
          } else {
            const displayName = categoryKeyToDisplayName[selectedCalculatedStatus] || selectedCalculatedStatus;
            quickParams.calculatedStatus = displayName;
          }"""

new2 = """          const backendEnglishKeyCategories = [
            'threeCallUnchecked',          // ３回架電未
            'pinrichUnregistered',         // ピンリッチ未登録
            'pinrich500manUnregistered',   // Pinrich500万以上登録未
          ];
          if (backendEnglishKeyCategories.includes(selectedCalculatedStatus)) {
            quickParams.calculatedStatus = selectedCalculatedStatus;
          } else if (
            selectedCalculatedStatus.startsWith('assigned:') ||
            selectedCalculatedStatus.startsWith('todayCallAssigned:') ||
            selectedCalculatedStatus.startsWith('nextCallDateBlank:')
          ) {
            // 動的カテゴリ（assigned:xxx, todayCallAssigned:xxx, nextCallDateBlank:xxx）は
            // statusCategory パラメーターとして getAll() に渡す
            quickParams.statusCategory = selectedCalculatedStatus;
          } else {
            const displayName = categoryKeyToDisplayName[selectedCalculatedStatus] || selectedCalculatedStatus;
            quickParams.calculatedStatus = displayName;
          }"""

if old1 in text:
    text = text.replace(old1, new1)
    print('修正1: フロントキャッシュのnextCallDateBlankフィルタリングを追加しました')
else:
    print('修正1: 対象文字列が見つかりませんでした')

if old2 in text:
    text = text.replace(old2, new2)
    print('修正2: APIフォールバック時のstatusCategoryパラメーターを追加しました')
else:
    print('修正2: 対象文字列が見つかりませんでした')

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了!')
