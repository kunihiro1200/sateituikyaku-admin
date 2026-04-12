# 共有ページ 新規エントリー消失バグ 修正設計

## Overview

共有ページ（`/shared-items`）で新規作成したエントリーが保存直後は表示されるが、しばらく後に消えてしまうバグを修正します。

ユーザーの報告によると「PDF保存だけスプシに残っている（H列）」という手がかりがあります。共有シートのカラム定義を確認すると、H列は「共有日」です（A=ID, B=日付, C=入力者, D=共有場, E=項目, F=タイトル, G=内容, **H=共有日**）。

つまり「H列だけ残っている」= **「共有日フィールドだけがスプレッドシートに書き込まれた」** ことを意味します。これは行全体が消えたのではなく、`appendRow` 時に大部分のカラムが空で書き込まれた可能性を強く示唆しています。

修正方針：
1. `objectToRow` のヘッダーマッピングの問題を特定・修正する
2. `appendRow` 後にスプレッドシートを読み直して保存確認を行う
3. エラー時にフロントエンドへ適切にエラーを伝播させる

## Glossary

- **Bug_Condition (C)**: 新規エントリー保存時に、スプレッドシートへの書き込みが不完全（一部カラムのみ書き込まれる）または失敗する条件
- **Property (P)**: 保存後にスプレッドシートを読み直したとき、保存したエントリーの全フィールドが正しく存在すること
- **Preservation**: 既存エントリーの読み取り・更新・一覧表示が引き続き正常に動作すること
- **appendRow**: `GoogleSheetsClient` の `appendRow()` メソッド。スプレッドシートの最終行にデータを追記する
- **objectToRow**: `GoogleSheetsClient` の `objectToRow()` メソッド。SheetRowオブジェクトをスプレッドシートの行配列に変換する。`getHeaders()` で取得したヘッダー順にマッピングする
- **getHeaders**: スプレッドシートの1行目からヘッダーを取得し、キャッシュする。キャッシュが古い場合、実際のヘッダーと異なる可能性がある
- **headerCache**: `GoogleSheetsClient` 内のヘッダーキャッシュ。一度取得したヘッダーをメモリに保持する
- **SheetRow**: `{ [key: string]: string | number | null }` 型。カラム名をキーとするオブジェクト

## Bug Details

### Bug Condition

バグは新規エントリーを保存する際に発生します。`SharedItemsService.create()` が `appendRow()` を呼び出すとき、`objectToRow()` 内でのヘッダーマッピングが不正確な場合、送信データのキー名とスプレッドシートの実際のヘッダー名が一致せず、大部分のカラムが空文字で書き込まれます。

H列（共有日）だけが残っているという事実は、フロントエンドから送信されるデータのキー名（例: `sharingDate` や `sharing_date`）がスプレッドシートのヘッダー名（`共有日`）と一致しているカラムのみが書き込まれたことを示唆しています。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SheetRow（appendRowに渡されるオブジェクト）
  OUTPUT: boolean

  // ケース1: キー名不一致によるマッピング失敗
  headersFromSheet := getHeaders()  // スプレッドシートの実際のヘッダー
  matchedKeys := input.keys() INTERSECT headersFromSheet
  
  RETURN matchedKeys.size() < headersFromSheet.size()
         AND matchedKeys.size() > 0  // 一部は一致している（H列=共有日が残っている）
         AND NOT allRequiredFieldsPresent(input, headersFromSheet)
