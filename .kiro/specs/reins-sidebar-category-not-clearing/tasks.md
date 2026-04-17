# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - SUUMO URL登録後にsidebar_statusが再計算されないバグ
  - **重要**: このテストは未修正コードで必ず FAIL すること — FAIL がバグの存在を証明する
  - **修正やコードを直そうとしないこと（FAILしても）**
  - **注意**: このテストは期待動作をエンコードしている — 修正後にPASSすることでバグ解消を検証する
  - **目的**: バグが存在することを示す反例（counterexample）を見つける
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト内容（design.md の Bug Condition より）:
    - `sidebar_status = 'レインズ登録＋SUUMO登録'` かつ `suumo_url` が空の物件を用意する
    - `PropertyListingService.update(propertyNumber, { suumo_url: 'https://suumo.jp/...' })` を呼び出す
    - `sidebar_status` が「レインズ登録＋SUUMO登録」のまま変わらないことを確認する（未修正コードでFAIL）
    - isBugCondition: `X.sidebar_status = 'レインズ登録＋SUUMO登録' AND X.suumo_url IS NOT NULL AND X.suumo_url != ''`
    - 期待動作（expectedBehavior）: `result.sidebar_status != 'レインズ登録＋SUUMO登録'`
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 見つかった反例を記録して根本原因を理解する（例: `update({suumo_url: 'https://...'})` 後も `sidebar_status` が「レインズ登録＋SUUMO登録」のまま）
  - テストを作成・実行し、FAILを記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保存チェックのプロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - suumo_url非更新時のsidebar_status動作不変
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで `suumo_url` を含まないリクエストの動作を観察する:
    - `report_date` のみ更新 → `sidebar_status` が「未報告」に再計算されることを観察
    - `special_notes` のみ更新 → `sidebar_status` が変わらないことを観察
    - `suumo_url = ''`（空文字）で更新 → `sidebar_status` が「レインズ登録＋SUUMO登録」のままであることを観察
    - `suumo_registered = 'S不要'` の物件に `suumo_url` を登録 → 「レインズ登録＋SUUMO登録」に表示されないことを観察
  - 観察した動作パターンをプロパティベーステストとして記述する（design.md の Preservation Requirements より）:
    - `suumo_url` を含まないランダムなフィールド更新を生成し、修正前後で `sidebar_status` の計算結果が同一であることを確認
    - `suumo_url = ''` の場合は `sidebar_status` が「レインズ登録＋SUUMO登録」のままであることを確認
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが PASS する（これがベースライン動作を確認する）
  - テストを作成・実行し、PASSを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. suumo_url更新時のsidebar_status再計算バグを修正する

  - [x] 3.1 PropertyListingService.update() に suumo_url 更新検出ブロックを追加する
    - `backend/src/services/PropertyListingService.ts` の `update()` メソッドを修正する
    - `report_date` 再計算ブロック（L235〜L258）の直後に `'suumo_url' in updates` を検出するブロックを追加する
    - `suumo_url` が更新される場合、`getByPropertyNumber(propertyNumber)` で現在のDB値を取得する
    - `PropertyListingSyncService.fetchGyomuListDataFromWorkTasks()` を呼び出して `gyomuListData` を取得する
    - DB形式（`suumo_url` など）をスプレッドシート行形式（`row['Suumo URL']` など）に変換する
    - `calculateSidebarStatus(row, gyomuListData)` を呼び出し、結果を `updates.sidebar_status` に設定する
    - 再計算失敗時は既存パターンと同様に無視する（try/catch）
    - _Bug_Condition: `'suumo_url' in updates` かつ `updates.suumo_url` が空でない場合_
    - _Expected_Behavior: `updates.sidebar_status != 'レインズ登録＋SUUMO登録'`（calculateSidebarStatus()の結果）_
    - _Preservation: `suumo_url` を含まないリクエストはこのブロックをスキップし、既存動作を維持する_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - SUUMO URL登録後にsidebar_statusが正しく更新される
    - **重要**: タスク1で作成した同じテストを再実行する — 新しいテストを書かないこと
    - タスク1のテストは期待動作をエンコードしている
    - このテストがPASSすれば、期待動作が満たされたことを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保存チェックのプロパティテストが引き続き PASS することを確認する
    - **Property 2: Preservation** - suumo_url非更新時のsidebar_status動作不変
    - **重要**: タスク2で作成した同じテストを再実行する — 新しいテストを書かないこと
    - タスク2の保存チェックテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全ての既存動作が保持されていることを確認する

- [x] 4. チェックポイント — 全テストがPASSすることを確認する
  - 全テストがPASSすることを確認する。疑問点があればユーザーに確認する。
