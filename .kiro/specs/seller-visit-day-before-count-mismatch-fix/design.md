# 売主リスト「訪問日前日」カテゴリのカウント不一致修正 - 設計書

## 問題の根本原因

### 現状の実装

#### フロントエンド（一覧のフィルタリング）

**ファイル**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

**関数**: `isVisitDayBefore()`

```typescript
export const isVisitDayBefore = (seller: Seller | any): boolean => {
  if (!hasVisitAssignee(seller)) return false;
  
  let visitDate = seller.visitDate || seller.visit_date;
  if (!visitDate) return false;
  
  // TIMESTAMP型対応: 日付部分のみを抽出
  if (typeof visitDate === 'string') {
    if (visitDate.includes(' ')) {
      visitDate = visitDate.split(' ')[0];
    } else if (visitDate.includes('T')) {
      visitDate = visitDate.split('T')[0];
    }
  }
  
  // visitReminderAssigneeに値がある場合は除外
  const visitReminderAssignee = seller.visitReminderAssignee || seller.visit_reminder_assignee || '';
  if (visitReminderAssignee.trim() !== '') return false;
  
  // sellerStatusUtils.isVisitDayBeforeUtil() を呼び出し
  const todayStr = getTodayJSTString();
  const todayParts = todayStr.split('-');
  const todayDate = new Date(
    parseInt(todayParts[0]),
    parseInt(todayParts[1]) - 1,
    parseInt(todayParts[2])
  );
  todayDate.setHours(0, 0, 0, 0);
  
  return isVisitDayBeforeUtil(String(visitDate), todayDate);
};
```

**`sellerStatusUtils.isVisitDayBeforeUtil()`の実装**:

```typescript
export function isVisitDayBefore(
  visitDateStr: string | null,
  today: Date
): boolean {
  // TIMESTAMP型対応: 日付部分のみを抽出
  if (visitDateStr && typeof visitDateStr === 'string') {
    if (visitDateStr.includes(' ')) {
      visitDateStr = visitDateStr.split(' ')[0];
    } else if (visitDateStr.includes('T')) {
      visitDateStr = visitDateStr.split('T')[0];
    }
  }
  
  const visitDate = parseDate(visitDateStr);
  if (!visitDate) return false;

  const visitDayOfWeek = visitDate.getDay();

  // 木曜訪問の場合、前々日（火曜日）に表示
  if (visitDayOfWeek === 4) {
    const twoDaysBefore = new Date(visitDate);
    twoDaysBefore.setDate(visitDate.getDate() - 2);
    twoDaysBefore.setHours(0, 0, 0, 0);
    return today.getTime() === twoDaysBefore.getTime();
  }

  // それ以外の場合、前日に表示
  const oneDayBefore = new Date(visitDate);
  oneDayBefore.setDate(visitDate.getDate() - 1);
  oneDayBefore.setHours(0, 0, 0, 0);
  return today.getTime() === oneDayBefore.getTime();
}
```

#### バックエンド（サイドバーのカウント計算）

**ファイル**: `backend/src/services/SellerService.supabase.ts`

**関数**: `getSidebarCounts()`

```typescript
// 1. 訪問日前日（営担に入力あり AND 訪問日あり）← 前営業日ロジックをJSで計算
const { data: visitAssigneeSellers } = await this.table('sellers')
  .select('visit_date, visit_assignee, visit_reminder_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  .neq('visit_assignee', '外す')
  .not('visit_date', 'is', null);

const visitDayBeforeCount = (visitAssigneeSellers || []).filter(s => {
  const visitDateStr = s.visit_date;
  if (!visitDateStr) return false;
  
  // visit_reminder_assigneeに値がある場合は除外
  const reminderAssignee = (s as any).visit_reminder_assignee || '';
  if (reminderAssignee.trim() !== '') return false;
  
  // 日付をパース
  const parts = visitDateStr.split('-');
  if (parts.length !== 3) return false;
  const visitDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  
  // 訪問日の曜日を取得
  const visitDayOfWeek = visitDate.getDay();
  
  // 木曜訪問の場合は2日前、それ以外は1日前
  const daysBeforeVisit = visitDayOfWeek === 4 ? 2 : 1;
  
  // 通知日を計算
  const expectedNotifyDate = new Date(visitDate);
  expectedNotifyDate.setDate(visitDate.getDate() - daysBeforeVisit);
  
  // 通知日を文字列に変換
  const expectedNotifyStr = `${expectedNotifyDate.getFullYear()}-${String(expectedNotifyDate.getMonth() + 1).padStart(2, '0')}-${String(expectedNotifyDate.getDate()).padStart(2, '0')}`;
  
  // 今日と一致するかチェック
  return expectedNotifyStr === todayJST;
}).length;
```