END FUNCTION
```

### Examples

- **例1（バグあり）**: フロントエンドが `{ sharingDate: '2026/04/01', title: '朝礼共有' }` を送信 → `objectToRow` がヘッダー `共有日` に対して `sharingDate` キーを探すが見つからず空文字になる
- **例2（バグあり）**: フロントエンドが `{ '共有日': '2026/04/01', 'タイトル': '朝礼共有' }` を送信 → `共有日` は一致するが `タイトル` がスプレッドシートのヘッダー名と異なる場合は空になる
- **例3（正常）**: フロントエンドが `{ 'ID': '212', '日付': '2026/04/01', '入力者': '山田', '共有場': '朝礼', '項目': '契約関係', 'タイトル': 'テスト', '内容': '内容', '共有日': '', ... }` を送信 → 全カラムが正しくマッピングされる
- **例4（エッジケース）**: `appendRow` がタイムアウトで失敗 → エラーがスローされるが、フロントエンドがエラーを無視してフォームを閉じる

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 既存エントリーの一覧表示（`GET /api/shared-items`）は引き続き正常に動作する
- 既存エントリーの更新（`PUT /api/shared-items/:id`）は引き続き正常に動作する
- スタッフ確認機能（`POST /api/shared-items/:id/staff-confirmation`）は引き続き正常に動作する
- ファイルアップロード（`POST /api/shared-items/upload`）は引き続き正常に動作する
- 保存が正常に成功した場合、フォームを閉じてエントリー一覧を更新する動作は変わらない

**Scope:**
新規作成（`POST /api/shared-items`）以外の全ての操作は、この修正によって影響を受けない。

## Hypothesized Root Cause

コードを調査した結果、以下の根本原因が考えられます：

1. **キー名不一致（最有力）**: `SharedItemsService.create()` に渡される `item` オブジェクトのキー名が、スプレッドシートの実際のヘッダー名と一致していない可能性がある
   - フロントエンドが `camelCase`（例: `sharingDate`）や `snake_case`（例: `sharing_date`）でデータを送信している
   - スプレッドシートのヘッダーは日本語（例: `共有日`）
   - `objectToRow` は `headers.map(header => obj[header] ?? '')` でマッピングするため、キーが一致しないと空文字になる
   - H列（`共有日`）だけ残っているという事実と整合する

2. **ヘッダーキャッシュの問題**: `headerCache` が古い状態でキャッシュされている場合、実際のスプレッドシートのヘッダーと異なる順序でマッピングされる可能性がある
   - `initialized` フラグが `true` のままサーバーが再起動せずに動作し続けると、ヘッダーキャッシュが古くなる

3. **appendRow後の確認なし**: 現在の実装は `appendRow` が成功してもスプレッドシートを読み直して確認していない。書き込みが成功したように見えても実際には不完全な場合がある

4. **エラーの無視**: `appendRow` がエラーをスローしても、フロントエンドがそのエラーを適切に処理せずフォームを閉じてしまう可能性がある

## Correctness Properties

Property 1: Bug Condition - 新規エントリーの完全保存

_For any_ 新規エントリーデータ（全フィールドが入力されたSheetRow）を `create()` で保存したとき、固定関数は `appendRow` 後にスプレッドシートを読み直し、保存したエントリーの全フィールド（ID、日付、入力者、共有場、項目、タイトル、内容など）がスプレッドシートに正しく存在することを確認できる。

**Validates: Requirements 2.1, 2.3**

Property 2: Preservation - 既存エントリーへの影響なし

_For any_ 既存エントリーに対する読み取り・更新操作において、修正後のコードは修正前のコードと同じ結果を返し、既存エントリーの一覧表示・詳細表示・更新が正常に動作する。

**Validates: Requirements 3.1, 3.2**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合：

**File**: `backend/src/routes/sharedItems.ts` および `backend/src/services/SharedItemsService.ts`

**Function**: `router.post('/')` および `SharedItemsService.create()`

**Specific Changes**:

1. **キー名マッピングの確認と修正**: `POST /api/shared-items` のリクエストボディのキー名がスプレッドシートのヘッダー名（日本語）と一致しているか確認する
   - フロントエンドが日本語キー（`'共有日'`, `'タイトル'` など）で送信しているか確認
   - 一致していない場合、`SharedItemsService.create()` 内でキー名を変換するマッピング処理を追加

2. **appendRow後の保存確認**: `create()` メソッドに保存後の検証を追加する
   ```typescript
   async create(item: Partial<SharedItem>): Promise<SharedItem> {
     await this.sheetsClient.appendRow(item as SheetRow);
     // 保存確認: IDで行を検索して存在確認
     const savedRowIndex = await this.sheetsClient.findRowByColumn('ID', item['ID'] as string);
     if (!savedRowIndex) {
       throw new Error('保存の確認に失敗しました。スプレッドシートにデータが存在しません。');
     }
     return item as SharedItem;
   }
   ```

3. **エラーハンドリングの強化**: `appendRow` のエラーを適切にフロントエンドに伝播させる
   - 現在の実装はエラーをcatchして再スローしているが、フロントエンド側の処理も確認が必要

4. **ヘッダーキャッシュのリセット**: 必要に応じて `clearHeaderCache()` を呼び出してキャッシュを無効化する

5. **デバッグログの追加**: `objectToRow` の結果をログ出力して、実際に何が書き込まれているか確認できるようにする

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで進めます。まず未修正コードでバグを再現するテストを書き、次に修正後のコードで全フィールドが正しく保存されることを確認します。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。キー名不一致の仮説を検証する。

**Test Plan**: `SharedItemsService.create()` に全フィールドを含むSheetRowを渡し、`appendRow` に渡される実際の配列を確認する。H列（インデックス7）以外が空文字になっているかを検証する。

**Test Cases**:
1. **全フィールド送信テスト**: 全カラム（ID、日付、入力者、共有場、項目、タイトル、内容、共有日...）を含むSheetRowを送信し、`objectToRow` の出力を確認（未修正コードで失敗するはず）
2. **キー名不一致テスト**: `{ sharingDate: '2026/04/01' }` と `{ '共有日': '2026/04/01' }` の両方を送信し、どちらがH列に書き込まれるか確認
3. **ヘッダーキャッシュテスト**: `getHeaders()` が返すヘッダーと実際のスプレッドシートのヘッダーが一致しているか確認
4. **appendRow後の確認テスト**: `appendRow` 後に `findRowByColumn('ID', id)` で行が存在するか確認（未修正コードでは確認処理がないため失敗するはず）

**Expected Counterexamples**:
- `objectToRow` の出力配列でH列（インデックス7）以外が空文字になっている
- 可能性のある原因: キー名不一致、ヘッダーキャッシュの問題

### Fix Checking

**Goal**: 修正後のコードで全フィールドが正しく保存されることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := create_fixed(input)
  savedRow := findRowByColumn('ID', input['ID'])
  ASSERT savedRow IS NOT NULL
  ASSERT savedRow['タイトル'] = input['タイトル']
  ASSERT savedRow['共有場'] = input['共有場']
  ASSERT savedRow['内容'] = input['内容']
  // 全フィールドを確認
END FOR
```

