#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
updateSeller に invalidateSellerCache を追加する。
"""

file_path = 'backend/src/services/SellerService.supabase.ts'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')
text = text.replace('\r\n', '\n')

old_cache_invalidate = '''    // キャッシュを無効化
    await CacheHelper.del(CacheHelper.generateKey('seller', sellerId));
    await CacheHelper.delPattern('sellers:list:*');
    // サイドバーカウントキャッシュも無効化（売主データ変更により集計が変わる可能性があるため）
    await CacheHelper.del('sellers:sidebar-counts');'''

new_cache_invalidate = '''    // キャッシュを無効化（インメモリ + Redis）
    invalidateSellerCache(sellerId); // インメモリキャッシュを即座に無効化
    await CacheHelper.del(CacheHelper.generateKey('seller', sellerId));
    await CacheHelper.delPattern('sellers:list:*');
    // サイドバーカウントキャッシュも無効化（売主データ変更により集計が変わる可能性があるため）
    await CacheHelper.del('sellers:sidebar-counts');'''

if old_cache_invalidate in text:
    text = text.replace(old_cache_invalidate, new_cache_invalidate)
    print('✅ updateSeller に invalidateSellerCache を追加しました')
else:
    print('❌ キャッシュ無効化ブロックが見つかりません')
    import sys
    sys.exit(1)

# CRLF に戻す
text = text.replace('\n', '\r\n')

with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')
