# 業務依頼サイト登録タブ保存バグ Bugfix Design

## Overview

業務依頼画面のサイト登録タブで保存したデータが最大10分後に消えるバグの修正設計。

根本原因は `WorkTaskSyncService.initSheetsClient()` が Vercel 環境でファイルシステムに依存した認証（`keyFile`）を使用しているため、Google Sheets API 認証に失敗していること。認証失敗により `writeBackToSpreadsheet()` が常に失敗し、スプシへの書き戻しが行われない。その結果、GAS が 10 分ごとにスプシの古い値で DB を上書きし、保存データが消える。

修正方針：`initSheetsClient()` を `GoogleSheetsClient.authenticateWithServiceAccountEnv()` と同じ環境変数認証（`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`）に変更する。

## Glossary

- **Bug_Condition (C)**: `initSheetsClient()` がファイル認証を試みる条件 — Vercel 環境で `GOOGLE_SERVICE_ACCOUNT_PATH` または `google-service-account.json` が存在しない場合
- **Property (P)**: `writeBackToSpreadsheet()` が正常に完了し、スプシに最新値が書き戻される期待動作
- **Preservation**: サイト登録タブ以外のタブ（媒介契約・売買契約・決済）の保存・同期動作、および DB 保存自体は変更しない
- **WorkTaskSyncService**: `backend/src/services/WorkTaskSyncService.ts` の同期サービス。スプシ→DB 同期と DB→スプシ書き戻しを担当
- **initSheetsClient()**: Google Sheets API クライアントを初期化するプライベートメソッド。バグの発生箇所
- **writeBackToSpreadsheet()**: DB 更新後にスプシへ変更を書き戻すメソッド。認証失敗により常に失敗していた
- **GoogleSheetsClient**: `backend/src/services/GoogleSheetsClient.ts` の既存クライアント。環境変数認証の参考実装
- **GAS syncGyomuWorkTasks()**: 10 分ごとにスプシ→DB へ upsert する Google Apps Script

## Bug Details

### Bug Condition

Vercel 環境では `google-service-account.json` ファイルが存在しないため、`initSheetsClient()` の `GoogleAuth({ keyFile: ... })` が認証エラーを投げる。`writeBackToSpreadsheet()` はこのエラーを catch してログのみ出力し、スプシへの書き戻しをスキップする。

**Formal Specification:**
```
FUNCTION isBugCondition(env)
  INPUT: env — 実行環境の状態
  OUTPUT: boolean

  RETURN env.runtime == 'vercel'
         AND NOT fileExists(env.GOOGLE_SERVICE_ACCOUNT_PATH ?? 'google-service-account.json')
         AND initSheetsClient() uses GoogleAuth({ keyFile: ... })
END FUNCTION
```

### Examples

- **例1（バグあり）**: Vercel 環境でサイト登録タブの「ポータルサイト掲載開始日」を保存 → DB には保存成功 → `writeBackToSpreadsheet()` が認証エラーで失敗 → スプシは古い値のまま → 10 分後 GAS が古い値で DB を上書き → データ消失
- **例2（バグあり）**: Vercel 環境で `syncAll()` を呼び出す → `initSheetsClient()` が認証エラー → 全同期が失敗
- **例3（バグなし）**: ローカル環境で `google-service-account.json` が存在する場合 → 認証成功 → 正常動作
- **エッジケース**: `GOOGLE_SERVICE_ACCOUNT_PATH` 環境変数が設定されているが Vercel 環境でファイルが存在しない → 同様に認証失敗

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 媒介契約タブ・売買契約タブ・決済タブのフィールド保存・同期動作は変更しない
- GAS の `syncGyomuWorkTasks()` によるスプシ→DB upsert 動作は変更しない
- `PUT /api/work-tasks/:propertyNumber` の DB 保存処理とレスポンスは変更しない
- `writeBackToSpreadsheet()` 失敗時に DB 保存結果に影響を与えない動作は維持する
- `syncAll()` および `syncByPropertyNumber()` の動作は変更しない

**Scope:**
`initSheetsClient()` の認証方式のみを変更する。それ以外のロジック（行検索、セル更新、カラムマッピング等）は一切変更しない。

## Hypothesized Root Cause

根本原因は確定済み：

1. **ファイルシステム依存の認証**: `initSheetsClient()` が `GoogleAuth({ keyFile: ... })` を使用しており、Vercel のサーバーレス環境にはファイルシステムが存在しないため認証が失敗する

2. **エラーの握りつぶし**: `writeBackToSpreadsheet()` が認証エラーを catch してログのみ出力し、呼び出し元に伝播させないため、DB 保存は成功したように見える

3. **GAS による上書き**: スプシへの書き戻しが行われないため、10 分後の GAS 同期でスプシの古い値が DB を上書きする

4. **既存の正しい実装が参照されていない**: `GoogleSheetsClient.ts` には環境変数認証の正しい実装があるが、`WorkTaskSyncService` はそれを使用せず独自の `initSheetsClient()` を持っている

## Correctness Properties

Property 1: Bug Condition - 環境変数認証による Sheets クライアント初期化

_For any_ 実行環境において `GOOGLE_SERVICE_ACCOUNT_EMAIL` と `GOOGLE_PRIVATE_KEY` 環境変数が設定されている場合、修正後の `initSheetsClient()` は `google.auth.JWT` を使用して認証に成功し、有効な `sheets_v4.Sheets` インスタンスを返す。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 非バグ条件下での動作保持

