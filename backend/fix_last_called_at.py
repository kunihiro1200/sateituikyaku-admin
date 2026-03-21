#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
最終電話が売主一覧に表示されない問題の修正（CRLF対応版）
"""

import os

# ===== 1. SellerService.supabase.ts: invalidateListSellersCache を export =====
seller_service_path = os.path.join('src', 'services', 'SellerService.supabase.ts')

with open(seller_service_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')
# CRLF -> LF に正規化して処理
text_lf = text.replace('\r\n', '\n')

old1 = 'function invalidateListSellersCache(): void {\n  _listSellersCache.clear();\n}'
new1 = 'export function invalidateListSellersCache(): void {\n  _listSellersCache.clear();\n}'

if old1 in text_lf:
    text_lf = text_lf.replace(old1, new1)
    print('1. invalidateListSellersCache を export しました')
else:
    print('1. パターンが見つかりませんでした（invalidateListSellersCache）')

# CRLF に戻して書き込み
result = text_lf.replace('\n', '\r\n')
with open(seller_service_path, 'wb') as f:
    f.write(result.encode('utf-8'))

print('SellerService.supabase.ts 更新完了')

# ===== 2. followUps.ts: phone_call 記録時に listSellers キャッシュを無効化 =====
follow_ups_path = os.path.join('src', 'routes', 'followUps.ts')

with open(follow_ups_path, 'rb') as f:
    content2 = f.read()

text2 = content2.decode('utf-8')
text2_lf = text2.replace('\r\n', '\n')

# import 文に invalidateListSellersCache を追加（まだ追加されていない場合のみ）
if 'invalidateListSellersCache' not in text2_lf:
    old2 = "import { FollowUpService } from '../services/FollowUpService.supabase';"
    new2 = "import { FollowUpService } from '../services/FollowUpService.supabase';\nimport { invalidateListSellersCache } from '../services/SellerService.supabase';"
    if old2 in text2_lf:
        text2_lf = text2_lf.replace(old2, new2)
        print('2. import 文を追加しました')
    else:
        print('2. パターンが見つかりませんでした（import 文）')
else:
    print('2. import 文はすでに存在します')

# phone_call 記録後にキャッシュ無効化を追加（まだ追加されていない場合のみ）
if 'invalidateListSellersCache()' not in text2_lf:
    old3 = "      // 新規活動を記録したのでキャッシュを無効化\n      invalidateActivitiesCache(sellerId);\n      res.status(201).json(activity);"
    new3 = "      // 新規活動を記録したのでキャッシュを無効化\n      invalidateActivitiesCache(sellerId);\n      // phone_call の場合は売主一覧の lastCalledAt キャッシュも無効化\n      if (type === 'phone_call') {\n        invalidateListSellersCache();\n      }\n      res.status(201).json(activity);"
    if old3 in text2_lf:
        text2_lf = text2_lf.replace(old3, new3)
        print('3. phone_call 時のキャッシュ無効化を追加しました')
    else:
        print('3. パターンが見つかりませんでした（キャッシュ無効化）')
        idx = text2_lf.find('invalidateActivitiesCache(sellerId)')
        if idx >= 0:
            print('周辺テキスト:')
            print(repr(text2_lf[idx-50:idx+120]))
else:
    print('3. キャッシュ無効化はすでに存在します')

result2 = text2_lf.replace('\n', '\r\n')
with open(follow_ups_path, 'wb') as f:
    f.write(result2.encode('utf-8'))

print('followUps.ts 更新完了')
print('\n修正完了')
