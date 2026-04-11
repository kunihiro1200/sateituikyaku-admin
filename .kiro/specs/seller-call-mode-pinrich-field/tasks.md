# 実装計画: 売主通話モードページ Pinrichフィールド追加

## 概要

変更対象は2ファイルのみ。バックエンドの`updateSeller`にpinrich_status更新処理を追加し、フロントエンドのCallModePageにPinrichフィールドのUIを追加する。

## タスク

- [x] 1. バックエンド: SellerService.supabase.ts の updateSeller に pinrich_status 更新処理を追加
  - `backend/src/services/SellerService.supabase.ts` の `updateSeller` メソッドに、`pinrichStatus` フィールドを受け取った場合に `pinrich_status` カラムを更新する処理を追加する
  - 既存の他フィールド（例: `unreachableStatus` など）の更新パターンに倣って実装する
  - `pinrichStatus` が `undefined` の場合はスキップ、`null` の場合は `null` としてDBに保存する
  - _Requirements: 3.1_

- [x] 2. フロントエンド: CallModePage.tsx に Pinrich フィールドを追加
  - [x] 2.1 状態変数と初期化処理の追加
    - `editedPinrichStatus` の `useState` を追加する
    - `loadAllData` 内で `sellerData.pinrichStatus || ''` で初期化する
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.2 handleUpdateStatus への pinrichStatus 送信処理の追加
    - `api.put('/api/sellers/:id', {...})` の送信データに `pinrichStatus: editedPinrichStatus || null` を追加する
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 2.3 ステータスセクションへの Pinrich フィールド UI の追加
    - 除外日フィールド（`<Grid item xs={6}>`）の右側に、同じ `xs={6}` の Grid item として Pinrich フィールドを追加する
    - 除外日と同じ border 付き Box 形式で表示する
    - `TextField`（`variant="standard"`, `InputProps={{ disableUnderline: true }}`）で編集可能にする
    - 値変更時に `setStatusChanged(true)` を呼び出す
    - `placeholder="－"` を設定する
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2_

  - [ ]* 2.4 Property 1 のプロパティテストを作成: Pinrich値の表示ラウンドトリップ
    - **Property 1: Pinrich値の表示ラウンドトリップ**
    - **Validates: Requirements 1.2, 3.3**
    - 任意の有効な `pinrichStatus` 文字列を持つ売主データに対して、`editedPinrichStatus` の初期値がその値と一致することを検証する

  - [ ]* 2.5 Property 2 のプロパティテストを作成: 空のPinrich値は「－」を表示する
    - **Property 2: 空のPinrich値は「－」を表示する**
    - **Validates: Requirements 1.3**
    - null / undefined / 空文字列 / 空白のみの文字列に対して、`placeholder="－"` が表示されることを検証する（`editedPinrichStatus` が falsy になること）

  - [ ]* 2.6 Property 3 のプロパティテストを作成: Pinrich変更でstatusChangedがtrueになる
    - **Property 3: Pinrich変更でstatusChangedがtrueになる**
    - **Validates: Requirements 2.2**
    - 任意の文字列を `TextField` の `onChange` に渡した場合、`setStatusChanged(true)` が呼ばれることを検証する

- [ ] 3. チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [ ] 4. isPinrichEmpty 関数のテスト（既存関数の動作確認）
  - [ ]* 4.1 isPinrichEmpty のユニットテストを作成
    - `frontend/src/utils/sellerStatusFilters.test.ts`（または既存テストファイル）に `isPinrichEmpty` のユニットテストを追加する
    - `pinrichStatus` が空・null・値あり・当日TEL分条件を満たさない場合の各ケースをテストする
    - _Requirements: 5.1, 5.2_

  - [ ]* 4.2 Property 4 のプロパティテストを作成: isPinrichEmptyの一貫性
    - **Property 4: isPinrichEmptyの一貫性**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - `fast-check` を使用し、任意の `pinrichStatus` 文字列に対して `isPinrichEmpty(seller)` の結果が `!pinrichStatus || pinrichStatus.trim() === ''` と一致することを検証する（numRuns: 100）

- [ ] 5. 最終チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 備考

- `*` 付きのタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは対応する要件番号を参照している
- 既実装済みの機能（DB カラム、column-mapping.json、EnhancedAutoSyncService、isPinrichEmpty、decryptSeller の pinrichStatus マッピング、Seller 型定義）は変更不要
- タスク完了後、`.kiro/specs/seller-call-mode-pinrich-field/tasks.md` の各タスクの「Start task」からコード生成を開始できる