### 問題点の分析

#### 共通点

1. ✅ 両方とも`visit_reminder_assignee`が空の場合のみカウント
2. ✅ 両方とも木曜訪問の場合は2日前、それ以外は1日前
3. ✅ 両方とも営担（`visit_assignee`）が必須

#### 相違点

**フロントエンド**:
- `hasVisitAssignee()`で営担をチェック
  - `visitAssigneeInitials || visit_assignee || visitAssignee`の順で確認
  - 空文字の場合は`false`を返す
  - **「外す」は有効な営業担当として扱う**

**バックエンド**:
- SQLクエリで営担をチェック
  - `.not('visit_assignee', 'is', null)`
  - `.neq('visit_assignee', '')`
  - **`.neq('visit_assignee', '外す')` ← 「外す」を除外**

### 根本原因

**「外す」の扱いが異なる**:
- フロントエンド: 「外す」は有効な営業担当として扱う → カウントに含める
- バックエンド: 「外す」を除外 → カウントに含めない

**結果**:
- 営担が「外す」の売主が存在する場合、フロントエンドとバックエンドでカウントが不一致になる

## 解決策

### 方針

**ステアリングドキュメント（`sidebar-status-definition.md`）の定義に従う**:

> **🚨 営担が「外す」の場合も有効な営業担当として扱う** → 「当日TEL（担当）」に分類

**結論**: 「外す」は有効な営業担当として扱い、カウントに含める

### 修正内容

#### 修正1: バックエンドのSQLクエリを修正

**ファイル**: `backend/src/services/SellerService.supabase.ts`

**修正箇所**: `getSidebarCounts()`の訪問日前日カウント計算

**変更前**:
```typescript
const { data: visitAssigneeSellers } = await this.table('sellers')
  .select('visit_date, visit_assignee, visit_reminder_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  .neq('visit_assignee', '外す')  // ← これを削除
  .not('visit_date', 'is', null);
```

**変更後**:
```typescript
const { data: visitAssigneeSellers } = await this.table('sellers')
  .select('visit_date, visit_assignee, visit_reminder_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  // .neq('visit_assignee', '外す') を削除（「外す」は有効な営業担当として扱う）
  .not('visit_date', 'is', null);
```

#### 修正2: フロントエンドの`hasVisitAssignee()`関数を確認

**ファイル**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

**現在の実装**（修正不要）:
```typescript
const hasVisitAssignee = (seller: Seller | any): boolean => {
  const visitAssignee = seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee || '';
  if (!visitAssignee || visitAssignee.trim() === '') {
    return false;
  }
  return true; // 「外す」も有効な営業担当として扱う
};
```

**確認**: ✅ 既に「外す」を有効な営業担当として扱っている

#### 修正3: バックエンドの他のカウント計算も統一

**ファイル**: `backend/src/services/SellerService.supabase.ts`

**修正箇所**: 以下のカウント計算で`.neq('visit_assignee', '外す')`を削除

1. **訪問済みカウント**:
```typescript
const { count: visitCompletedCount } = await this.table('sellers')
  .select('*', { count: 'exact', head: true })
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  // .neq('visit_assignee', '外す') を削除
  .lt('visit_date', todayJST);
```

2. **当日TEL（担当）カウント**:
```typescript
const { data: todayCallAssignedSellers } = await this.table('sellers')
  .select('id, visit_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  // .neq('visit_assignee', '外す') を削除
  .lte('next_call_date', todayJST)
  .ilike('status', '%追客中%')
  .not('status', 'ilike', '%追客不要%')
  .not('status', 'ilike', '%専任媒介%')
  .not('status', 'ilike', '%一般媒介%')
  .not('status', 'ilike', '%他社買取%');
```

