# 設計書：売主サイドバー「訪問日前日」表示問題修正

## 📋 基本情報

**Spec ID**: seller-sidebar-visit-day-before-display-fix  
**Spec Type**: bugfix  
**Workflow Type**: requirements-first  
**作成日**: 2026年4月9日

---

## 🎯 設計の目的

売主リストのサイドバーに「訪問日前日２」という不正なカテゴリーが表示される問題を修正し、正しく「①訪問日前日」のみが表示されるようにする。

---

## 🔍 技術的背景

### 現在のアーキテクチャ

#### フロントエンド
- **ファイル**: `frontend/frontend/src/components/SellerStatusSidebar.tsx`
- **役割**: サイドバーUIの表示とカテゴリーボタンのレンダリング
- **カテゴリー定義**: `getCategoryLabel()`関数でカテゴリー名を取得

#### バックエンド
- **ファイル**: `backend/src/services/SellerService.supabase.ts`
- **メソッド**: `getSidebarCounts()`
- **役割**: `seller_sidebar_counts`テーブルからカウントを取得

#### フィルタリングロジック
- **ファイル**: `frontend/frontend/src/utils/sellerStatusFilters.ts`
- **関数**: `isVisitDayBefore()`
- **役割**: 売主が訪問日前日の条件を満たすか判定

### 訪問日前日の判定条件

```typescript
export const isVisitDayBefore = (seller: Seller | any): boolean => {
  // 1. 営担（visitAssignee）に入力がある
  if (!hasVisitAssignee(seller)) return false;
  
  // 2. 訪問日（visitDate）が存在する
  let visitDate = seller.visitDate || seller.visit_date;
  if (!visitDate) return false;
  
  // 3. visitReminderAssigneeが空（通知担当が未割り当て）
  const visitReminderAssignee = seller.visitReminderAssignee || seller.visit_reminder_assignee || '';
  if (visitReminderAssignee.trim() !== '') return false;
  
  // 4. 今日が訪問日の前営業日である
  return isVisitDayBeforeUtil(String(visitDate), todayDate);
};
```

---

## 🐛 問題の分析

### 問題1: 「訪問日前日２」カテゴリーの出現

**調査結果**:
- コード内に「訪問日前日２」という文字列は存在しない
- `getCategoryLabel()`関数には`visitDayBefore`に対して「①訪問日前日」のみが定義されている
- バックエンドの`getSidebarCounts()`も`visitDayBefore`カテゴリーのみを返す

**仮説**:
1. **データベースの`seller_sidebar_counts`テーブルに不正なレコードが存在する**
   - `category = 'visitDayBefore'`のレコードが複数存在する可能性
   - `label`フィールドに「２」などの値が入っている可能性

2. **フロントエンドのカウント集計ロジックに問題がある**
   - 同じカテゴリーのレコードを重複してカウントしている可能性

### 問題2: カウント不一致（2件表示→1件実際）

**原因**:
- サイドバーのカウント: `seller_sidebar_counts`テーブルから取得
- 実際の表示: `isVisitDayBefore()`関数でフィルタリング

**不一致の原因**:
1. AA13888の訪問日が空欄なのに`seller_sidebar_counts`にカウントされている
2. `isVisitDayBefore()`関数は訪問日が空の場合`false`を返すため、実際には表示されない

### 問題3: 訪問日が空欄の売主が含まれる

**原因**:
- `seller_sidebar_counts`テーブルの更新ロジックが`isVisitDayBefore()`関数と一致していない
- 訪問日が空欄の売主を誤ってカウントしている

---

## 🎯 修正方針

### 修正1: `seller_sidebar_counts`テーブルのデータ整合性チェック

**目的**: 不正なレコードを特定して削除

**手順**:
1. `seller_sidebar_counts`テーブルで`category = 'visitDayBefore'`のレコードを確認
2. 重複レコードや不正な`label`フィールドを持つレコードを削除
3. AA13888が含まれているか確認し、訪問日が空欄の場合は削除

