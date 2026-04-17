# Implementation Plan

- [x] 1. バグ条件探索テストを書く
  - **Property 1: Bug Condition** - 除外アクション保存後の即時反映バグ
  - **重要**: このテストは修正前のコードで必ず FAIL すること — FAIL することでバグの存在が確認される
  - **修正前にテストが失敗しても、テストやコードを修正しようとしないこと**
  - **注意**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正が正しいことを検証する
  - **目的**: バグの存在を示す反例を見つけること
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - **テスト対象（条件A — キャッシュ問題）**:
    - `SellerService.supabase.ts` の `_sellerCache` を新しいインスタンスで初期化（別Vercelインスタンスをシミュレート）
    - `updateSeller({ sellerId, exclusionAction: 'exclude_if_unreachable' })` を実行してキャッシュを無効化
    - 新しいキャッシュインスタンスで `getSeller(sellerId)` を呼び出す
    - `SELLER_CACHE_TTL_MS` が 30秒（30000ms）以上であることを確認（バグの根本原因）
    - 修正前: 新インスタンスが古いキャッシュ（`exclusionAction = null`）を返す → テスト FAIL（バグ確認）
  - **テスト対象（条件B — 空文字列除外問題）**:
    - `CallModePage.tsx` の保存処理のスプレッド構文 `...(exclusionAction ? { exclusionAction } : {})` を確認
    - `exclusionAction = ''` の場合にペイロードから `exclusionAction` キーが除外されることを確認
    - 修正前: `exclusionAction` がペイロードに含まれない → テスト FAIL（バグ確認）
  - テストを実行（修正前のコードで実行）
  - **期待される結果**: テスト FAIL（これが正しい — バグの存在を証明する）
  - 見つかった反例を記録して根本原因を理解する（例: 「新インスタンスで getSeller が古い exclusionAction=null を返す」「exclusionAction='' がペイロードから除外される」）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - 他フィールドの保存動作の不変性
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで非バグ条件の入力（`exclusionAction` を含まないリクエスト）の動作を観察する
  - 観察: `updateSeller({ sellerId, status: 'active' })` は `exclusionAction` を変更しない
  - 観察: `getSeller(sellerId)` の初回呼び出し（キャッシュなし）はDBから正しいデータを返す
  - 観察: 同一インスタンスでの再取得はキャッシュを使用する（`SELLER_CACHE_TTL_MS` が 0 より大きい場合）
  - プロパティベーステストを書く: `exclusionAction` を含まない任意のフィールド（ステータス、信頼度、次電日など）の組み合わせで `updateSeller` を呼び出すと、修正前後で同じ結果が返ること
  - 修正前のコードでテストを実行する
  - **期待される結果**: テスト PASS（これが正しい — 保全すべきベースライン動作を確認する）
  - テストを書き、実行し、修正前のコードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 除外アクション保存バグの修正

  - [x] 3.1 フロントエンド修正 — 空文字列の除外問題を解消する
    - `frontend/frontend/src/pages/CallModePage.tsx` の保存処理（行2308付近）を修正する
    - スプレッド構文を変更: `...(exclusionAction ? { exclusionAction } : {})` → `...(exclusionAction !== undefined ? { exclusionAction } : {})`
    - これにより `exclusionAction = ''`（解除操作）がリクエストペイロードに含まれるようになる
    - _Bug_Condition: isBugCondition(X) where X.exclusionAction = '' (条件B)_
    - _Expected_Behavior: exclusionAction が空文字列の場合もペイロードに含まれ、バックエンドの `exclusion_action` カラムが空文字列で更新される_
    - _Preservation: exclusionAction 以外のフィールドの保存ロジックは変更しない_
    - _Requirements: 1.3, 2.2_

  - [x] 3.2 バックエンド修正 — インメモリキャッシュのTTLを短縮する
    - `backend/src/services/SellerService.supabase.ts` の `SELLER_CACHE_TTL_MS` を修正する
    - 現在値: `30 * 1000`（30秒）→ 修正値: `0`（キャッシュ無効化）または `5 * 1000`（5秒）
    - Vercelサーバーレス環境ではインスタンス間でインメモリキャッシュが共有されないため、TTLを短縮または無効化することで別インスタンスが古いデータを返すリスクを排除する
    - _Bug_Condition: isBugCondition(X) where X.exclusionAction IS NOT NULL AND requestHandledByDifferentVercelInstance = true (条件A)_
    - _Expected_Behavior: 別Vercelインスタンスが getSeller を呼び出した際、インメモリキャッシュが期限切れ（またはなし）のためDBから最新の exclusionAction 値を返す_
    - _Preservation: Redisキャッシュによるパフォーマンス最適化は維持する。exclusionAction 以外のフィールドの取得動作は変更しない_
    - _Requirements: 1.1, 1.2, 2.1, 2.3_

  - [x] 3.3 バグ条件探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 除外アクション保存後の即時反映
    - **重要**: タスク1で書いた同じテストを再実行すること — 新しいテストを書かないこと
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされていることを確認できる
    - バグ条件探索テスト（タスク1）を実行する
    - **期待される結果**: テスト PASS（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 他フィールドの保存動作の不変性
    - **重要**: タスク2で書いた同じテストを再実行すること — 新しいテストを書かないこと
    - 保全プロパティテスト（タスク2）を実行する
    - **期待される結果**: テスト PASS（リグレッションがないことを確認する）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テスト（バグ条件探索テスト・保全テスト）が PASS することを確認する
  - 疑問点があればユーザーに確認する
