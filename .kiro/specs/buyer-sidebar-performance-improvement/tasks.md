# 買主リストサイドバー表示速度改善 - タスクリスト

## タスク概要

売主リストの成功パターンを買主リストに適用し、サイドバーの初回表示を1秒以内に完了させます。

**重要**: GASコードとバックエンドAPIは既に実装済みのため、フロントエンドの並列取得ロジックの最適化のみを行います。

---

## Phase 1: 事前確認（変更なし）

### 1.1 GASコードの確認
- [ ] `gas_buyer_complete_code.js`に`updateBuyerSidebarCounts_()`関数が存在することを確認
- [ ] GASの10分トリガーが設定されていることを確認
- [ ] `buyer_sidebar_counts`テーブルにデータが保存されていることを確認

**確認方法**:
```bash
# データベースを確認
npx ts-node backend/check-buyer-sidebar-counts-table.ts
```

**期待される結果**:
```
✅ viewingDayBefore: 2 records
✅ todayCall: 5 records
✅ todayCallAssigned: 5 records (Y: 3, I: 2)
✅ assigned: 2 records (Y: 150, I: 200)
```

**🚨 重要**: GASコードは絶対に変更しない

---

### 1.2 バックエンドAPIの確認
- [ ] `/api/buyers/sidebar-counts`エンドポイントが存在することを確認
- [ ] `BuyerService.getSidebarCounts()`メソッドが実装されていることを確認
- [ ] `BuyerService.getSidebarCountsFallback()`メソッドが実装されていることを確認

**確認方法**:
```bash
# エンドポイントを確認
curl http://localhost:3000/api/buyers/sidebar-counts
```

**期待される結果**:
```json
{
  "categoryCounts": {
    "viewingDayBefore": 2,
    "todayCall": 5,
    "todayCallAssigned": { "Y": 3, "I": 2 },
    "assigned": { "Y": 150, "I": 200 }
  },
  "normalStaffInitials": ["Y", "I", "外す"]
}
```

**🚨 重要**: バックエンドAPIは既に実装済み・変更不要

---

## Phase 2: フロントエンドの並列取得ロジック実装

### 2.1 SellersPage.tsxの並列取得ロジックをコピー
- [ ] `frontend/src/pages/SellersPage.tsx`の`useEffect`内の並列取得ロジックをコピー
- [ ] `frontend/src/pages/BuyersPage.tsx`に貼り付け

**コピー元**:
```typescript
// frontend/src/pages/SellersPage.tsx
useEffect(() => {
  let cancelled = false;

  const fetchSellers = async () => {
    try {
      // サイドバーデータ読み込み済みの場合はフロント側でフィルタリング（APIコール不要）
      if (sidebarLoadedRef.current && allSellersWithStatusRef.current.length > 0) {
        // フィルタリング処理
        // ...
        return;
      }

      // サイドバー未ロード時: まず最初の50件を即座に表示（プログレッシブローディング）
      setLoading(true);
      const quickParams: any = {
        page: 1,
        limit: 50,
        sortBy: 'inquiry_date',
        sortOrder: 'desc',
      };
      if (debouncedSearch) quickParams.search = normalizeSearch(debouncedSearch);

      // 最初の50件を即座に表示
      const quickRes = await api.get('/api/sellers', { params: quickParams });
      if (!cancelled) {
        setSellers(quickRes.data.data || []);
        setTotal(quickRes.data.total || 0);
        setLoading(false);
      }

      // バックグラウンドでサイドバーカウントと全件データを並列取得
      if (!sidebarLoadedRef.current) {
        Promise.all([
          api.get('/api/sellers/sidebar-counts'),
          api.get('/api/sellers/status-categories-with-sellers')
        ]).then(([sidebarRes, sellersRes]) => {
          if (cancelled) return;
          const sidebarResult = sidebarRes.data;
          const sellersResult = sellersRes.data;
          
          // キャッシュデータを構築
          const cacheData = {
            categoryCounts: sidebarResult.categoryCounts,
            sellers: sellersResult.sellers,
            normalStaffInitials: sidebarResult.normalStaffInitials || sellersResult.normalStaffInitials || []
          };
          
          // 10分間キャッシュ
          pageDataCache.set(CACHE_KEYS.SELLERS_WITH_STATUS, cacheData, 10 * 60 * 1000);
          
          // サイドバーのカウントを更新
          setSidebarCounts(sidebarResult.categoryCounts);
          setSidebarNormalStaffInitials(sidebarResult.normalStaffInitials || sellersResult.normalStaffInitials || []);
          setSidebarLoading(false);
          
          // テーブルも全件データで更新
          allSellersWithStatusRef.current = sellersResult.sellers;
          sidebarLoadedRef.current = true;
          setDataReady(prev => !prev);
        }).catch((err) => {
          console.error('Background fetch failed:', err);
          setSidebarLoading(false);
        });
      }
    } catch (error) {
      if (!cancelled) {
        console.error('Failed to fetch sellers:', error);
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  };

  fetchSellers();
  return () => { cancelled = true; };
}, [page, rowsPerPage, debouncedSearch, selectedCalculatedStatus, refetchTrigger, dataReady]);
```

