---
inclusion: manual
---

# Google Sheets APIクオータ最適化記録

## 修正日
2026年4月8日

## 問題

Google Sheets APIの厳しい制限（60 requests/minute、500/day）により、以下の問題が発生：

1. **訪問予約保存時に400エラー** - 営担バリデーションでGoogle Sheets APIを呼び出し、クオータ制限に到達
2. **複数のAPIエンドポイントで500エラー** - ページロード時に複数のGoogle Sheets API呼び出しが発生
3. **ユーザー体験の悪化** - エラーが頻発し、機能が使えない状態

## 根本原因

### 1. 営担バリデーション（最大の問題）

**場所**: `backend/src/routes/sellers.ts` (lines 890-960)

**問題のコード**:
```typescript
// ❌ 間違い: 訪問予約保存のたびにGoogle Sheets APIを呼び出し
const sheetsClient = new GoogleSheetsClient({
  spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
  sheetName: 'スタッフ',
});
await sheetsClient.authenticate();
const values = await sheetsClient.readRawRange('A:H');
```

**影響**:
- 訪問予約を保存するたびにGoogle Sheets APIを呼び出し
- 1ページロードで複数回呼び出される可能性
- クオータ制限（60 requests/minute）に即座に到達

### 2. その他のGoogle Sheets API呼び出し

以下のエンドポイントでもGoogle Sheets APIを使用していたが、キャッシュで対応済み：

- `/api/employees/normal-initials` - `employees`テーブルに変更済み（2026年4月8日）
- `StaffManagementService` - 24時間キャッシュ追加済み
- `EmailTemplateService` - 24時間キャッシュ追加済み

## 実装した修正

### ✅ 修正1: 営担バリデーションを`employees`テーブルに変更

**ファイル**: `backend/src/routes/sellers.ts`

**修正内容**:
```typescript
// ✅ 正しい: employeesテーブルから取得（Google Sheets APIを使わない）
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// employeesテーブルから営担を検索（イニシャルまたは名前で検索）
const { data: employee, error: employeeError } = await supabase
  .from('employees')
  .select('initials, name, is_active')
  .or(`initials.eq.${req.body.visitAssignee},name.eq.${req.body.visitAssignee}`)
  .single();

if (employeeError || !employee) {
  return res.status(400).json({
    error: {
      code: 'INVALID_VISIT_ASSIGNEE',
      message: '無効な営担です',
      retryable: false,
    },
  });
}

// 有効フラグを確認
if (!employee.is_active) {
  return res.status(400).json({
    error: {
      code: 'INVALID_VISIT_ASSIGNEE',
      message: '無効な営担です',
      retryable: false,
    },
  });
}
```

**メリット**:
1. ✅ **Google Sheets APIクオータ制限を回避**（60 requests/minute）
2. ✅ **高速化**（データベースクエリの方が速い）
3. ✅ **安定性向上**（APIレート制限エラーがなくなる）
4. ✅ **24時間キャッシュを活用**（`StaffManagementService`が`employees`テーブルを同期）

## 修正結果

### ✅ 成功した点

1. **訪問予約保存が成功** - 400エラー「無効な営担です」が解消
2. **コンソールエラーなし** - JavaScriptエラーが発生していない
3. **ネットワークエラーなし** - 全てのAPIリクエストが成功（200/204ステータス）
4. **Google Sheets API呼び出しが大幅削減** - クオータ制限を回避

### 📊 Vercelログの確認

以下のAPIリクエストが全て成功：

- ✅ `/api/cron/seller-sync` - 200
- ✅ `/api/cron/work-task-sync` - 200
- ✅ `/api/property-listings/AA12587` - 200
- ✅ `/api/cron/buyer-sync` - 200
- ✅ `/api/sellers/d8261dd8-bd5d-4a60-867c-f37e092edd1f/activities` - 200
- ✅ `/api/employees/active-initials` - 200
- ✅ `/api/sellers/by-number/AA18` - 200
- ✅ `/api/employees/normal-initials` - 200
- ✅ `/api/sellers/performance-metrics` - 200

## 今後の予防策

### 1. Google Sheets APIを直接呼び出さない

**原則**: Google Sheets APIは**同期処理のみ**で使用し、リアルタイムAPIでは使わない

**理由**:
- Google Sheets APIは厳しいレート制限がある（60 requests/minute、500/day）
- ユーザーのリクエストごとに呼び出すと即座にクオータ制限に到達
- データベースクエリの方が高速で安定

### 2. データベースを Single Source of Truth として使用

**推奨アーキテクチャ**:
```
Google Sheets (マスターデータ)
    ↓ 同期（定期的、手動）
employees テーブル (Single Source of Truth)
    ↓ クエリ（リアルタイム）
API エンドポイント
```

**実装例**:
- `StaffManagementService` - Google Sheetsから`employees`テーブルに同期（24時間キャッシュ）
- APIエンドポイント - `employees`テーブルから取得（高速、安定）

### 3. キャッシュを活用

**推奨キャッシュ戦略**:
- **インメモリキャッシュ**: 30秒～5分（頻繁に変更されないデータ）
- **Redisキャッシュ**: 5分～24時間（複数サーバー間で共有）
- **データベースキャッシュ**: 24時間（マスターデータの同期）

**実装例**:
```typescript
// インメモリキャッシュ（30秒TTL）
const _sellerCache = new Map<string, { data: any; expiresAt: number }>();
const SELLER_CACHE_TTL_MS = 30 * 1000;

// Redisキャッシュ（5分TTL）
await CacheHelper.set('sellers:list:page1', data, 5 * 60);

// データベースキャッシュ（24時間TTL）
const EMPLOYEE_INITIALS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
```

### 4. チェックリスト

新しいAPIエンドポイントを実装する前に確認：

- [ ] Google Sheets APIを直接呼び出していないか？
- [ ] データベースから取得できるか？
- [ ] キャッシュを活用しているか？
- [ ] レート制限に引っかからないか？
- [ ] ユーザーのリクエストごとに呼び出されないか？

## コミット履歴

- `5f5e94e0` - fix: Replace営担 validation Google Sheets API with employees table query to avoid quota limits (2026年4月8日)

---

**最終更新日**: 2026年4月8日  
**作成理由**: Google Sheets APIクオータ制限問題の解決策を記録し、同じ間違いを繰り返さないため
