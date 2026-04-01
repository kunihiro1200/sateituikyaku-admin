# バグ修正：物件リストサイドバーの「未完了」カウントが古いキャッシュで表示される

## 📋 バグの概要

**症状**:
1. BB14の「確認」フィールドを「未」→「済」に変更すると、サイドバーの「未完了：1」が即座に消える（正常）
2. 別のタブに移動して物件リストを再度開くと、「未完了：1」が再び表示される（バグ）
3. 「未完了」をクリックしても「データがありません」と表示される（サイドバーカウントとフィルタリング結果が不一致）

**影響範囲**:
- 物件リストページ（`/property-listings`）
- サイドバーの「未完了」カテゴリ

**発生条件**:
- 物件詳細ページで「確認」フィールドを「未」→「済」に変更
- 別のタブ（例: 売主リスト、買主リスト）に移動
- 物件リストページに戻る

---

## 🔍 根本原因

### 1. キャッシュの問題

**ファイル**: `frontend/frontend/src/store/pageDataCache.ts`

**問題**: 
- `pageDataCache.get(CACHE_KEYS.PROPERTY_LISTINGS)` が5分間有効なキャッシュを返す
- 「確認」フィールドを更新しても、キャッシュがクリアされない
- 別のタブに移動して戻ると、古いキャッシュデータが表示される

**現在の実装**:
```typescript
// frontend/frontend/src/pages/PropertyListingsPage.tsx (140-150行目)
const fetchAllData = async (forceRefresh = false) => {
  if (!forceRefresh) {
    const cached = pageDataCache.get<PropertyListing[]>(CACHE_KEYS.PROPERTY_LISTINGS);
    if (cached) {
      setAllListings(cached);  // ← 古いキャッシュが返される
      setIsLoadingAll(false);
      setLoading(false);
      return;
    }
  }
  // ...
};
```

### 2. sessionStorageフラグの問題

**ファイル**: `frontend/frontend/src/pages/PropertyListingsPage.tsx`

**問題**:
- `sessionStorage.setItem('propertyListingsNeedsRefresh', 'true')` が設定される
- `useEffect` で `propertyListingsNeedsRefresh` をチェックして `fetchAllData(true)` を実行
- しかし、**別のタブに移動すると `useEffect` が再実行されない**
- 物件リストページに戻ったときに、`useEffect` の依存配列が空 `[]` のため、再実行されない

**現在の実装**:
```typescript
// frontend/frontend/src/pages/PropertyListingsPage.tsx (108-137行目)
useEffect(() => {
  const needsRefresh = sessionStorage.getItem('propertyListingsNeedsRefresh');
  if (needsRefresh === 'true') {
    sessionStorage.removeItem('propertyListingsNeedsRefresh');
    fetchAllData(true); // ← これが実行されない
  } else {
    fetchAllData();
  }
  // ...
}, []); // ← 依存配列が空のため、コンポーネントマウント時のみ実行
```

---

## ✅ 修正方針

### 修正1: キャッシュを即座にクリアする

**ファイル**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**変更内容**:
- 「確認」フィールド更新時に、`pageDataCache.delete(CACHE_KEYS.PROPERTY_LISTINGS)` を呼び出す
- これにより、物件リストページに戻ったときに、キャッシュではなくAPIから最新データを取得する

**修正後のコード**:
```typescript
// frontend/frontend/src/pages/PropertyListingDetailPage.tsx (683-705行目)
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';

const handleUpdateConfirmation = async (value: '未' | '済') => {
  setConfirmationUpdating(true);
  try {
    await api.put(`/api/property-listings/${propertyNumber}/confirmation`, { confirmation: value });
    setConfirmation(value);
    setSnackbar({ open: true, message: `確認を「${value}」に更新しました`, severity: 'success' });
    
    // 物件リストのキャッシュをクリア（最重要）
    pageDataCache.delete(CACHE_KEYS.PROPERTY_LISTINGS);
    
    // 物件リストページに戻ったときに再取得するためのフラグを設定
    sessionStorage.setItem('propertyListingsNeedsRefresh', 'true');
    
    // 即座にサイドバーを更新するためのイベントを発火
    window.dispatchEvent(new CustomEvent('propertyConfirmationUpdated', { 
      detail: { propertyNumber, confirmation: value } 
    }));
  } catch (error: any) {
    setSnackbar({ open: true, message: error.response?.data?.error || '確認の更新に失敗しました', severity: 'error' });
  } finally {
    setConfirmationUpdating(false);
  }
};
```

### 修正2: useEffectの依存配列を修正（オプション）

**ファイル**: `frontend/frontend/src/pages/PropertyListingsPage.tsx`

**変更内容**:
- `useEffect` の依存配列に `location.pathname` を追加
- これにより、別のタブから物件リストページに戻ったときに、`useEffect` が再実行される

**修正後のコード**:
```typescript
// frontend/frontend/src/pages/PropertyListingsPage.tsx (108-137行目)
useEffect(() => {
  const needsRefresh = sessionStorage.getItem('propertyListingsNeedsRefresh');
  if (needsRefresh === 'true') {
    sessionStorage.removeItem('propertyListingsNeedsRefresh');
    fetchAllData(true);
  } else {
    fetchAllData();
  }

  // confirmation更新イベントをリッスン
  const handleConfirmationUpdate = (event: CustomEvent) => {
    const { propertyNumber, confirmation } = event.detail;
    
    // ローカルステートを即座に更新
    setAllListings(prevListings => 
      prevListings.map(listing => 
        listing.property_number === propertyNumber 
          ? { ...listing, confirmation } 
          : listing
      )
    );
  };

  window.addEventListener('propertyConfirmationUpdated', handleConfirmationUpdate as EventListener);
  
  return () => {
    window.removeEventListener('propertyConfirmationUpdated', handleConfirmationUpdate as EventListener);
  };
}, [location.pathname]); // ← location.pathnameを追加
```

