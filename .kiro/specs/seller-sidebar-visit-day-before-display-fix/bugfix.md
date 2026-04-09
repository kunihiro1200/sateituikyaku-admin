# バグ修正仕様書：売主サイドバー「訪問日前日」表示問題

## 📋 バグ概要

**バグID**: seller-sidebar-visit-day-before-display-fix  
**発見日**: 2026年4月9日  
**重要度**: 高  
**影響範囲**: 売主リストページのサイドバーカテゴリー表示

## 🐛 バグの症状

### 問題1: 「訪問日前日２」という不正なカテゴリーが表示される
- サイドバーに「訪問日前日２」というカテゴリーが表示されている
- 正しくは「①訪問日前日」のみが表示されるべき

### 問題2: 表示位置が不適切
- 「訪問日前日２」が下部の「専任、一般」等と同じエリアに表示されている
- 本来は上位（優先度の高いカテゴリー）に表示されるべき

### 問題3: クリック時の件数不一致と不正なデータ表示
- カテゴリーには「2件」と表示されている
- クリックすると1件のみ表示される
- 表示される売主（AA13888）の訪問日が空欄になっている

## 🔍 バグ条件（Bug Condition C(X)）

以下の条件を満たす場合にバグが発生する：

```typescript
function bugCondition(seller: Seller, sidebarState: SidebarState): boolean {
  // 条件1: 「訪問日前日２」というカテゴリーが存在する
  const hasInvalidCategory = sidebarState.categories.some(
    cat => cat.name === '訪問日前日２' || cat.name.includes('訪問日前日２')
  );
  
  // 条件2: カテゴリーの表示件数とクリック時の表示件数が一致しない
  const countMismatch = sidebarState.categories.some(cat => {
    if (cat.name.includes('訪問日前日')) {
      return cat.displayCount !== cat.actualCount;
    }
    return false;
  });
  
  // 条件3: 訪問日が空欄の売主が「訪問日前日」カテゴリーに表示される
  const hasInvalidSeller = seller.visitDate === null && 
                           seller.isInCategory('visitDayBefore');
  
  return hasInvalidCategory || countMismatch || hasInvalidSeller;
}
```

## 📊 再現手順

1. 売主リストページ（`/sellers`）を開く
2. 左側のサイドバーを確認する
3. 「訪問日前日２」というカテゴリーが表示されることを確認
4. 「訪問日前日２」をクリックする
5. 1件のみ表示され、AA13888の訪問日が空欄であることを確認

## 🎯 期待される動作

### 正しい表示
1. サイドバーには「①訪問日前日」のみが表示される（「訪問日前日２」は表示されない）
2. 「①訪問日前日」は上位（優先度の高いエリア）に表示される
3. カテゴリーの件数表示とクリック時の表示件数が一致する
4. 訪問日が空欄の売主は「訪問日前日」カテゴリーに表示されない

### 正しいカテゴリー表示順序
```
All
当日TEL_未着手
未査定
当日TEL分
当日TEL（内容）
担当(Y) ← 動的生成
  ↳ 当日TEL(Y)
--- 区切り線 ---
①訪問日前日 ← ここに表示されるべき
査定（郵送）
Pinrich空欄
専任
一般
訪問後他決
未訪問他決
```

## 🔬 根本原因の仮説

### 仮説1: カテゴリー名の重複定義
- `getCategoryLabel()`関数で「訪問日前日」が複数回定義されている可能性
- または、異なるカテゴリーキー（`visitDayBefore`, `visitDayBefore2`等）が存在する

### 仮説2: バックエンドのカウント計算ロジックの問題
- `SellerService.getSidebarCounts()`で訪問日前日のカウントが重複計算されている
- または、異なるロジックで2つのカウントが返されている

### 仮説3: フィルタリングロジックの不一致
- サイドバーのカウント計算と実際の売主フィルタリングで異なるロジックが使用されている
- `isVisitDayBefore()`関数が正しく動作していない

