# 実装計画：次電日変更確認ポップアップ

## 概要

通話モードページ（`CallModePage.tsx`）に、ページ遷移時に「次電日は変更しましたか？」と注意喚起する確認ダイアログを追加する。バックエンド変更は不要で、フロントエンドのみの実装となる。

## タスク

- [x] 1. ユーティリティ関数と純粋関数の実装
  - [x] 1.1 `isInquiryDateElapsed3Days` 関数を実装する
    - `frontend/frontend/src/pages/CallModePage.tsx` にエクスポート関数として追加
    - JST基準で反響日付からの経過日数を計算し、翌日を1日目として3日以上経過で `true` を返す
    - `null` / `undefined` / 不正な日付の場合は `false` を返す
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 1.2 `isInquiryDateElapsed3Days` のプロパティテストを書く（fast-check）
    - **Property 1: 経過日数判定の境界値**
    - 任意の経過日数（0〜365）に対して、3日以上なら `true`、2日以下なら `false` を返すことを検証
    - **Validates: Requirements 5.2**

  - [x] 1.3 `shouldShowReminderDialog` 関数を実装する
    - `frontend/frontend/src/pages/CallModePage.tsx` にエクスポート関数として追加
    - 4つの boolean 引数（`isElapsed`, `isFollowingUp`, `pageEdited`, `nextCallDateUnchanged`）を受け取り、全て `true` の場合のみ `true` を返す
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 1.4 `shouldShowReminderDialog` のプロパティテストを書く（fast-check）
    - **Property 2: 4条件の複合判定**
    - 任意の4つの boolean の組み合わせに対して、全て `true` の場合のみ `true` を返すことを検証
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 2. `NextCallDateReminderDialog` コンポーネントの新規作成
  - [x] 2.1 `frontend/frontend/src/components/NextCallDateReminderDialog.tsx` を作成する
    - Props: `open: boolean`, `onGoToNextCallDate: () => void`, `onProceed: () => void`
    - MUI `Dialog` を使用し、既存の `NavigationBlockDialog` のスタイルに倣う
    - 「次電日は変更しましたか？」メッセージを表示
    - 「次電日を変更する」ボタン（`onGoToNextCallDate` を呼ぶ）
    - 「このまま移動する」ボタン（`onProceed` を呼ぶ）
    - backdrop click（`onClose`）は `onGoToNextCallDate` と同じ動作にする
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 2.2 `NextCallDateReminderDialog` の単体テストを書く
    - `open=true` 時にメッセージ・各ボタンが表示されることを確認
    - 「次電日を変更する」クリックで `onGoToNextCallDate` が呼ばれることを確認
    - 「このまま移動する」クリックで `onProceed` が呼ばれることを確認
    - backdrop click で `onGoToNextCallDate` が呼ばれることを確認
    - _Requirements: 3.4, 3.5, 3.6_

- [x] 3. `CallModePage` への `pageEdited` state と編集フラグ追跡の追加
  - [x] 3.1 `pageEdited` state と `nextCallDateReminderDialog` state を追加する
    - `const [pageEdited, setPageEdited] = useState<boolean>(false);` を追加
    - `const [nextCallDateReminderDialog, setNextCallDateReminderDialog] = useState<{ open: boolean; onProceed: (() => void) | null }>({ open: false, onProceed: null });` を追加
    - _Requirements: 1.1_

  - [x] 3.2 `id` パラメータ変更時に `pageEdited` を `false` にリセットする
    - 既存の `id` 依存の `useEffect` 内、またはデータ初期化処理内で `setPageEdited(false)` を呼ぶ
    - _Requirements: 1.12_

  - [x] 3.3 各編集操作に `setPageEdited(true)` を追加する
    - コメント欄変更時（`editableComments` の変更ハンドラ）
    - 不通ステータス変更時（`unreachableStatus` の変更ハンドラ）
    - メール送信実行時（送信成功コールバック）
    - SMS送信実行時（送信成功コールバック）
    - ステータス変更時（`editedStatus` の変更ハンドラ）
    - 確度変更時（`editedConfidence` の変更ハンドラ）
    - 物件情報保存時（`handleSaveProperty` 等の保存成功後）
    - 売主情報保存時（`handleSaveSeller` 等の保存成功後）
    - 訪問予約保存時（`handleSaveAppointment` 等の保存成功後）
    - 追客ログ（通話メモ）保存時（`handleSaveMemo` 等の保存成功後）
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_

- [x] 4. チェックポイント - ここまでのテストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 5. `navigateWithWarningCheck` への `NextCallDateReminderDialog` 判定の組み込み
  - [x] 5.1 遷移判定ロジックを拡張する
    - 既存の `NavigationBlockDialog` 判定（追客中かつ次電日が空）を最優先で維持する
    - その後、`shouldShowReminderDialog` を使って4条件を評価する
    - 条件を満たす場合は `setNextCallDateReminderDialog({ open: true, onProceed: callback })` を呼ぶ
    - 条件を満たさない場合は既存の `NavigationWarningDialog` 判定へ続く
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 5.2 `navigateWithWarningCheck` 拡張ロジックの単体テストを書く
    - `NavigationBlockDialog` 条件が優先されることを確認
    - 4条件が全て揃った場合に `nextCallDateReminderDialog` が開くことを確認
    - 4条件のいずれかが欠けた場合にダイアログが開かないことを確認
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 6. `NextCallDateReminderDialog` のハンドラ実装と JSX への組み込み
  - [x] 6.1 「次電日を変更する」ハンドラ（`onGoToNextCallDate`）を実装する
    - `nextCallDateReminderDialog` を閉じる
    - `nextCallDateRef.current` が存在する場合、`scrollIntoView` + `focus()` を呼ぶ
    - _Requirements: 3.4, 3.6_

  - [x] 6.2 「このまま移動する」ハンドラ（`onProceed`）を実装する
    - `nextCallDateReminderDialog` を閉じる
    - 保持していた `onProceed` コールバックを実行する（`null` の場合は何もしない）
    - コールバック実行前に既存の `NavigationWarningDialog` 判定を行う
    - _Requirements: 3.5, 4.1, 4.2_

  - [x] 6.3 `NextCallDateReminderDialog` コンポーネントを JSX に追加する
    - `CallModePage` の return 内、既存の `NavigationBlockDialog` の近くに配置
    - `open`, `onGoToNextCallDate`, `onProceed` を適切に渡す
    - _Requirements: 3.1, 4.3_

- [x] 7. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたサブタスクはオプションであり、MVP優先の場合はスキップ可能
- プロパティテストには **fast-check** を使用する（既存プロジェクトの標準ライブラリ）
- `savedNextCallDate` は `CallModePage` に既存のため追加不要
- `nextCallDateRef` は `CallModePage` に既存のため追加不要
- バックエンド変更は一切不要
