#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyersPage.tsx のプログレッシブローディング実装
- 初回表示時: /api/buyers?page=1&limit=50 で最初の50件を即座に表示
- バックグラウンドで /api/buyers/status-categories-with-buyers を取得
- 全件取得完了後にキャッシュ保存＆サイドバー更新
"""

import re

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# fetchBuyers の「サイドバー未ロード時のみAPIから取得」部分を修正
# 現在のコード（サイドバー未ロード時）:
old_fallback = """        // サイドバー未ロード時のみAPIから取得（初回表示用）
        setLoading(true);
        const params: any = {
          page: page + 1,
          limit: rowsPerPage,
          sortBy: 'reception_date',
          sortOrder: 'desc',
        };
        if (debouncedSearch) params.search = normalizeSearch(debouncedSearch);

        const res = await api.get('/api/buyers', { params });
        if (!cancelled) {
          setBuyers(res.data.data || []);
          setTotal(res.data.total || 0);
        }"""

new_fallback = """        // サイドバー未ロード時: まず最初の50件を即座に表示（プログレッシブローディング）
        setLoading(true);
        const quickParams: any = {
          page: 1,
          limit: 50,
          sortBy: 'reception_date',
          sortOrder: 'desc',
        };
        if (debouncedSearch) quickParams.search = normalizeSearch(debouncedSearch);

        // 最初の50件を即座に表示
        const quickRes = await api.get('/api/buyers', { params: quickParams });
        if (!cancelled) {
          setBuyers(quickRes.data.data || []);
          setTotal(quickRes.data.total || 0);
          setLoading(false);
        }

        // バックグラウンドで全件取得（キャッシュ保存＆サイドバー更新）
        if (!sidebarLoadedRef.current) {
          api.get('/api/buyers/status-categories-with-buyers').then((res) => {
            if (cancelled) return;
            const result = res.data as {
              categories: any[];
              buyers: BuyerWithStatus[];
              normalStaffInitials: string[];
            };
            // 5分間キャッシュ
            pageDataCache.set(CACHE_KEYS.BUYERS_WITH_STATUS, result, 5 * 60 * 1000);
            // サイドバーを更新（handleBuyersLoaded経由）
            if (onBuyersLoadedRef.current) {
              onBuyersLoadedRef.current(result.buyers);
            }
          }).catch((err) => {
            console.error('Background fetch failed:', err);
          });
        }"""

if old_fallback in text:
    text = text.replace(old_fallback, new_fallback)
    print("✅ fetchBuyers のフォールバック部分を修正しました")
else:
    print("❌ 対象コードが見つかりません")
    # デバッグ用に周辺コードを表示
    idx = text.find("サイドバー未ロード時のみAPIから取得")
    if idx >= 0:
        print(f"周辺コード:\n{text[idx-100:idx+500]}")

# handleBuyersLoaded を ref 経由で参照できるようにする
# useRef<(buyers: BuyerWithStatus[]) => void> を追加
old_ref_section = """  // sidebarLoadedをrefで管理（stateにするとonBuyersLoaded呼び出しのたびにfetchBuyersが再実行される）
  const sidebarLoadedRef = useRef<boolean>(!!cachedData);"""

new_ref_section = """  // sidebarLoadedをrefで管理（stateにするとonBuyersLoaded呼び出しのたびにfetchBuyersが再実行される）
  const sidebarLoadedRef = useRef<boolean>(!!cachedData);
  // バックグラウンド取得完了時にhandleBuyersLoadedを呼ぶためのref
  const onBuyersLoadedRef = useRef<((buyers: BuyerWithStatus[]) => void) | null>(null);"""

if old_ref_section in text:
    text = text.replace(old_ref_section, new_ref_section)
    print("✅ onBuyersLoadedRef を追加しました")
else:
    print("❌ ref セクションが見つかりません")

# handleBuyersLoaded の定義後に onBuyersLoadedRef を更新
old_handle = """  const handleBuyersLoaded = (buyers: BuyerWithStatus[]) => {
    allBuyersWithStatusRef.current = buyers;
    if (!sidebarLoadedRef.current) {
      // 初回ロード時のみdataReadyをtrueにしてfetchBuyersをトリガー
      sidebarLoadedRef.current = true;
      setDataReady(true);
    }
    // 既にロード済みの場合はrefのみ更新（再レンダリング不要）
  };"""

new_handle = """  const handleBuyersLoaded = (buyers: BuyerWithStatus[]) => {
    allBuyersWithStatusRef.current = buyers;
    if (!sidebarLoadedRef.current) {
      // 初回ロード時のみdataReadyをtrueにしてfetchBuyersをトリガー
      sidebarLoadedRef.current = true;
      setDataReady(true);
    }
    // 既にロード済みの場合はrefのみ更新（再レンダリング不要）
  };

  // handleBuyersLoaded を ref に保持（バックグラウンド取得完了時に呼ぶため）
  onBuyersLoadedRef.current = handleBuyersLoaded;"""

if old_handle in text:
    text = text.replace(old_handle, new_handle)
    print("✅ onBuyersLoadedRef の更新コードを追加しました")
else:
    print("❌ handleBuyersLoaded が見つかりません")

# cancelled 変数をバックグラウンド取得でも使えるように
# fetchBuyers の finally ブロックを修正（setLoading(false) が重複しないように）
old_finally = """      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }"""

new_finally = """      } catch (bgError) {
        // バックグラウンド取得のエラーは上で処理済み
      }"""

# finally ブロックは既に setLoading(false) を上に移動したので削除
# ただし try-catch 構造を維持する必要がある
# 実際には fetchBuyers 全体の try-catch の finally を確認

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n✅ ファイルを保存しました")

# 確認
with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    verify = f.read().decode('utf-8')

if 'バックグラウンドで全件取得' in verify:
    print("✅ プログレッシブローディングのコードが正しく挿入されています")
if 'onBuyersLoadedRef' in verify:
    print("✅ onBuyersLoadedRef が追加されています")