_For any_ 入力において `writeBackToSpreadsheet()` 以外の処理（DB 保存、GAS 同期、他タブの保存）は、修正前と修正後で同一の動作を維持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/WorkTaskSyncService.ts`

**Function**: `initSheetsClient()`

**Specific Changes**:

1. **環境変数認証を優先**: `GOOGLE_SERVICE_ACCOUNT_JSON`（JSON文字列）が存在する場合はそれを使用
   - `GoogleSheetsClient.authenticateWithServiceAccountJson()` と同じ方式

2. **個別環境変数認証をフォールバック**: `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` が存在する場合は `google.auth.JWT` を使用
   - `GoogleSheetsClient.authenticateWithServiceAccountEnv()` と同じ方式

3. **ファイル認証をローカル開発用フォールバック**: `GOOGLE_SERVICE_ACCOUNT_PATH` が存在する場合のみファイル認証を試みる

4. **認証失敗時の明示的エラー**: いずれの認証方式も利用できない場合は明確なエラーメッセージを投げる

**実装イメージ**:
```typescript
private async initSheetsClient(): Promise<sheets_v4.Sheets> {
  if (this.sheets) return this.sheets;

  // 1. JSON文字列認証（Vercel環境用）
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    // JSON文字列またはBase64からJWT認証
    ...
  }
  // 2. 個別環境変数認証（Vercel環境用フォールバック）
  else if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    await auth.authorize();
    this.sheets = google.sheets({ version: 'v4', auth });
  }
  // 3. ファイル認証（ローカル開発用）
  else if (process.env.GOOGLE_SERVICE_ACCOUNT_PATH || fs.existsSync('google-service-account.json')) {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 'google-service-account.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.sheets = google.sheets({ version: 'v4', auth });
  }
  else {
    throw new Error('Google Sheets 認証情報が設定されていません');
  }

  return this.sheets;
}
```

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず未修正コードでバグを再現し根本原因を確認、次に修正後のコードで正常動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで認証失敗を再現し、`writeBackToSpreadsheet()` が常に失敗することを確認する。

**Test Plan**: `initSheetsClient()` をモックして `keyFile` 認証が失敗するシナリオをシミュレートし、`writeBackToSpreadsheet()` がエラーをログのみで握りつぶすことを確認する。

**Test Cases**:
1. **ファイル不在テスト**: `google-service-account.json` が存在しない環境で `initSheetsClient()` を呼び出す（未修正コードで失敗）
2. **書き戻し失敗テスト**: 認証失敗時に `writeBackToSpreadsheet()` がエラーをスローせずログのみ出力することを確認
3. **DB 保存への非影響テスト**: `writeBackToSpreadsheet()` 失敗後も PUT エンドポイントが 200 を返すことを確認

**Expected Counterexamples**:
- `initSheetsClient()` が `Error: ENOENT: no such file or directory, open 'google-service-account.json'` をスロー
- `writeBackToSpreadsheet()` がエラーをキャッチしてログのみ出力し、スプシへの書き戻しが行われない

### Fix Checking

**Goal**: 修正後の `initSheetsClient()` が環境変数認証で成功し、`writeBackToSpreadsheet()` が正常完了することを確認する。

**Pseudocode:**
```
FOR ALL env WHERE isBugCondition(env) DO
  result := initSheetsClient_fixed(env)
  ASSERT result is valid sheets_v4.Sheets instance
  ASSERT writeBackToSpreadsheet_fixed(propertyNumber, updates) completes without error
END FOR
```

### Preservation Checking

**Goal**: 修正前後で `writeBackToSpreadsheet()` 以外の動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT workTaskService_original(input) = workTaskService_fixed(input)
END FOR
```

**Testing Approach**: 既存の DB 保存・GAS 同期・他タブ保存の動作が変わらないことをユニットテストで確認する。

**Test Cases**:
1. **DB 保存保持テスト**: `updateByPropertyNumber()` が修正前後で同じ結果を返すことを確認
2. **他タブ保存保持テスト**: 媒介契約・売買契約・決済タブのフィールド更新が正常に動作することを確認
3. **エラー非伝播保持テスト**: `writeBackToSpreadsheet()` 失敗時に PUT エンドポイントが 200 を返すことを確認

### Unit Tests

- `initSheetsClient()` が `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` 環境変数で認証成功することをテスト
- `initSheetsClient()` が `GOOGLE_SERVICE_ACCOUNT_JSON` 環境変数で認証成功することをテスト
- `initSheetsClient()` がローカルファイルパスで認証成功することをテスト（ローカル開発用）
- 認証情報が一切ない場合に明確なエラーをスローすることをテスト

### Property-Based Tests

- ランダムな `propertyNumber` と `updates` を生成し、`writeBackToSpreadsheet()` が認証成功後に正常完了することを確認
- 様々な環境変数の組み合わせで `initSheetsClient()` の認証優先順位が正しく動作することを確認

### Integration Tests

- Vercel 環境変数（`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`）を使用して実際のスプシへの書き戻しが成功することを確認
- PUT エンドポイント呼び出し後、スプシの該当セルが更新されていることを確認
- GAS 同期後もデータが保持されることを確認（エンドツーエンド）
