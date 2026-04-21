# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 非公開予定（確認後）カウントとフィルタリングの不一致
  - **重要**: このテストは未修正コードで**失敗する**ことが期待される — 失敗がバグの存在を証明する
  - **修正を試みないこと** — テストが失敗してもコードを修正しない
  - **目的**: バグが存在することを示すカウンターエグザンプルを発見する
  - **スコープ**: `calculatePropertyStatus()` が `private_pending` 以外を返すが `general_mediation_private === '非公開予定'` である物件に絞る
  - テストケース1: `general_mediation_private === '非公開予定'` かつ `report_date` が今日以前の物件 → カウントが1なのにフィルタリング結果が0件になることを確認
  - テストケース2: `general_mediation_private === '非公開予定'` かつ `confirmation === '未'` の物件 → 同様の不一致を確認
  - テストケース3: `general_mediation_private === '非公開予定'` かつ `price_reduction_scheduled_date` が今日以前の物件 → 同様の不一致を確認
  - `PropertySidebarStatus.tsx` のカウント計算（`listings.filter(l => l.general_mediation_private === '非公開予定').length`）と `PropertyListingsPage.tsx` のフィルタリング（`calculatePropertyStatus().key === 'private_pending'`）が異なる結果を返すことをアサート
  - 未修正コードでテストを実行する
  - **期待される結果**: テスト**失敗**（バグが存在することの証明）
  - カウンターエグザンプルを記録する（例: 「`report_date` が今日以前の物件でカウント=1、フィルタリング=0件」）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 他カテゴリーの動作保全
  - **重要**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`isBugCondition(X)` が false の物件）の動作を観察・記録する
  - 観察1: `calculatePropertyStatus()` が `private_pending` を返す物件（正常ケース）が「非公開予定（確認後）」に正しくカウントされることを確認
  - 観察2: `report_date` が今日以前の物件が「未報告」に正しくカウントされ、クリック時に表示されることを確認
  - 観察3: `confirmation === '未'` の物件が「未完了」に正しくカウントされ、クリック時に表示されることを確認
  - 観察4: `price_reduction_scheduled_date` が今日以前の物件が「要値下げ」に正しくカウントされることを確認
  - 観察5: 「すべて」カテゴリーで全物件が表示されることを確認
  - 観察した動作をプロパティベーステストとして記述する（多様な入力で強力な保証を提供）
  - 未修正コードでテストを実行する
  - **期待される結果**: テスト**成功**（保全すべきベースライン動作の確認）
  - テストを作成・実行し、成功を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. 非公開予定（確認後）カテゴリー同期バグの修正

  - [x] 3.1 `PropertySidebarStatus.tsx` のカウント計算を修正する
    - `statusCounts` の `useMemo` 内（L207-212付近）を修正する
    - `listings.filter(l => l.general_mediation_private === '非公開予定').length` による別途カウント計算を削除する
    - `forEach` ループ内に `computed.key === 'private_pending'` の分岐を追加し、`counts['非公開予定（確認後）']` をインクリメントする
    - 変更後: `if (computed.key === 'private_pending') { counts['非公開予定（確認後）'] = (counts['非公開予定（確認後）'] || 0) + 1; return; }`
    - `generalMediationPrivateCount` 変数および関連するコードを全て削除する
    - _Bug_Condition: `calculatePropertyStatus(X).key !== 'private_pending' AND X.general_mediation_private === '非公開予定'`_
    - _Expected_Behavior: `calculatePropertyStatus()` が `private_pending` を返す物件のみが「非公開予定（確認後）」にカウントされる_
    - _Preservation: 他カテゴリー（未報告、未完了、要値下げ等）のカウントロジックは変更しない_
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 3.2 `PropertyListingsPage.tsx` のフィルタリングロジックを修正する
    - `sidebarStatus === '非公開予定（確認後）'` の分岐（L340-342付近）を修正する
    - `listings.filter(l => l.general_mediation_private === '非公開予定')` を `listings.filter(l => calculatePropertyStatus(l as any, workTaskMap).key === 'private_pending')` に変更する
    - `calculatePropertyStatus` が既にインポートされているか確認し、必要であればインポートを追加する
    - _Bug_Condition: `calculatePropertyStatus(X).key !== 'private_pending' AND X.general_mediation_private === '非公開予定'`_
    - _Expected_Behavior: フィルタリングが `calculatePropertyStatus()` の結果と一致し、カウントと表示件数が常に同じになる_
    - _Preservation: 他カテゴリーのフィルタリングロジックは変更しない_
    - _Requirements: 2.2, 2.3, 2.5_

  - [x] 3.3 バグ条件の探索テストが成功することを確認する
    - **Property 1: Expected Behavior** - 非公開予定（確認後）カウントとフィルタリングの一致
    - **重要**: タスク1で作成した**同じテスト**を再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしており、修正後に成功することで期待動作が満たされたことを確認する
    - バグ条件の探索テスト（タスク1）を実行する
    - **期待される結果**: テスト**成功**（バグが修正されたことの確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 保全テストが引き続き成功することを確認する
    - **Property 2: Preservation** - 他カテゴリーの動作保全
    - **重要**: タスク2で作成した**同じテスト**を再実行する — 新しいテストを書かない
    - 保全プロパティテスト（タスク2）を実行する
    - **期待される結果**: テスト**成功**（リグレッションなしの確認）
    - 修正前後で「非公開予定（確認後）」以外の全カテゴリーの動作が変わらないことを確認する

- [x] 4. チェックポイント — 全テストの成功確認
  - 全テストが成功していることを確認する
  - 疑問点があればユーザーに確認する
