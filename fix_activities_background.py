#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx の activities 取得をバックグラウンド化する
- Promise.all から activities を外す
- activities は setLoading(false) 後にバックグラウンドで取得
"""

import re

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    raw = f.read()

# CRLF を LF に正規化
is_crlf = b'\r\n' in raw
text = raw.decode('utf-8').replace('\r\n', '\n')

# ===== 変更1: Promise.all から activitiesResponse を削除 =====
old_promise_all = '''      const [sellerResponse, activitiesResponse, employeesData, propertyFallbackResponse] = await Promise.all([
        api.get(`/api/sellers/${id}`),
        api.get(`/api/sellers/${id}/activities`),
        getActiveEmployees(),
        api.get(`/properties/seller/${id}`).catch(() => null),
      ]);'''

new_promise_all = '''      const [sellerResponse, employeesData, propertyFallbackResponse] = await Promise.all([
        api.get(`/api/sellers/${id}`),
        getActiveEmployees(),
        api.get(`/properties/seller/${id}`).catch(() => null),
      ]);'''

if old_promise_all not in text:
    print('ERROR: Promise.all の変更対象が見つかりません')
    exit(1)

text = text.replace(old_promise_all, new_promise_all)
print('✅ Promise.all から activities を削除しました')

# ===== 変更2: activities の処理を setLoading(false) の後に移動 =====
# 現在の構造:
#   const convertedActivities = activitiesResponse.data.map(...)
#   setActivities(convertedActivities);
#   setLoading(false);
#   // AI要約...（convertedActivities を使用）
#   // 重複検出...
#
# 変更後:
#   setLoading(false);
#   // activities をバックグラウンドで取得
#   api.get(`/api/sellers/${id}/activities`).then(activitiesResponse => {
#     const convertedActivities = ...
#     setActivities(convertedActivities);
#     // AI要約...
#   }).catch(...)
#   // 重複検出...

old_activities_block = '''      // 活動履歴を設定
      const convertedActivities = activitiesResponse.data.map((activity: any) => ({
        id: activity.id,
        sellerId: activity.seller_id || activity.sellerId,
        employeeId: activity.employee_id || activity.employeeId,
        type: activity.type,
        content: activity.content,
        result: activity.result,
        metadata: activity.metadata,
        createdAt: activity.created_at || activity.createdAt,
        employee: activity.employee,
      }));
      setActivities(convertedActivities);

      // ローディング終了（画面を表示）
      setLoading(false);

      // AI要約を非同期で取得（画面表示後にバックグラウンドで実行）
      // 通話履歴とスプレッドシートコメントの両方を含めて要約
      const phoneCalls = convertedActivities.filter((a: Activity) => a.type === 'phone_call');
      const memosToSummarize: string[] = [];
      
      // 通話履歴を追加
      if (phoneCalls.length > 0) {
        phoneCalls.forEach((call: Activity) => {
          memosToSummarize.push(call.content);
        });
      }
      
      // 要約するコンテンツがあれば要約を生成
      if (memosToSummarize.length > 0) {
        api.post('/summarize/call-memos', { memos: memosToSummarize })
          .then((summaryResponse) => {
            setCallSummary(summaryResponse.data.summary);
          })
          .catch((err) => {
            console.error('Failed to generate summary:', err);
          });
      }

      // 重複検出を非同期で実行（画面表示後にバックグラウンドで実行）
      loadDuplicates();'''

new_activities_block = '''      // ローディング終了（画面を表示）- activities 取得を待たずに表示
      setLoading(false);

      // 活動履歴をバックグラウンドで取得（3秒かかるため画面表示をブロックしない）
      api.get(`/api/sellers/${id}/activities`)
        .then((activitiesResponse) => {
          const convertedActivities = activitiesResponse.data.map((activity: any) => ({
            id: activity.id,
            sellerId: activity.seller_id || activity.sellerId,
            employeeId: activity.employee_id || activity.employeeId,
            type: activity.type,
            content: activity.content,
            result: activity.result,
            metadata: activity.metadata,
            createdAt: activity.created_at || activity.createdAt,
            employee: activity.employee,
          }));
          setActivities(convertedActivities);

          // AI要約を非同期で取得（activities 取得後にバックグラウンドで実行）
          // 通話履歴とスプレッドシートコメントの両方を含めて要約
          const phoneCalls = convertedActivities.filter((a: Activity) => a.type === 'phone_call');
          const memosToSummarize: string[] = [];
          
          // 通話履歴を追加
          if (phoneCalls.length > 0) {
            phoneCalls.forEach((call: Activity) => {
              memosToSummarize.push(call.content);
            });
          }
          
          // 要約するコンテンツがあれば要約を生成
          if (memosToSummarize.length > 0) {
            api.post('/summarize/call-memos', { memos: memosToSummarize })
              .then((summaryResponse) => {
                setCallSummary(summaryResponse.data.summary);
              })
              .catch((err) => {
                console.error('Failed to generate summary:', err);
              });
          }
        })
        .catch((err) => {
          console.error('Failed to load activities:', err);
        });

      // 重複検出を非同期で実行（画面表示後にバックグラウンドで実行）
      loadDuplicates();'''

if old_activities_block not in text:
    print('ERROR: activities ブロックの変更対象が見つかりません')
    # デバッグ用に前後を表示
    idx = text.find('// 活動履歴を設定')
    if idx >= 0:
        print('--- 見つかった箇所 ---')
        print(repr(text[idx:idx+200]))
    exit(1)

text = text.replace(old_activities_block, new_activities_block)
print('✅ activities をバックグラウンド取得に変更しました')

# CRLF に戻す
if is_crlf:
    text = text.replace('\n', '\r\n')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'✅ {filepath} を更新しました')