### 仮説4: 訪問日が空欄の売主が誤って含まれている
- AA13888の訪問日が空欄なのに「訪問日前日」カテゴリーに含まれている
- `isVisitDayBefore()`関数が`visitDate === null`のケースを正しく除外していない

## 📁 関連ファイル

### フロントエンド
- `frontend/frontend/src/components/SellerStatusSidebar.tsx` - サイドバーコンポーネント
- `frontend/frontend/src/utils/sellerStatusFilters.ts` - `isVisitDayBefore()`関数
- `frontend/frontend/src/pages/SellersPage.tsx` - 売主リストページ

### バックエンド
- `backend/src/services/SellerService.supabase.ts` - `getSidebarCounts()`メソッド
- `backend/src/routes/sellers.ts` - `/api/sellers/sidebar-counts`エンドポイント

## 🧪 テストケース

### テストケース1: 「訪問日前日２」が表示されない
```typescript
test('サイドバーに「訪問日前日２」が表示されない', () => {
  const { container } = render(<SellerStatusSidebar {...props} />);
  const invalidCategory = screen.queryByText(/訪問日前日２/);
  expect(invalidCategory).toBeNull();
});
```

### テストケース2: 「①訪問日前日」のみが表示される
```typescript
test('サイドバーに「①訪問日前日」のみが表示される', () => {
  const { container } = render(<SellerStatusSidebar {...props} />);
  const validCategory = screen.getByText('①訪問日前日');
  expect(validCategory).toBeInTheDocument();
});
```

### テストケース3: カウントと表示件数が一致する
```typescript
test('カテゴリーのカウントとクリック時の表示件数が一致する', async () => {
  const { container } = render(<SellerStatusSidebar {...props} />);
  const category = screen.getByText('①訪問日前日');
  const countChip = category.parentElement?.querySelector('.MuiChip-label');
  const displayCount = parseInt(countChip?.textContent || '0');
  
  fireEvent.click(category);
  await waitFor(() => {
    const sellers = screen.getAllByTestId('seller-item');
    expect(sellers.length).toBe(displayCount);
  });
});
```

### テストケース4: 訪問日が空欄の売主は表示されない
```typescript
test('訪問日が空欄の売主は「訪問日前日」カテゴリーに表示されない', () => {
  const sellerWithoutVisitDate = {
    id: 'AA13888',
    visitDate: null,
    visitAssignee: 'Y',
  };
  
  const result = isVisitDayBefore(sellerWithoutVisitDate);
  expect(result).toBe(false);
});
```

## 🎯 修正の方向性

### 修正1: カテゴリー名の統一
- `SellerStatusSidebar.tsx`の`getCategoryLabel()`を確認
- 「訪問日前日２」の定義を削除
- 「①訪問日前日」のみを使用

### 修正2: バックエンドのカウント計算を修正
- `SellerService.getSidebarCounts()`を確認
- 訪問日前日のカウントが重複していないか確認
- 正しいフィルタリングロジックを適用

### 修正3: フィルタリングロジックの統一
- `isVisitDayBefore()`関数を確認
- `visitDate === null`のケースを明示的に除外
- サイドバーのカウント計算と実際のフィルタリングで同じロジックを使用

### 修正4: 表示位置の修正
- `SellerStatusSidebar.tsx`の`renderAllCategories()`を確認
- 「①訪問日前日」を上位（優先度の高いエリア）に移動

## 📝 備考

- AA13888の訪問日が空欄なのに「訪問日前日」カテゴリーに表示されるのは明らかなバグ
- 「訪問日前日２」という名前から、何らかの重複定義または計算ロジックの問題が疑われる
- カウント不一致（2件表示→1件実際）は、フィルタリングロジックの不一致を示唆

---

**作成日**: 2026年4月9日  
**作成者**: システム  
**ステータス**: 調査中