3. **担当(イニシャル)親カテゴリカウント**:
```typescript
const { data: allAssignedSellers } = await this.table('sellers')
  .select('visit_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  // .neq('visit_assignee', '外す') を削除
  .not('status', 'ilike', '%一般媒介%')
  .not('status', 'ilike', '%専任媒介%')
  .not('status', 'ilike', '%追客不要%')
  .not('status', 'ilike', '%他社買取%');
```

## アーキテクチャ設計

### コンポーネント構成

```
┌─────────────────────────────────────────────────────────────┐
│ SellersPage.tsx                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ SellerStatusSidebar.tsx                                 │ │
│ │ - サイドバーのカウント表示                                │ │
│ │ - categoryCounts（APIから取得）を使用                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 売主一覧テーブル                                         │ │
│ │ - filterSellersByCategory()でフィルタリング             │ │
│ │ - isVisitDayBefore()で判定                              │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓ API呼び出し
┌─────────────────────────────────────────────────────────────┐
│ Backend: /api/sellers/sidebar-counts                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ SellerService.getSidebarCounts()                        │ │
│ │ - SQLクエリでカウント計算                                │ │
│ │ - 「外す」を有効な営業担当として扱う（修正後）            │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

```
1. ページロード
   ↓
2. fetchSidebarCounts() → /api/sellers/sidebar-counts
   ↓
3. SellerService.getSidebarCounts()
   - SQLクエリでカウント計算
   - 「外す」を含む営担ありの売主をカウント
   ↓
4. categoryCounts を state に保存
   ↓
5. SellerStatusSidebar に categoryCounts を渡す
   - サイドバーに「①訪問日前日: 2」と表示
   ↓
6. カテゴリクリック → selectedCategory = 'visitDayBefore'
   ↓
7. fetchSellers({ statusCategory: 'visitDayBefore' })
   ↓
8. バックエンドで filterSellersByCategory() 相当の処理
   - 「外す」を含む営担ありの売主を返す
   ↓
9. フロントエンドで表示
   - 一覧に2件表示される
