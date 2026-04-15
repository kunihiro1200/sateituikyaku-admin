# 実装計画：買主内覧結果ページ機能拡張

## 概要

`BuyerViewingResultPage`（`frontend/frontend/src/pages/BuyerViewingResultPage.tsx`）に対して、後続担当「業者」ボタンの追加・必須強調表示・カレンダーボタン有効化制御の3機能を段階的に実装する。

## タスク

- [x] 1. 必須判定・カレンダー有効化ロジックの追加
  - [x] 1.1 `isCalendarEnabled` 計算値を実装する
    - `viewing_date`・`viewing_time`・`follow_up_assignee`・内覧形態（専任は `viewing_mobile`、一般は `viewing_type_general`）の4条件がすべて非空の場合のみ `true` になる計算値を追加する
    - `linkedProperties?.[0]?.atbb_status` を参照して物件種別を判定する
    - _Requirements: 3.1, 3.2, 3.5_

  - [ ]* 1.2 プロパティテスト：4条件が揃った場合のみカレンダーボタンが有効になる
    - **Property 1: 4条件が揃った場合のみカレンダーボタンが有効になる**
    - `fast-check` を使用し、`viewing_date`・`viewing_time`・`follow_up_assignee`・内覧形態の任意の組み合わせに対して `isCalendarEnabled` の真偽値が正しいことを検証する
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 1.3 プロパティテスト：内覧形態の参照フィールドは物件種別に依存する
    - **Property 2: 内覧形態の参照フィールドは物件種別に依存する**
    - 専任物件では `viewing_mobile`、一般媒介物件では `viewing_type_general` を参照することを検証する
    - **Validates: Requirements 3.5**

- [x] 2. カレンダーボタンの有効/無効表示を実装する
  - `isCalendarEnabled` が `false` の場合に `disabled` プロパティを付与し、グレーアウトスタイルを適用する
  - `isCalendarEnabled` が `true` の場合は既存の `calendarPulse` アニメーションを維持する
  - _Requirements: 3.2, 3.3, 3.4_

  - [ ]* 2.1 ユニットテスト：カレンダーボタンの有効/無効スタイル
    - 有効時に `calendarPulse` が適用されること、無効時にグレーアウトスタイルが適用されることをテストする
    - _Requirements: 3.3, 3.4_

- [ ] 3. チェックポイント - ここまでのテストがすべて通ることを確認する
  - すべてのテストが通ることを確認し、疑問点があればユーザーに確認する。

- [ ] 4. 必須強調表示ロジックの追加
  - [x] 4.1 必須強調表示の計算値を実装する
    - `hasViewingDate`・`isTimeRequired`・`isViewingTypeRequired`・`isFollowUpRequired` の各計算値を追加する
    - 各フィールドに値が入力された場合に対応する強調表示フラグが `false` になることを確認する
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 4.2 時間・内覧形態・後続担当フィールドに必須強調表示を適用する
    - 各フィールドのラベルと枠に赤色スタイル（赤枠・赤ラベル）を条件付きで適用する
    - `isTimeRequired`・`isViewingTypeRequired`・`isFollowUpRequired` が `true` の場合のみ強調表示する
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 4.3 ユニットテスト：必須強調表示の表示/非表示
    - `viewing_date` が設定されると3フィールドに赤枠・赤ラベルが表示されること、各フィールドに値が入力されると強調表示が解除されることをテストする
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ] 5. 後続担当「業者」ボタンの追加
  - [x] 5.1 「業者」ボタンを後続担当ボタン群の末尾に追加する
    - `staffInitials` のマップ後に「業者」ボタンを追加する
    - クリック時に `follow_up_assignee` を `'業者'` にセット、選択済みで再クリックすると空文字にクリアするトグル動作を実装する
    - `handleInlineFieldSave('follow_up_assignee', newValue)` を呼び出して保存し、エラー時はロールバックする
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 5.2 ユニットテスト：「業者」ボタンのトグル動作
    - クリックで `'業者'` がセットされること、再クリックで空文字にクリアされることをテストする
    - _Requirements: 1.2, 1.3_

- [x] 6. `handleCalendarButtonClick` に「業者」対応を追加する
  - `follow_up_assignee === '業者'` の場合は従業員マスタ検索をスキップし、`tenant@ifoo-oita.com` を直接 `assignedEmail` に設定する
  - _Requirements: 1.4, 1.5_

  - [ ]* 6.1 ユニットテスト：「業者」選択時のカレンダーURL
    - `follow_up_assignee === '業者'` の状態でカレンダーボタンをクリックすると、生成されるURLに `tenant@ifoo-oita.com` が含まれることをテストする
    - _Requirements: 1.4, 1.5_

- [ ] 7. 最終チェックポイント - すべてのテストが通ることを確認する
  - すべてのテストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件番号との対応を明記しており、トレーサビリティを確保している
- プロパティテストには `fast-check` を使用する
- 変更対象ファイルは `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` のみ