**SQL**:
```sql
-- 訪問日前日カテゴリーのレコードを確認
SELECT * FROM seller_sidebar_counts 
WHERE category = 'visitDayBefore';

-- 不正なレコードを削除（labelが空でない場合）
DELETE FROM seller_sidebar_counts 
WHERE category = 'visitDayBefore' 
AND label IS NOT NULL 
AND label != '';

-- 訪問日が空欄の売主を削除
DELETE FROM seller_sidebar_counts 
WHERE category = 'visitDayBefore' 
AND seller_id IN (
  SELECT id FROM sellers 
  WHERE visit_date IS NULL 
  OR visit_date = ''
);
```

### 修正2: サイドバーカウント更新ロジックの修正

**ファイル**: `backend/src/services/SellerSidebarCountsUpdateService.ts`

**目的**: `isVisitDayBefore()`関数と同じロジックでカウントを計算

**修正内容**:
```typescript
// 訪問日前日のカウント計算
const visitDayBeforeSellers = allSellers.filter(seller => {
  // 1. 営担がある
  if (!seller.visit_assignee || seller.visit_assignee.trim() === '') return false;
  
  // 2. 訪問日がある
  if (!seller.visit_date) return false;
  
  // 3. visitReminderAssigneeが空
  if (seller.visit_reminder_assignee && seller.visit_reminder_assignee.trim() !== '') return false;
  
  // 4. 今日が訪問日の前営業日である
  return isVisitDayBeforeUtil(seller.visit_date, todayDate);
});
```

### 修正3: フロントエンドのカテゴリー表示ロジックの確認

**ファイル**: `frontend/frontend/src/components/SellerStatusSidebar.tsx`

**確認事項**:
- `renderCategoryButton()`関数が`visitDayBefore`カテゴリーを1回のみレンダリングしているか
- `getCategoryLabel()`関数が正しく「①訪問日前日」を返しているか

**修正内容**（必要な場合）:
```typescript
// renderAllCategories()内で訪問日前日を1回のみレンダリング
{renderCategoryButton('visitDayBefore', '①訪問日前日', '#2e7d32')}
```

---

## 📊 データフロー

### 現在のフロー

```
1. バックエンド: seller_sidebar_countsテーブルからカウント取得
   ↓
2. フロントエンド: getSidebarCounts()でカウントを受け取る
   ↓
3. サイドバー: カウントを表示
   ↓
4. ユーザーがクリック
   ↓
5. フロントエンド: isVisitDayBefore()でフィルタリング
   ↓
6. 売主リスト表示
```

### 問題点

- **ステップ1**と**ステップ5**でロジックが一致していない
- `seller_sidebar_counts`に不正なデータが含まれている

### 修正後のフロー

```
1. バックエンド: isVisitDayBefore()と同じロジックでカウント計算
   ↓
2. seller_sidebar_countsテーブルに保存
   ↓
3. フロントエンド: getSidebarCounts()でカウントを受け取る
   ↓
4. サイドバー: カウントを表示（正確）
   ↓
5. ユーザーがクリック
   ↓
6. フロントエンド: isVisitDayBefore()でフィルタリング
   ↓
7. 売主リスト表示（カウントと一致）
```

---

## 🧪 テスト戦略

### 1. データベーステスト

**目的**: `seller_sidebar_counts`テーブルのデータ整合性を確認

**テストケース**:
```sql
-- TC1: visitDayBeforeカテゴリーのレコード数を確認
SELECT COUNT(*) FROM seller_sidebar_counts 
WHERE category = 'visitDayBefore';
-- 期待値: 1件のみ

-- TC2: labelフィールドが空であることを確認
SELECT * FROM seller_sidebar_counts 
WHERE category = 'visitDayBefore' 
AND (label IS NOT NULL AND label != '');
-- 期待値: 0件

-- TC3: 訪問日が空欄の売主が含まれていないことを確認
SELECT COUNT(*) FROM seller_sidebar_counts sc
JOIN sellers s ON sc.seller_id = s.id
WHERE sc.category = 'visitDayBefore'
AND (s.visit_date IS NULL OR s.visit_date = '');
-- 期待値: 0件
```

