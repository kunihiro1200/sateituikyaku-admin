"""
SellersPage.tsx: 行クリック時に売主データを pageDataCache に保存（プリフェッチ）
CallModePage.tsx: loadAllData でキャッシュがあれば即座に表示
"""
import re

# ===== SellersPage.tsx の修正 =====
with open('frontend/frontend/src/pages/SellersPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. import に sellerDetailCacheKey を追加
old_import = "import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';"
new_import = "import { pageDataCache, CACHE_KEYS, sellerDetailCacheKey } from '../store/pageDataCache';"
text = text.replace(old_import, new_import)

# 2. 行クリック時にキャッシュ保存を追加
old_click = """                    onClick={() => {
                      // スクロール位置と売主IDを保存
                      sessionStorage.setItem('sellersScrollPosition', window.scrollY.toString());
                      sessionStorage.setItem('selectedSellerId', seller.id);
                      navigate(`/sellers/${seller.id}/call`);
                    }}"""
new_click = """                    onClick={() => {
                      // スクロール位置と売主IDを保存
                      sessionStorage.setItem('sellersScrollPosition', window.scrollY.toString());
                      sessionStorage.setItem('selectedSellerId', seller.id);
                      // 一覧で取得済みの売主データをキャッシュに保存（通話モードページのプリフェッチ用）
                      // CallModePage.tsx でこのキャッシュを使えば /api/sellers/:id の待ち時間をゼロにできる
                      pageDataCache.set(sellerDetailCacheKey(seller.id), seller, 30 * 1000); // 30秒TTL
                      navigate(`/sellers/${seller.id}/call`);
                    }}"""
text = text.replace(old_click, new_click)

with open('frontend/frontend/src/pages/SellersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('SellersPage.tsx: 修正完了')

# ===== CallModePage.tsx の修正 =====
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. import に pageDataCache と sellerDetailCacheKey を追加
# 既存の import 行を探す
if "from '../store/pageDataCache'" not in text:
    # useCallModeQuickButtonState の import の後に追加
    old_import_anchor = "import { useCallModeQuickButtonState } from '../hooks/useCallModeQuickButtonState';"
    new_import_anchor = """import { useCallModeQuickButtonState } from '../hooks/useCallModeQuickButtonState';
import { pageDataCache, sellerDetailCacheKey } from '../store/pageDataCache';"""
    text = text.replace(old_import_anchor, new_import_anchor)
    print('CallModePage.tsx: import 追加')
else:
    print('CallModePage.tsx: pageDataCache は既にインポート済み')

# 2. loadAllData の先頭でキャッシュチェックを追加
old_load_start = """  const loadAllData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('=== loadAllData開始 ===');
      console.log('売主ID:', id);
      
      // 売主データだけ先に取得して即座に画面表示
      // employees と property はバックグラウンドで並列取得（画面表示をブロックしない）
      const sellerResponse = await api.get(`/api/sellers/${id}`);

      // 売主情報を設定
      const sellerData = sellerResponse.data;"""

new_load_start = """  const loadAllData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('=== loadAllData開始 ===');
      console.log('売主ID:', id);
      
      // 一覧ページから遷移した場合、pageDataCache に売主データが既にある可能性がある
      // キャッシュがあれば即座に画面表示（/api/sellers/:id の待ち時間をゼロにする）
      const cachedSeller = id ? pageDataCache.get(sellerDetailCacheKey(id)) : null;
      
      let sellerData: any;
      if (cachedSeller) {
        console.log('[PERF] loadAllData: キャッシュヒット（一覧ページのプリフェッチデータを使用）');
        sellerData = cachedSeller;
        // キャッシュを使って即座に表示しつつ、バックグラウンドで最新データを取得
        api.get(`/api/sellers/${id}`).then((freshResponse) => {
          const freshData = freshResponse.data;
          if (freshData && freshData.id) {
            // 最新データでキャッシュを更新
            pageDataCache.set(sellerDetailCacheKey(id!), freshData, 30 * 1000);
            // 売主データを更新（ローディングなしで静かに更新）
            setSeller(freshData);
            setUnreachableStatus(freshData.unreachableStatus || null);
          }
        }).catch(() => {
          // バックグラウンド更新失敗は無視
        });
      } else {
        // キャッシュなし → 通常通り API を呼び出す
        // 売主データだけ先に取得して即座に画面表示
        // employees と property はバックグラウンドで並列取得（画面表示をブロックしない）
        const sellerResponse = await api.get(`/api/sellers/${id}`);
        sellerData = sellerResponse.data;
      }

      // 売主情報を設定
      // （cachedSeller の場合は上で既に設定済みだが、以下で再設定して状態を初期化する）"""

text = text.replace(old_load_start, new_load_start)

# 3. sellerResponse.data の参照を sellerData に変更（既に変数名は sellerData なので不要）
# ただし「const sellerData = sellerResponse.data;」の行が残っているので削除
old_redundant = """      // 売主情報を設定
      const sellerData = sellerResponse.data;
      
      // 売主データが存在することを確認"""
new_redundant = """      // 売主データが存在することを確認"""
text = text.replace(old_redundant, new_redundant)

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('CallModePage.tsx: 修正完了')
print('完了！')
