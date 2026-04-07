# サイドバーカテゴリ表示バグ修正まとめ

## 問題

売主リストのサイドバーで以下の4つのカテゴリが表示されない：
- 専任
- 一般
- 未訪問他決
- 訪問後他決

## 根本原因

1. **認証エラー**: `backend/src/routes/sellersManagement.ts`で`router.use(authenticate)`がルーターの先頭にあり、`/api/sellers`パス全体に認証が適用されていた
2. **カテゴリフィルター条件の誤り**: Supabaseの`.or()`と`.neq()`の組み合わせが正しく動作せず、条件が正しく適用されていなかった

## 修正内容

### 1. 認証エラーの修正

**ファイル**: `backend/src/routes/sellersManagement.ts`

**変更**: `router.use(authenticate)`を削除し、個別のエンドポイントに`authenticate`ミドルウェアを適用

```typescript
// 修正前
router.use(authenticate); // 全エンドポイントに認証を適用

// 修正後
router.post('/', authenticate, async (req, res) => { ... }); // 個別に適用
router.put('/:id', authenticate, async (req, res) => { ... }); // 個別に適用
```

### 2. カテゴリフィルター条件の修正

**ファイル**: `backend/src/services/SellerService.supabase.ts`

**変更**: JavaScriptフィルタリングに変更（Supabaseクエリの制限を回避）

**カテゴリ条件**:

#### 専任
- `exclusive_other_decision_meeting` ≠ "完了"
- `next_call_date` IS NULL OR `next_call_date` ≠ 今日
- `status` IN ("専任媒介", "他決→専任", "リースバック（専任）")

#### 一般
- `exclusive_other_decision_meeting` ≠ "完了"
- `next_call_date` IS NULL OR `next_call_date` ≠ 今日
- `status` = "一般媒介"
- `contract_year_month` >= "2025-06-23"

#### 訪問後他決
- `exclusive_other_decision_meeting` ≠ "完了"
- `next_call_date` IS NULL OR `next_call_date` ≠ 今日
- `status` IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取")
- `visit_assignee` IS NOT NULL AND `visit_assignee` ≠ ""

#### 未訪問他決
- `exclusive_other_decision_meeting` ≠ "完了"
- `next_call_date` IS NULL OR `next_call_date` ≠ 今日
- `status` IN ("他決→追客", "他決→追客不要", "一般→他決")
- `visit_assignee` IS NULL OR `visit_assignee` = "" OR `visit_assignee` = "外す"

#### 査定（郵送）
- `status` IN ("追客中", "除外後追客中", "他決→追客")
- `valuation_method` = "机上査定（郵送）"
- `mailing_status` = "未"

## デプロイ

コミット: `f2c28f36`
日付: 2026年4月7日

## 確認事項

デプロイ後、以下を確認してください：
- 売主リストページのサイドバーで4つのカテゴリが表示される
- 各カテゴリの件数が正しい
- 他のカテゴリ（訪問日前日、当日TEL分など）も正常に表示される
