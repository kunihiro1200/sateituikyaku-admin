#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pageDataCache.ts: CACHE_KEYS に BUYERS_WITH_STATUS を追加
"""

with open('frontend/frontend/src/store/pageDataCache.ts', 'rb') as f:
    raw = f.read()

text = raw.decode('utf-8').replace('\r\n', '\n')

old_keys = """export const CACHE_KEYS = {
  PROPERTY_LISTINGS: 'property_listings',
  WORK_TASKS: 'work_tasks',
  SHARED_ITEMS: 'shared_items',
  BUYERS: 'buyers',
  BUYERS_STATS: 'buyers_stats',
  SELLERS_SIDEBAR_COUNTS: 'sellers_sidebar_counts',
  SELLERS_ASSIGNEE_INITIALS: 'sellers_assignee_initials',
  SELLERS_LIST: 'sellers_list',
  SELLER_DETAIL: 'seller_detail', // 売主詳細（一覧→通話モードのプリフェッチ用）
} as const;"""

new_keys = """export const CACHE_KEYS = {
  PROPERTY_LISTINGS: 'property_listings',
  WORK_TASKS: 'work_tasks',
  SHARED_ITEMS: 'shared_items',
  BUYERS: 'buyers',
  BUYERS_STATS: 'buyers_stats',
  BUYERS_WITH_STATUS: 'buyers_with_status',
  SELLERS_SIDEBAR_COUNTS: 'sellers_sidebar_counts',
  SELLERS_ASSIGNEE_INITIALS: 'sellers_assignee_initials',
  SELLERS_LIST: 'sellers_list',
  SELLER_DETAIL: 'seller_detail', // 売主詳細（一覧→通話モードのプリフェッチ用）
} as const;"""

if old_keys in text:
    text = text.replace(old_keys, new_keys)
    print("✅ CACHE_KEYS に BUYERS_WITH_STATUS を追加しました")
else:
    print("❌ 対象ブロックが見つかりませんでした")

with open('frontend/frontend/src/store/pageDataCache.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ pageDataCache.ts を保存しました")
