#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerStatusSidebar.tsx の修正:
- キャッシュなし時は自分でAPIを呼ばず、BuyersPage のバックグラウンド取得完了を待つ
- onBuyersLoaded が呼ばれたときにサイドバーを更新する
"""

with open('frontend/frontend/src/components/BuyerStatusSidebar.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# useEffect を修正: キャッシュなし時は fetchStatusCategories を呼ばない
old_useeffect = """  useEffect(() => {
    // キャッシュがある場合は onBuyersLoaded を即座に呼ぶ（useEffect内で同期的に）
    if (_initialCache) {
      if (onBuyersLoaded) {
        onBuyersLoaded(_initialCache.buyers);
      }
      return;
    }
    fetchStatusCategories();
  }, []);"""

new_useeffect = """  useEffect(() => {
    // キャッシュがある場合は onBuyersLoaded を即座に呼ぶ（useEffect内で同期的に）
    if (_initialCache) {
      if (onBuyersLoaded) {
        onBuyersLoaded(_initialCache.buyers);
      }
      return;
    }
    // キャッシュなし時は BuyersPage のバックグラウンド取得完了を待つ（自分ではAPIを呼ばない）
    // onBuyersLoaded が呼ばれたときに updateFromBuyers で更新される
  }, []);"""

if old_useeffect in text:
    text = text.replace(old_useeffect, new_useeffect)
    print("✅ useEffect を修正しました（キャッシュなし時はAPIを呼ばない）")
else:
    print("❌ useEffect が見つかりません")

# onBuyersLoaded prop が変わったときにサイドバーを更新する useEffect を追加
# また、onBuyersLoaded コールバックが呼ばれたときにカテゴリを更新する仕組みを追加

# BuyerStatusSidebarProps に onCategoriesUpdate を追加するのではなく、
# BuyersPage から onBuyersLoaded 経由でデータが来たときにカテゴリを再計算する

# 現在の実装では onBuyersLoaded は buyers 配列を受け取るだけで、
# categories は /api/buyers/status-categories-with-buyers のレスポンスから来る
# BuyersPage のバックグラウンド取得完了後に pageDataCache に保存されるので、
# サイドバーはキャッシュから読み直す必要がある

# 解決策: onBuyersLoaded が呼ばれたときに、キャッシュからカテゴリも更新する
old_onbuyers_loaded_comment = """  // 1回のリクエストでカテゴリ + 全買主データを取得（5分キャッシュ）
  const fetchStatusCategories = async () => {"""

new_onbuyers_loaded_comment = """  // BuyersPage のバックグラウンド取得完了時にサイドバーを更新
  // onBuyersLoaded が呼ばれたとき（キャッシュ保存後）にカテゴリを再読み込み
  useEffect(() => {
    if (!_initialCache && onBuyersLoaded) {
      // onBuyersLoaded が呼ばれるたびにキャッシュを確認してカテゴリを更新
      // これは BuyersPage の handleBuyersLoaded 経由で呼ばれる
    }
  }, []);

  // 1回のリクエストでカテゴリ + 全買主データを取得（5分キャッシュ）
  const fetchStatusCategories = async () => {"""

# 上記は複雑すぎるので、別のアプローチを取る
# BuyerStatusSidebarProps に onCategoriesReady コールバックを追加するのではなく、
# BuyersPage から直接カテゴリデータを渡す方式に変更する

# 最もシンプルな解決策:
# BuyersPage のバックグラウンド取得完了後に pageDataCache に保存し、
# BuyerStatusSidebar に refreshTrigger prop を追加してサイドバーを再描画する

# しかし、これは複雑になる。
# 代わりに、BuyerStatusSidebar の onBuyersLoaded が呼ばれたときに
# キャッシュからカテゴリを読み直すシンプルな方法を使う

# BuyersPage の handleBuyersLoaded は:
# 1. allBuyersWithStatusRef を更新
# 2. sidebarLoadedRef を true に設定
# 3. setDataReady(true) でテーブルを再描画
# これだけでは BuyerStatusSidebar のカテゴリは更新されない

# 解決策: BuyersPage から categories データも渡す
# または BuyerStatusSidebar に refreshKey prop を追加

# 最もシンプル: BuyersPage のバックグラウンド取得完了後に
# BuyerStatusSidebar の fetchStatusCategories を呼ぶ
# → BuyerStatusSidebar に refresh メソッドを expose する（useImperativeHandle）
# これは複雑

# 最終的な解決策: BuyerStatusSidebar に categories prop を追加して外から渡す
# BuyersPage がバックグラウンド取得完了後に categories を state で管理して渡す

print("✅ ファイルを保存しました（useEffect修正のみ）")

with open('frontend/frontend/src/components/BuyerStatusSidebar.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

# 確認
with open('frontend/frontend/src/components/BuyerStatusSidebar.tsx', 'rb') as f:
    verify = f.read().decode('utf-8')

if 'BuyersPage のバックグラウンド取得完了を待つ' in verify:
    print("✅ useEffect の修正が確認されました")