**🚨 重要**: 上記のコードをそのままコピーする

---

### 2.2 変数名とエンドポイントを置換
- [ ] `sellers` → `buyers`に置換
- [ ] `Sellers` → `Buyers`に置換
- [ ] `CACHE_KEYS.SELLERS_WITH_STATUS` → `CACHE_KEYS.BUYERS_WITH_STATUS`に置換
- [ ] `/api/sellers/*` → `/api/buyers/*`に置換
- [ ] `allSellersWithStatusRef` → `allBuyersWithStatusRef`に置換

**置換例**:
```typescript
// 変更前
const quickRes = await api.get('/api/sellers', { params: quickParams });
setSellers(quickRes.data.data || []);
pageDataCache.set(CACHE_KEYS.SELLERS_WITH_STATUS, cacheData, 10 * 60 * 1000);

// 変更後
const quickRes = await api.get('/api/buyers', { params: quickParams });
setBuyers(quickRes.data.data || []);
pageDataCache.set(CACHE_KEYS.BUYERS_WITH_STATUS, cacheData, 10 * 60 * 1000);
```

**🚨 重要**: 機械的に置換する（ロジックは変更しない）

---

### 2.3 必要な変数とrefを追加
- [ ] `allBuyersWithStatusRef`を追加
- [ ] `sidebarLoadedRef`を追加
- [ ] `dataReady`を追加

**追加コード**:
```typescript
// frontend/src/pages/BuyersPage.tsx
const allBuyersWithStatusRef = useRef<BuyerWithStatus[]>([]);
const sidebarLoadedRef = useRef<boolean>(false);
const [dataReady, setDataReady] = useState(false);
```

**🚨 重要**: 売主リストと同じ変数名を使用する

---

### 2.4 キャッシュキーを追加
- [ ] `CACHE_KEYS.BUYERS_WITH_STATUS`を`pageDataCache.ts`に追加

**追加コード**:
```typescript
// frontend/src/store/pageDataCache.ts
export const CACHE_KEYS = {
  // ... 既存のキー
  BUYERS_WITH_STATUS: 'buyers_with_status',
};
```

**🚨 重要**: 売主リストと同じ形式のキーを使用する

---

## Phase 3: テスト

### 3.1 ローカル環境でテスト
- [ ] ローカル環境で買主リストページを開く
- [ ] サイドバーカウントが1秒以内に表示されることを確認
- [ ] DevToolsのNetworkタブでAPIリクエストを確認
  - [ ] `/api/buyers/sidebar-counts`が先に完了すること
  - [ ] `/api/buyers/status-categories-with-buyers`がバックグラウンドで実行されること
- [ ] カテゴリー展開時に詳細データが表示されることを確認

**確認方法**:
1. ブラウザで`http://localhost:5173/buyers`を開く
2. DevToolsのNetworkタブを開く
3. ページをリロード
4. APIリクエストのタイミングを確認

**期待される結果**:
```
/api/buyers/sidebar-counts: 200ms（先に完了）
  ↓
サイドバー表示完了 ✅
  ↓
/api/buyers/status-categories-with-buyers: 2000ms（バックグラウンド）
  ↓
カテゴリー展開可能 ✅
```

---