### Preservation Checking

**Goal**: 修正が既存エントリーの読み取り・更新に影響しないことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT getAll_original() = getAll_fixed()
  ASSERT update_original(id, data) = update_fixed(id, data)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。既存エントリーに対する操作が修正前後で同じ結果を返すことを多数のランダム入力で確認する。

**Test Cases**:
1. **既存エントリー読み取り保存テスト**: 修正前後で `getAll()` が同じデータを返すことを確認
2. **更新操作保存テスト**: 修正前後で `update()` が同じ動作をすることを確認
3. **カテゴリー取得保存テスト**: 修正前後で `getCategories()` が同じ結果を返すことを確認

### Unit Tests

- `objectToRow` が全フィールドを正しくマッピングすることをテスト
- `create()` が `appendRow` 後に保存確認を行うことをテスト
- `appendRow` 失敗時にエラーがスローされることをテスト
- キー名が日本語の場合と英語の場合の両方でマッピングをテスト

### Property-Based Tests

- ランダムなSheetRowデータを生成し、`objectToRow` の出力が全ヘッダーに対して値を持つことを確認
- ランダムなエントリーデータで `create()` を呼び出し、保存後に `findRowByColumn` で存在確認できることを確認
- 既存エントリーに対する `getAll()` の結果が修正前後で変わらないことを確認

### Integration Tests

- 実際のスプレッドシートに対して `create()` を呼び出し、全フィールドが正しく書き込まれることを確認
- 保存後に `getAll()` を呼び出し、新規エントリーが一覧に含まれることを確認
- エラー発生時にフロントエンドがエラーメッセージを表示することを確認
