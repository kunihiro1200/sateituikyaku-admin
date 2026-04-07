# Implementation Plan

- [x] 1. バグ条件探索テストを作成（修正前）
  - **Property 1: Bug Condition** - 早期クリック時の全件表示バグ
  - **重要**: このテストは未修正コードで実行し、**失敗することを確認する**（失敗がバグの存在を証明）
  - **修正しようとしない**: テストが失敗しても、テストやコードを修正しない
  - **目的**: バグを再現する具体例（counterexample）を発見し、根本原因を理解する
  - **スコープ付きPBTアプローチ**: 決定的なバグのため、具体的な失敗ケース（サイドバーカウント取得後300ms～全件データ取得前23秒の間にカテゴリをクリック）にプロパティをスコープする
  - テスト実装の詳細（Bug Condition仕様より）:
    - ページ読み込み後500msで「担当(Y)」をクリック → 全件が表示される（バグ）
    - ページ読み込み後1秒で「当日TEL(Y)」をクリック → 全件が表示される（バグ）
    - ページ読み込み後500msで「内覧日前日」をクリック → 全件が表示される（バグ）
  - テストアサーションはExpected Behavior Propertiesと一致させる:
    - 該当カテゴリに属する買主のみが表示される
    - 全件データの取得状況に関わらず正しくフィルタリングが実行される
  - 未修正コードでテストを実行
  - **期待される結果**: テストが失敗する（これは正しい - バグが存在することを証明）
  - counterexampleを記録して根本原因を理解する
  - テストが作成され、実行され、失敗が記録されたらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_

- [x] 2. 保存プロパティテストを作成（修正前）
  - **Property 2: Preservation** - 全件データ取得済み時のフロント側フィルタリング保存
  - **重要**: 観察優先の方法論に従う
  - 未修正コードで非バグ入力（全件データ取得済みの状態）での動作を観察
  - Preservation Requirements仕様からの観察動作パターンを捕捉するproperty-based testを作成:
    - 全件データ取得済みの状態で「担当(Y)」をクリック → フロント側フィルタリングが継続
    - 検索クエリ入力後に「内覧日前日」をクリック → 検索とカテゴリフィルタの両方が適用
    - 「All」をクリック → 全件が表示
    - カテゴリクリック後もサイドバーカウントが正しく表示
  - Property-based testingは多数のテストケースを自動生成し、より強力な保証を提供
  - 未修正コードでテストを実行
  - **期待される結果**: テストが成功する（ベースライン動作を確認）
  - テストが作成され、実行され、未修正コードで成功したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 買主サイドバーフィルタ全件表示バグの修正

  - [x] 3.1 フロントエンド修正（BuyersPage.tsx）
    - フィルタリング条件の修正（148行目）: 全件データ未取得時でも`selectedCalculatedStatus`が指定されている場合はAPIにフィルタパラメータを渡す
    - APIパラメータの追加（206-213行目）: 全件データ未取得時のAPIコールに`calculatedStatus`パラメータを追加
    - カテゴリキー変換の追加: `selectedCalculatedStatus`（カテゴリキー）を日本語表示名に変換してからAPIに渡す（`categoryKeyToDisplayName`マッピングを使用）
    - エラーハンドリングの追加: APIエラー時のフォールバック処理を追加（`catch`ブロックでエラーログを出力し、空配列を返す）
    - _Bug_Condition: isBugCondition(input) where input.selectedStatus !== null AND input.clickTime > input.sidebarLoadTime AND input.clickTime < input.fullDataLoadTime AND allBuyersWithStatusRef.current.length === 0_
    - _Expected_Behavior: 該当カテゴリに属する買主のみを表示し、全件データの取得状況に関わらず正しくフィルタリングを実行する_
    - _Preservation: 全件データ取得済みの状態でのフロント側フィルタリング、検索クエリとの併用、サイドバーカウント表示を維持_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バックエンド修正（/api/buyers エンドポイント）
    - `backend/src/routes/buyers.ts`（18-73行目）で`calculatedStatus`パラメータを受け取る
    - `calculatedStatus`パラメータが指定されている場合、`getBuyersByStatus`を呼び出す
    - エラーハンドリングの追加: パラメータ処理エラー時のフォールバック処理
    - _Bug_Condition: isBugCondition(input) where input.selectedStatus !== null AND input.clickTime > input.sidebarLoadTime AND input.clickTime < input.fullDataLoadTime_
    - _Expected_Behavior: APIが`calculatedStatus`パラメータを正しく処理し、該当カテゴリのデータのみを返す_
    - _Preservation: 既存のAPI動作を維持（`calculatedStatus`が指定されていない場合は全件を返す）_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

  - [x] 3.3 バグ条件探索テストが成功することを検証
    - **Property 1: Expected Behavior** - 早期クリック時の正しいフィルタリング
    - **重要**: タスク1で作成した同じテストを再実行する - 新しいテストを作成しない
    - タスク1のテストはExpected Behaviorをエンコードしている
    - このテストが成功すると、Expected Behaviorが満たされていることを確認
    - タスク1のバグ条件探索テストを実行
    - **期待される結果**: テストが成功する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 保存テストが引き続き成功することを検証
    - **Property 2: Preservation** - 全件データ取得済み時のフロント側フィルタリング保存
    - **重要**: タスク2で作成した同じテストを再実行する - 新しいテストを作成しない
    - タスク2の保存プロパティテストを実行
    - **期待される結果**: テストが成功する（リグレッションがないことを確認）
    - 修正後も全てのテストが成功することを確認（リグレッションなし）

- [x] 4. チェックポイント - 全てのテストが成功することを確認
  - 全てのテストが成功することを確認し、疑問が生じた場合はユーザーに質問する
