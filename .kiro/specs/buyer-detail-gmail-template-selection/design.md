# Gmail テンプレート選択バグ修正 デザイン

## Overview

買主詳細画面（BuyerDetailPage）のGmail送信機能において、テンプレート選択ダイアログを開くと「利用可能なテンプレートがありません」と表示されるバグを修正する。

根本原因は `backend/src/services/EmailTemplateService.ts` の `getTemplates()` メソッドが、Googleスプレッドシートへのアクセスに失敗した際にエラーをキャッチして空配列を返すことにある。これにより、APIは200 OKで `[]` を返し、フロントエンドはエラーを検知できない。

修正方針は、エラーを握りつぶさずに適切に伝播させ、フロントエンドがエラー状態を正しく表示できるようにすることである。

## Glossary

- **Bug_Condition (C)**: `getTemplates()` がGoogleスプレッドシートへのアクセスに失敗し、空配列を返す条件
- **Property (P)**: バグ条件が成立する入力に対して、修正後の関数が取るべき正しい動作（エラーを伝播させる）
- **Preservation**: テンプレート取得が成功する場合の既存動作、およびmerge処理など他のエンドポイントの動作は変更しない
- **EmailTemplateService**: `backend/src/services/EmailTemplateService.ts` に実装されたサービス。Googleスプレッドシートからテンプレートを取得する
- **getTemplates()**: スプレッドシートの「テンプレート」シートから区分が「買主」の行を取得して返すメソッド
- **TEMPLATE_SPREADSHEET_ID**: テンプレートが格納されているスプレッドシートのID（環境変数 `GOOGLE_SHEETS_TEMPLATE_SPREADSHEET_ID` で設定）

## Bug Details

### Bug Condition

`getTemplates()` がGoogleスプレッドシートへのアクセスに失敗した際、エラーをキャッチして空配列を返す。これにより `/api/email-templates` は200 OKで `[]` を返し、フロントエンドはエラーを検知できずに「利用可能なテンプレートがありません」と表示する。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { serviceAccountCredentials, spreadsheetId, sheetName }
  OUTPUT: boolean

  authFailed    := GoogleSheetsClient.authenticate() throws Error
  accessFailed  := spreadsheets.values.get() throws Error OR returns empty
  errorSwallowed := catch(error) { return [] }  // エラーを握りつぶして空配列を返す

  RETURN (authFailed OR accessFailed) AND errorSwallowed
END FUNCTION
```

### Examples

- **認証失敗**: `GOOGLE_SERVICE_ACCOUNT_JSON` 環境変数が未設定 → `authenticate()` が例外をスロー → `catch` で空配列を返す → APIが `[]` を返す
- **スプレッドシートID不正**: `GOOGLE_SHEETS_TEMPLATE_SPREADSHEET_ID` が間違っている → `spreadsheets.values.get()` が404エラー → `catch` で空配列を返す → APIが `[]` を返す
- **シート名不一致**: スプレッドシートに「テンプレート」シートが存在しない → APIエラー → `catch` で空配列を返す → APIが `[]` を返す
- **正常系（バグ条件不成立）**: 認証成功 + スプレッドシートアクセス成功 → 「買主」区分のテンプレートを返す

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- テンプレート取得が成功する場合、`EmailTemplate[]` を返す動作は変更しない
- `getTemplateById()` の動作は変更しない
- `mergePlaceholders()` の動作は変更しない
- `mergeMultipleProperties()` の動作は変更しない
- `/api/email-templates/:id/merge-multiple` エンドポイントの動作は変更しない
- テンプレート選択後に `BuyerEmailCompositionModal` にテンプレートを渡す動作は変更しない
- 物件未選択時の「物件を選択してください」エラーメッセージは変更しない

**スコープ:**
スプレッドシートへのアクセスが成功する場合（バグ条件が成立しない場合）の全ての動作は、この修正によって影響を受けない。

## Hypothesized Root Cause

コードを確認した結果、根本原因は以下の通り：

1. **エラーの握りつぶし**: `getTemplates()` の `catch` ブロックがエラーをログに記録した後、`return []` で空配列を返している。これにより呼び出し元（ルートハンドラ）にエラーが伝播しない
   ```typescript
   // backend/src/services/EmailTemplateService.ts（現在の問題コード）
   } catch (error: any) {
     console.error('[EmailTemplateService] スプレッドシートからのテンプレート取得に失敗:', error.message);
     return [];  // ← ここが問題：エラーを握りつぶして空配列を返す
   }
   ```

2. **ルートハンドラの問題**: `backend/src/routes/emailTemplates.ts` の `GET /` ハンドラは `getTemplates()` が例外をスローすることを期待しているが、現在は例外がスローされないため `catch` ブロックに到達しない。結果として200 OKで `[]` が返る

3. **環境変数の未設定の可能性**: `GOOGLE_SHEETS_TEMPLATE_SPREADSHEET_ID` が設定されていない場合、デフォルト値 `'1sIBMhrarUSMcVWlTVVyaNNKaDxmfrxyHJLWv6U-MZxE'` が使用されるが、このスプレッドシートへのアクセス権限がない可能性がある

4. **認証情報の問題**: `GOOGLE_SERVICE_ACCOUNT_JSON` または `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` が正しく設定されていない場合、`authenticate()` が失敗する

## Correctness Properties

Property 1: Bug Condition - スプレッドシートアクセス失敗時のエラー伝播

_For any_ 入力においてバグ条件が成立する（`isBugCondition` が true を返す）場合、修正後の `getTemplates()` はエラーをスローし、`/api/email-templates` エンドポイントは500エラーを返す。フロントエンドはエラー状態を検知してエラーメッセージを表示できる。

**Validates: Requirements 1.3, 2.1**

Property 2: Preservation - スプレッドシートアクセス成功時の動作保持

_For any_ 入力においてバグ条件が成立しない（スプレッドシートへのアクセスが成功する）場合、修正後の `getTemplates()` は修正前と同じ `EmailTemplate[]` を返す。既存のテンプレート取得・選択・マージ動作は変更されない。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合：

**File**: `backend/src/services/EmailTemplateService.ts`

**Function**: `getTemplates()`

**Specific Changes**:

1. **catchブロックの修正**: エラーを握りつぶして空配列を返す代わりに、エラーをスローする
   ```typescript
   // 修正前
   } catch (error: any) {
     console.error('[EmailTemplateService] スプレッドシートからのテンプレート取得に失敗:', error.message);
     return [];
   }

   // 修正後
   } catch (error: any) {
     console.error('[EmailTemplateService] スプレッドシートからのテンプレート取得に失敗:', error.message);
     throw error;  // エラーを伝播させる
   }
   ```

2. **ルートハンドラの確認**: `backend/src/routes/emailTemplates.ts` の `GET /` ハンドラはすでに `try/catch` を持ち、エラー時に500を返す実装になっているため、変更不要

**File**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`（または関連するテンプレート選択コンポーネント）