### 2. バックエンドテスト

**ファイル**: `backend/src/__tests__/seller-sidebar-visit-day-before-count.test.ts`

**テストケース**:
```typescript
describe('訪問日前日カウント', () => {
  test('訪問日が空欄の売主はカウントされない', async () => {
    const seller = {
      id: 'test-id',
      visit_assignee: 'Y',
      visit_date: null, // 訪問日が空欄
    };
    
    // カウント計算
    const count = await sellerService.getSidebarCounts();
    
    // AA13888がカウントに含まれていないことを確認
    expect(count.visitDayBefore).toBe(0);
  });
  
  test('訪問日前日の条件を満たす売主のみカウントされる', async () => {
    // テストデータを作成
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const seller = {
      id: 'test-id',
      visit_assignee: 'Y',
      visit_date: tomorrow.toISOString().split('T')[0],
      visit_reminder_assignee: null,
    };
    
    // カウント計算
    const count = await sellerService.getSidebarCounts();
    
    // 正しくカウントされることを確認
    expect(count.visitDayBefore).toBeGreaterThan(0);
  });
});
```

### 3. フロントエンドテスト

**ファイル**: `frontend/frontend/src/__tests__/SellerStatusSidebar.test.tsx`

**テストケース**:
```typescript
describe('SellerStatusSidebar', () => {
  test('「訪問日前日２」が表示されない', () => {
    const { container } = render(<SellerStatusSidebar {...props} />);
    const invalidCategory = screen.queryByText(/訪問日前日２/);
    expect(invalidCategory).toBeNull();
  });
  
  test('「①訪問日前日」のみが表示される', () => {
    const { container } = render(<SellerStatusSidebar {...props} />);
    const validCategory = screen.getByText('①訪問日前日');
    expect(validCategory).toBeInTheDocument();
  });
  
  test('カウントと表示件数が一致する', async () => {
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
});
```

---

## 📝 実装手順

### ステップ1: データベースの調査と修正

1. `seller_sidebar_counts`テーブルを確認
2. 不正なレコードを削除
3. AA13888の訪問日を確認

### ステップ2: バックエンドの修正

1. `SellerSidebarCountsUpdateService.ts`の訪問日前日カウント計算ロジックを修正
2. `isVisitDayBefore()`関数と同じ条件でフィルタリング
3. テストを実行して確認

### ステップ3: フロントエンドの確認

1. `SellerStatusSidebar.tsx`のカテゴリー表示ロジックを確認
2. 重複レンダリングがないか確認
3. テストを実行して確認

### ステップ4: 統合テスト

1. ローカル環境でサイドバーを表示
2. 「訪問日前日２」が表示されないことを確認
3. カウントと表示件数が一致することを確認

---

## 🚀 デプロイ計画

### デプロイ順序

1. **バックエンド**: `SellerSidebarCountsUpdateService.ts`の修正をデプロイ
2. **データベース**: 不正なレコードを削除
3. **フロントエンド**: 必要に応じて修正をデプロイ

### ロールバック計画

- バックエンドの修正が問題を引き起こした場合、前のバージョンに戻す
- データベースの削除操作は慎重に行い、バックアップを取得しておく

---

## 📚 関連ドキュメント

- `bugfix.md` - バグの詳細と再現手順
- `.kiro/steering/sidebar-status-definition.md` - サイドバーステータスの定義
- `.kiro/steering/seller-table-column-definition.md` - 売主テーブルのカラム定義

---

**最終更新日**: 2026年4月9日  
**作成者**: Kiro AI  
**ステータス**: 設計完了