```

## 実装詳細

### 修正ファイル一覧

| ファイル | 修正内容 | 優先度 |
|---------|---------|--------|
| `backend/src/services/SellerService.supabase.ts` | `.neq('visit_assignee', '外す')`を削除（4箇所） | 高 |

### 修正箇所の詳細

#### 1. 訪問日前日カウント（行2160付近）

```typescript
// 変更前
const { data: visitAssigneeSellers } = await this.table('sellers')
  .select('visit_date, visit_assignee, visit_reminder_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  .neq('visit_assignee', '外す')  // ← 削除
  .not('visit_date', 'is', null);

// 変更後
const { data: visitAssigneeSellers } = await this.table('sellers')
  .select('visit_date, visit_assignee, visit_reminder_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  // 「外す」は有効な営業担当として扱う
  .not('visit_date', 'is', null);
```

#### 2. 訪問済みカウント（行2190付近）

```typescript
// 変更前
const { count: visitCompletedCount } = await this.table('sellers')
  .select('*', { count: 'exact', head: true })
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  .neq('visit_assignee', '外す')  // ← 削除
  .lt('visit_date', todayJST);

// 変更後
const { count: visitCompletedCount } = await this.table('sellers')
  .select('*', { count: 'exact', head: true })
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  // 「外す」は有効な営業担当として扱う
  .lt('visit_date', todayJST);
```

#### 3. 当日TEL（担当）カウント（行2195付近）

```typescript
// 変更前
const { data: todayCallAssignedSellers } = await this.table('sellers')
  .select('id, visit_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  .neq('visit_assignee', '外す')  // ← 削除
  .lte('next_call_date', todayJST)
  .ilike('status', '%追客中%')
  .not('status', 'ilike', '%追客不要%')
  .not('status', 'ilike', '%専任媒介%')
  .not('status', 'ilike', '%一般媒介%')
  .not('status', 'ilike', '%他社買取%');

// 変更後
const { data: todayCallAssignedSellers } = await this.table('sellers')
  .select('id, visit_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  // 「外す」は有効な営業担当として扱う
  .lte('next_call_date', todayJST)
  .ilike('status', '%追客中%')
  .not('status', 'ilike', '%追客不要%')
  .not('status', 'ilike', '%専任媒介%')
  .not('status', 'ilike', '%一般媒介%')
  .not('status', 'ilike', '%他社買取%');
```

#### 4. 担当(イニシャル)親カテゴリカウント（行2210付近）

```typescript
// 変更前
const { data: allAssignedSellers } = await this.table('sellers')
  .select('visit_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  .neq('visit_assignee', '外す')  // ← 削除
  .not('status', 'ilike', '%一般媒介%')
  .not('status', 'ilike', '%専任媒介%')
  .not('status', 'ilike', '%追客不要%')
  .not('status', 'ilike', '%他社買取%');

// 変更後
const { data: allAssignedSellers } = await this.table('sellers')
  .select('visit_assignee')
  .is('deleted_at', null)
  .not('visit_assignee', 'is', null)
  .neq('visit_assignee', '')
  // 「外す」は有効な営業担当として扱う
  .not('status', 'ilike', '%一般媒介%')
  .not('status', 'ilike', '%専任媒介%')
  .not('status', 'ilike', '%追客不要%')
  .not('status', 'ilike', '%他社買取%');
```

## テスト計画

### 単体テスト

#### テストケース1: 営担が「外す」の売主

**Given**: 以下の売主データが存在する
- 売主A: 営担=外す、訪問日=明日

**When**: 今日の場合

**Then**:
- バックエンド: `visitDayBeforeCount = 1`
- フロントエンド: `isVisitDayBefore(売主A) = true`
- サイドバー: 「①訪問日前日: 1」
- 一覧: 1件表示

#### テストケース2: 営担が通常のイニシャルの売主

**Given**: 以下の売主データが存在する
- 売主B: 営担=Y、訪問日=明日

**When**: 今日の場合

**Then**:
- バックエンド: `visitDayBeforeCount = 1`
- フロントエンド: `isVisitDayBefore(売主B) = true`
- サイドバー: 「①訪問日前日: 1」
- 一覧: 1件表示

#### テストケース3: 営担が「外す」と通常のイニシャルの売主が混在

**Given**: 以下の売主データが存在する
- 売主A: 営担=外す、訪問日=明日
- 売主B: 営担=Y、訪問日=明日

**When**: 今日の場合

**Then**:
- バックエンド: `visitDayBeforeCount = 2`
- フロントエンド: `isVisitDayBefore(売主A) = true`, `isVisitDayBefore(売主B) = true`
- サイドバー: 「①訪問日前日: 2」
- 一覧: 2件表示

### 統合テスト

#### テストケース4: 実際のUIでの動作確認

**Given**: 売主リストページを開く

**When**: サイドバーの「①訪問日前日」カテゴリを確認

**Then**:
- サイドバーのカウント数と一覧の表示件数が一致する
- 営担が「外す」の売主も含まれる

## パフォーマンス考慮事項

### キャッシュ戦略

- サイドバーカウントは60秒TTLでキャッシュ
- 日付が変わると自動的にキャッシュが無効化される（キャッシュキーに日付を含む）

### クエリ最適化

- 既存のインデックスを活用（`visit_assignee`, `visit_date`, `deleted_at`）
- `.neq('visit_assignee', '外す')`を削除することで、クエリがシンプルになる

## セキュリティ考慮事項

- 特になし（既存のロジックを修正するのみ）

## 後方互換性

- フロントエンドの変更なし（既に「外す」を有効な営業担当として扱っている）
- バックエンドの変更により、カウントが増える可能性がある（営担が「外す」の売主が含まれるようになる）

## ロールバック計画

### ロールバック手順

1. `backend/src/services/SellerService.supabase.ts`を元に戻す
2. `.neq('visit_assignee', '外す')`を4箇所に追加
3. デプロイ

### ロールバック判断基準

- カウント数が異常に増加した場合
- ユーザーから「外す」の売主が表示されるべきでないという報告があった場合

## デプロイ計画

### デプロイ手順

1. バックエンドの修正をコミット
2. `git push origin main`
3. Vercelが自動デプロイ
4. デプロイ完了後、売主リストページで動作確認

### デプロイ後の確認事項

- [ ] サイドバーのカウント数と一覧の表示件数が一致するか
- [ ] 営担が「外す」の売主が含まれるか
- [ ] パフォーマンスに問題がないか

---

**作成日**: 2026年4月3日  
**作成者**: Kiro AI  
**ステータス**: Draft