### 3.2 キャッシュの動作確認
- [ ] 2回目のアクセスでキャッシュが使用されることを確認
- [ ] キャッシュヒット時にAPIリクエストが発生しないことを確認

**確認方法**:
1. 買主リストページを開く
2. 別のページに移動
3. 再度買主リストページを開く
4. DevToolsのNetworkタブで`/api/buyers/sidebar-counts`が呼ばれないことを確認

**期待される結果**:
```
1回目: /api/buyers/sidebar-counts が呼ばれる
2回目: キャッシュから取得（APIリクエストなし）
```

---

### 3.3 エラーハンドリングの確認
- [ ] `buyer_sidebar_counts`テーブルが空の場合、フォールバックが動作することを確認
- [ ] APIエラー時にカウントが0にリセットされることを確認

**確認方法**:
```bash
# buyer_sidebar_countsテーブルを空にする
npx ts-node backend/clear-buyer-sidebar-counts-table.ts

# ブラウザで買主リストページを開く
# → フォールバック処理が動作することを確認
```

**期待される結果**:
```
⚠️ buyer_sidebar_counts empty or error, falling back to DB query
✅ フォールバック処理が動作
✅ サイドバーカウントが表示される
```

---

## Phase 4: デプロイ

### 4.1 コミット
- [ ] 変更をコミット

**コミットメッセージ**:
```bash
git add .
git commit -m "feat: 買主リストサイドバー表示速度改善（売主リストの成功パターンを適用）

- SellersPage.tsxの並列取得ロジックをBuyersPage.tsxにコピー
- サイドバーカウントを先に表示（プログレッシブローディング）
- 全買主データの取得をバックグラウンドで実行
- 初回ロードが1秒以内に完了

Refs: .kiro/specs/buyer-sidebar-performance-improvement/"
```

---

### 4.2 プッシュ
- [ ] mainブランチにプッシュ

**プッシュコマンド**:
```bash
git push origin main
```

**🚨 重要**: Git連携により自動デプロイされる

---

### 4.3 本番環境で確認
- [ ] 本番環境で買主リストページを開く
- [ ] サイドバーカウントが1秒以内に表示されることを確認
- [ ] カテゴリー展開時に詳細データが表示されることを確認

**確認URL**: `https://sateituikyaku-admin-frontend.vercel.app/buyers`

**期待される結果**:
```
✅ サイドバーカウントが1秒以内に表示される
✅ カテゴリー展開時に詳細データが表示される
✅ 2回目以降のアクセスが高速（キャッシュ）
```

---

## Phase 5: ドキュメント更新

### 5.1 READMEを更新
- [ ] 買主リストサイドバーの表示速度改善を記録

**更新内容**:
```markdown
## 買主リストサイドバー表示速度改善（2026年4月5日）

売主リストの成功パターンを買主リストに適用し、サイドバーの初回表示を1秒以内に完了させました。

**改善内容**:
- サイドバーカウントを先に表示（プログレッシブローディング）
- 全買主データの取得をバックグラウンドで実行
- 初回ロードが1秒以内に完了

**参考**: `.kiro/specs/buyer-sidebar-performance-improvement/`
```

---

## チェックリスト

### 実装前の確認
- [ ] GASコードが既に実装済みであることを確認
- [ ] バックエンドAPIが既に実装済みであることを確認
- [ ] `buyer_sidebar_counts`テーブルにデータが保存されていることを確認

### 実装中の確認
- [ ] 売主リストのコードをそのままコピーしたか
- [ ] 変数名とエンドポイントを機械的に置換したか
- [ ] ロジックを変更していないか

### 実装後の確認
- [ ] ローカル環境でテストしたか
- [ ] サイドバーカウントが1秒以内に表示されるか
- [ ] キャッシュが正しく動作するか
- [ ] エラーハンドリングが正しく動作するか

### デプロイ後の確認
- [ ] 本番環境でテストしたか
- [ ] サイドバーカウントが1秒以内に表示されるか
- [ ] カテゴリー展開時に詳細データが表示されるか

---

**最終更新日**: 2026年4月5日  
**作成理由**: 買主リストサイドバーの表示速度を改善し、売主リストと同じ高速表示を実現するため