---

## 🧪 テストケース

### テストケース1: 確認フィールド更新後、キャッシュがクリアされる

**手順**:
1. 物件リストページを開く
2. BB14の物件詳細ページを開く
3. 「確認」フィールドを「未」→「済」に変更
4. `pageDataCache.get(CACHE_KEYS.PROPERTY_LISTINGS)` を確認

**期待結果**:
- キャッシュが `undefined` になる

### テストケース2: 別のタブに移動して戻ると、最新データが表示される

**手順**:
1. 物件リストページを開く（「未完了：1」が表示される）
2. BB14の物件詳細ページを開く
3. 「確認」フィールドを「未」→「済」に変更
4. 売主リストページに移動
5. 物件リストページに戻る

**期待結果**:
- 「未完了：0」が表示される（カテゴリが非表示になる）

### テストケース3: 「未完了」をクリックしても「データがありません」と表示されない

**手順**:
1. 物件リストページを開く
2. BB14の「確認」フィールドを「未」→「済」に変更
3. 別のタブに移動して戻る
4. サイドバーの「未完了」をクリック

**期待結果**:
- 「未完了」カテゴリが表示されない（カウントが0のため）
- または、「データがありません」と表示されない

---

## 📝 実装タスク

### タスク1: キャッシュクリア処理を追加

**ファイル**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**変更内容**:
1. `pageDataCache` と `CACHE_KEYS` をインポート
2. `handleUpdateConfirmation` 関数内で `pageDataCache.delete(CACHE_KEYS.PROPERTY_LISTINGS)` を呼び出す

### タスク2: useEffectの依存配列を修正（オプション）

**ファイル**: `frontend/frontend/src/pages/PropertyListingsPage.tsx`

**変更内容**:
1. `useEffect` の依存配列に `location.pathname` を追加

### タスク3: テストを実行

**手順**:
1. 修正1を適用
2. ブラウザで動作確認
3. 修正2が必要か判断（修正1だけで解決する可能性が高い）

---

## 🎯 優先度

**最優先**: 修正1（キャッシュクリア処理）

**理由**:
- 修正1だけで問題が解決する可能性が高い
- 修正2は、修正1で解決しない場合のみ適用

---

## 📊 影響範囲

**変更ファイル**:
- `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`（必須）
- `frontend/frontend/src/pages/PropertyListingsPage.tsx`（オプション）

**影響するページ**:
- 物件リストページ（`/property-listings`）
- 物件詳細ページ（`/property-listings/:id`）

**影響する機能**:
- サイドバーの「未完了」カテゴリ
- 物件リストのキャッシュ

---

## ✅ 完了条件

- [x] BB14の「確認」フィールドを「未」→「済」に変更後、別のタブに移動して戻っても、「未完了：1」が表示されない
- [x] 「未完了」をクリックしても「データがありません」と表示されない
- [x] キャッシュが正しくクリアされる

---

## 🎯 最終的な解決策

### 真の根本原因

**useMemoの依存配列の不備**

`PropertySidebarStatus.tsx` の `statusList` useMemo が `listings` を依存配列に含めていなかったため、`listings` が変更されても `statusList` が再計算されず、古いカウントが表示され続けていた。

### 修正内容

**ファイル**: `frontend/frontend/src/components/PropertySidebarStatus.tsx`

**変更箇所**: 243行目

```typescript
// ❌ 修正前
const statusList = useMemo(() => {
  // ...
}, [statusCounts, generalMediationIncompleteCount]);

// ✅ 修正後
const statusList = useMemo(() => {
  // ...
}, [statusCounts, generalMediationIncompleteCount, listings]);
```

### 修正理由

1. `statusCounts` は `listings` に依存している
2. `statusList` は `statusCounts` に依存している
3. しかし、`statusList` の依存配列に `listings` が含まれていなかった
4. 結果として、`listings` が変更されても `statusList` が再計算されず、古い `statusCounts` を参照し続けていた

### テスト結果

✅ 「未完了：1」が正しく消えることを確認  
✅ データベースに0件の場合、サイドバーに表示されないことを確認  
✅ 本番環境で動作確認完了

---

## 📚 再発防止策

**ステアリングドキュメント作成**: `.kiro/steering/react-usememo-dependencies.md`

このドキュメントには以下のルールが記載されています：

1. **useMemo内で参照している全てのデータを依存配列に含める**
2. **別のuseMemoの結果を使用する場合、元のデータも依存配列に含める**
3. **ESLintの `react-hooks/exhaustive-deps` 警告を無視しない**

今後、useMemoを使用する際は、このステアリングドキュメントを参照してください。

---

**作成日**: 2026年4月1日  
**バグ発見日**: 2026年4月1日  
**修正完了日**: 2026年4月1日  
**優先度**: 高（ユーザー体験に直接影響）  
**修正コミット**: f238f572