3. **フロントエンドのエラーハンドリング確認**: テンプレート取得APIが500を返した場合に、適切なエラーメッセージを表示しているか確認する。要件7.3に従い、エラーメッセージとリトライオプションを表示する

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する。まず未修正コードでバグを再現するテストを書いてバグを確認し、次に修正後のコードでバグが解消されていることと既存動作が保持されていることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認・反証する。

**Test Plan**: `getTemplates()` をモックされたGoogleSheetsClientで呼び出し、認証失敗・スプレッドシートアクセス失敗のシナリオで空配列が返ることを確認する。未修正コードで実行して失敗を観察する。

**Test Cases**:
1. **認証失敗テスト**: `GoogleSheetsClient.authenticate()` が例外をスローするようにモックし、`getTemplates()` が空配列を返すことを確認（未修正コードで「成功」してしまう = バグの証拠）
2. **スプレッドシートアクセス失敗テスト**: `spreadsheets.values.get()` が例外をスローするようにモックし、`getTemplates()` が空配列を返すことを確認
3. **APIエンドポイントテスト**: 上記条件で `/api/email-templates` が200 OKで `[]` を返すことを確認（未修正コードでの欠陥動作）

**Expected Counterexamples**:
- 未修正コードでは、認証失敗時に `getTemplates()` が例外をスローせず `[]` を返す
- 未修正コードでは、`/api/email-templates` が500ではなく200 OKで `[]` を返す

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待通りの動作をすることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := getTemplates_fixed(input)
  ASSERT result throws Error  // 空配列を返さずエラーをスロー
  
  apiResult := GET /api/email-templates (with buggy credentials)
  ASSERT apiResult.status === 500
  ASSERT apiResult.body.error !== undefined
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が修正前と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT getTemplates_original(input) = getTemplates_fixed(input)
END FOR
```

**Testing Approach**: スプレッドシートアクセスが成功するケースでは、修正前後で同じ `EmailTemplate[]` が返ることを確認する。モックを使用して「買主」区分のテンプレートが正しく返ることを検証する。

**Test Cases**:
1. **正常取得の保持**: スプレッドシートから「買主」区分のテンプレートが正しく取得できることを確認
2. **テンプレート構造の保持**: 返却される `EmailTemplate` オブジェクトが `id`・`name`・`description`・`subject`・`body` を持つことを確認
3. **merge処理の保持**: `mergePlaceholders()` と `mergeMultipleProperties()` の動作が変更されていないことを確認
4. **他エンドポイントの保持**: `/api/email-templates/:id/merge-multiple` が引き続き正常に動作することを確認

### Unit Tests

- `getTemplates()` が認証失敗時にエラーをスローすることを確認
- `getTemplates()` がスプレッドシートアクセス失敗時にエラーをスローすることを確認
- `getTemplates()` が正常時に `EmailTemplate[]` を返すことを確認
- `/api/email-templates` がエラー時に500を返すことを確認
- `/api/email-templates` が正常時に200でテンプレート配列を返すことを確認

### Property-Based Tests

- Property 1の検証: 任意の認証失敗シナリオで `getTemplates()` がエラーをスローすることを確認
- Property 2の検証: 任意の正常シナリオで `getTemplates()` が修正前と同じ結果を返すことを確認

### Integration Tests

- バックエンドサーバーを起動し、実際のGoogleスプレッドシートへのアクセスを確認
- フロントエンドのテンプレート選択ダイアログが正常にテンプレートを表示することを確認
- エラー時にフロントエンドが適切なエラーメッセージを表示することを確認
