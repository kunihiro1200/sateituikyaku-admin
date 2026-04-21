# 実装計画：物件リスト詳細画面「一般媒介非公開（仮）」フィールド追加

## 概要

`PropertyListingDetailPage` に「一般媒介非公開（仮）」フィールドを追加する。
バックエンドに専用の PUT エンドポイントを追加し、フロントエンドにボタン UI を実装する。
サイドバーに「非公開予定（確認後）」カテゴリーを追加してリアルタイム更新に対応する。

## タスク

- [x] 1. バックエンド：`updateGeneralMediationPrivate` サービスメソッドの追加
  - `backend/src/services/PropertyListingService.ts` に `updateGeneralMediationPrivate(propertyNumber, value)` メソッドを追加する
  - DB の `general_mediation_private` カラムを更新し、`updated_at` も更新する
  - 更新成功後に `syncToSpreadsheet` を呼び出してDD列へ同期する（失敗はサイレント処理）
  - _Requirements: 3.2, 3.4, 3.5, 4.1, 4.2, 4.3_

  - [ ]* 1.1 サービスメソッドのユニットテストを作成する
    - 有効な値（「非公開予定」「不要」）でDB更新が成功すること
    - スプレッドシート同期失敗時でも例外をスローしないこと
    - DB更新失敗時に例外をスローすること
    - _Requirements: 3.4, 3.5, 4.2_

- [x] 2. バックエンド：PUT エンドポイントの追加
  - `backend/src/routes/propertyListings.ts` に `PUT /:propertyNumber/general-mediation-private` ルートを追加する
  - リクエストボディの `generalMediationPrivate` が「非公開予定」または「不要」以外の場合は HTTP 400 を返す
  - 成功時は HTTP 200 と `{ success: true }` を返す
  - DB更新失敗時は HTTP 500 を返す
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 2.1 プロパティテスト：無効値に対するAPIバリデーション（プロパティ3）
    - **Property 3: 無効値に対するAPIバリデーション**
    - 「非公開予定」でも「不要」でもない任意の文字列を送信した場合、HTTP 400 が返ること
    - **Validates: Requirements 3.3**

  - [ ]* 2.2 APIエンドポイントの統合テストを作成する
    - 有効な値でDB更新が成功し HTTP 200 が返ること
    - スプレッドシート同期失敗時でも HTTP 200 が返ること（1例）
    - _Requirements: 3.4, 4.2_

- [x] 3. チェックポイント - バックエンドのテストが全て通ることを確認する
  - 全てのテストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 4. フロントエンド：`PropertyListing` インターフェースと状態変数の追加
  - `PropertyListingDetailPage.tsx` の `PropertyListing` インターフェースに `general_mediation_private?: string` フィールドを追加する
  - `generalMediationPrivate` と `generalMediationPrivateUpdating` の状態変数を追加する
  - データ取得時に `general_mediation_private` の値を状態変数に反映する
  - `PropertySidebarStatus.tsx` の `PropertyListing` インターフェースにも `general_mediation_private?: string` を追加する
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. フロントエンド：`shouldShowGeneralMediationPrivate` ヘルパー関数の実装
  - `PropertyListingDetailPage.tsx` に `shouldShowGeneralMediationPrivate(atbbStatus)` 関数を実装する
  - `atbb_status` に「一般」が含まれる場合のみ `true` を返す
  - null・undefined・空文字の場合は `false` を返す
  - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 5.1 プロパティテスト：表示条件の普遍性（プロパティ1）
    - **Property 1: 表示条件の普遍性**
    - 任意の `atbb_status` 文字列・null・undefined に対して、「一般」を含む場合のみ `true` を返すこと
    - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 6. フロントエンド：`handleUpdateGeneralMediationPrivate` ハンドラーと ButtonGroup UI の実装
  - `handleUpdateGeneralMediationPrivate(value)` 関数を実装する（API呼び出し・状態更新・スナックバー表示・CustomEvent発火）
  - ATBB状況フィールドの右隣に `ButtonGroup`（「非公開予定」「不要」）を配置する
  - `shouldShowGeneralMediationPrivate` が `true` の場合のみ表示する
  - 処理中は `disabled` にして二重送信を防止する
  - _Requirements: 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2_

  - [ ]* 6.1 プロパティテスト：ボタンバリアントの正確性（プロパティ2）
    - **Property 2: ボタンバリアントの正確性**
    - 任意の `general_mediation_private` 値に対して、「非公開予定」の場合のみ `contained` + `color="error"` になること
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 6.2 ボタン UI のユニットテストを作成する
    - ボタンクリック時に正しいAPIエンドポイントへリクエストが送信されること
    - 処理中（updating=true）にボタンが `disabled` になること
    - 成功時にスナックバーが表示されること
    - 失敗時にエラースナックバーが表示されること
    - _Requirements: 2.4, 2.5, 2.6, 5.1, 5.2_

- [x] 7. フロントエンド：`PropertyListingsPage.tsx` へのリアルタイム更新イベントリスナー追加
  - `generalMediationPrivateUpdated` CustomEvent のリスナーを `useEffect` で登録する
  - イベント受信時に `allListings` の該当物件の `general_mediation_private` を更新する
  - コンポーネントアンマウント時にリスナーを解除する
  - _Requirements: 6.3, 6.4_

- [x] 8. フロントエンド：`PropertyListingsPage.tsx` へのサイドバーフィルタリング追加
  - `sidebarStatus === '非公開予定（確認後）'` の場合に `general_mediation_private === '非公開予定'` の物件のみを返すフィルタリングを追加する
  - _Requirements: 6.2_

- [x] 9. フロントエンド：`PropertySidebarStatus.tsx` への「非公開予定（確認後）」カテゴリー追加
  - `statusCounts` の `useMemo` に `general_mediation_private === '非公開予定'` の件数を `'非公開予定（確認後）'` キーで追加する
  - _Requirements: 6.1, 6.5_

  - [ ]* 9.1 プロパティテスト：サイドバーカウントの正確性（プロパティ4）
    - **Property 4: サイドバーカウントの正確性**
    - 任意の物件リストに対して、「非公開予定（確認後）」バッジ件数が `general_mediation_private === '非公開予定'` の物件数と一致すること
    - **Validates: Requirements 6.1, 6.5**

  - [ ]* 9.2 プロパティテスト：サイドバーフィルタリングの完全性（プロパティ5）
    - **Property 5: サイドバーフィルタリングの完全性**
    - 任意の物件リストに対して、「非公開予定（確認後）」フィルタリング結果が漏れなし・余分なしであること
    - **Validates: Requirements 6.2, 6.3, 6.4**

- [x] 10. 最終チェックポイント - 全テストが通ることを確認する
  - 全てのテストが通ることを確認し、疑問点があればユーザーに確認する。

## 備考

- `*` が付いたサブタスクはオプションであり、MVP優先の場合はスキップ可能
- プロパティベーステストには `fast-check` を使用し、最低100回のイテレーションを実行する
- `general_mediation_private` フィールドはDBとスプレッドシートのカラムマッピングに既に存在するため、マイグレーションは不要
- `STATUS_PRIORITY` の `'非公開予定（確認後）': 11` は既に定義済みのため変更不要
