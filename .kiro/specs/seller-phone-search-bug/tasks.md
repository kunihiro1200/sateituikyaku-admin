# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 電話番号・メールアドレスのハッシュ検索未実施バグ
  - **CRITICAL**: このテストは未修正コードで必ず FAIL する - 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている - 修正後に PASS することで修正を検証する
  - **GOAL**: バグの存在を示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
    - 電話番号ケース: `09012345678`（11桁の数字）で `searchSellers` を呼び出す
    - メールアドレスケース: `tomoko.kunihiro@ifoo-oita.com` で `searchSellers` を呼び出す
  - Bug Condition の詳細（design.md より）:
    - `isPhoneBugCondition(X)`: `X.matches(/^\d{7,}$/)` が true のとき、`phone_number_hash` 検索が行われない
    - `isEmailBugCondition(X)`: `X.matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)` が true のとき、`email_hash` 検索が行われない
  - テストアサーション（Expected Behavior より）:
    - 電話番号入力 → SHA-256 ハッシュ化して `phone_number_hash` で DB 検索 → 全件対象で一致売主を返す
    - メールアドレス入力 → SHA-256 ハッシュ化して `email_hash` で DB 検索 → 全件対象で一致売主を返す
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい - バグの存在を証明する）
  - 発見したカウンターサンプルを記録して根本原因を理解する（例: `09012345678` が `seller_number` LIKE 検索にヒットせず500件スキャンのみで処理される）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. 保全プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - 非ハッシュ検索入力の動作保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力を観察する:
    - `searchSellers('AA12345')` → `seller_number` 高速検索が実行される
    - `searchSellers('山田太郎')` → 全件スキャン後に復号して部分一致検索
    - `searchSellers('大分市')` → 全件スキャン後に復号して部分一致検索
    - `searchSellers('12345')` → 7桁未満のため `seller_number` LIKE 検索
    - `searchSellers('')` → 通常の売主一覧を表示
  - Preservation Requirements（design.md より）:
    - `NOT isPhoneBugCondition(X) AND NOT isEmailBugCondition(X)` の全入力で修正前後の結果が同一
    - 売主番号（AA/FI/BB + 数字）検索は `seller_number` 高速検索を継続
    - 名前・住所検索は全件スキャン後の復号部分一致検索を継続
    - 空クエリは通常の売主一覧表示を継続
  - プロパティベーステストを作成: 非バグ条件入力全体にわたって動作が変わらないことを検証
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これが正しい - 保全すべきベースライン動作を確認する）
  - テストを作成し、実行し、未修正コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [-] 3. 電話番号・メールアドレスのハッシュ検索バグを修正する

  - [x] 3.1 修正を実装する
    - `backend/src/services/SellerService.supabase.ts` の `searchSellers` メソッドを修正する
    - 電話番号パターン判定を追加: 既存の `/^\d+$/` パスより前に `/^\d{7,}$/` パスを追加する
    - 電話番号ハッシュ検索を実装: `crypto.createHash('sha256').update(lowerQuery).digest('hex')` でハッシュ化し `phone_number_hash` で完全一致検索
    - メールアドレスパターン判定を追加: 売主番号パターンの後、全件スキャンの前に `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` パスを追加する
    - メールアドレスハッシュ検索を実装: `crypto.createHash('sha256').update(lowerQuery).digest('hex')` でハッシュ化し `email_hash` で完全一致検索
    - フォールバック動作を維持: ハッシュ検索でヒットしない場合は既存の全件スキャンにフォールバック
    - `crypto` モジュールはファイル先頭で既にインポート済みのため追加不要
    - _Bug_Condition: isPhoneBugCondition(X) where X.matches(/^\d{7,}$/) / isEmailBugCondition(X) where X.matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)_
    - _Expected_Behavior: SHA-256ハッシュ化してphone_number_hash/email_hashカラムでDB検索し全件対象で一致売主を返す_
    - _Preservation: 売主番号・名前・住所・空クエリでの既存検索動作を変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 電話番号・メールアドレスのハッシュ検索
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する - 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば期待動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 非ハッシュ検索入力の動作保持
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する - 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント - 全テストが PASS することを確認する
  - 全テストが PASS することを確認する。疑問が生じた場合はユーザーに確認する。
