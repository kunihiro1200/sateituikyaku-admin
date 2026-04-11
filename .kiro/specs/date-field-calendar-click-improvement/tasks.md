# 実装計画: 日付フィールドカレンダークリック改善

## 概要

`showPicker()` APIを使用して、各画面の日付フィールドの入力枠内のどこをクリックしてもカレンダーが表示されるようにする。UIの見た目は変更せず、クリック可能な領域のみを拡大する。

## タスク

- [x] 1. InlineEditableField の date型フィールドに showPicker() を追加
  - [x] 1.1 `case 'date'` の TextField に `onClick` ハンドラーを追加する
    - `inputRef.current?.showPicker?.()` をオプショナルチェーンで安全に呼び出す
    - `frontend/frontend/src/components/InlineEditableField.tsx` を編集
    - _Requirements: 3.1, 5.1_

  - [x] 1.2 `isEditing` の useEffect で date型のとき自動的に showPicker() を呼び出す
    - `fieldType === 'date'` の場合のみ `setTimeout(..., 0)` 経由で `showPicker()` を呼び出す
    - `try-catch` で SecurityError を無視する
    - _Requirements: 4.1_

  - [ ]* 1.3 date型でshowPickerが呼ばれることのプロパティテストを書く
    - **Property 1: date型InlineEditableFieldの編集モード切替でshowPickerが呼ばれる**
    - **Validates: Requirements 4.1**

  - [ ]* 1.4 date以外の型でshowPickerが呼ばれないことのプロパティテストを書く
    - **Property 2: date以外の型ではshowPickerが呼ばれない**
    - **Validates: Requirements 4.3**

- [x] 2. WorkTaskDetailModal の date/datetime-local型フィールドに showPicker() を追加
  - [x] 2.1 `type="date"` の TextField に `onClick` ハンドラーを追加する
    - `e.currentTarget.querySelector('input')?.showPicker?.()` で input 要素を取得して呼び出す
    - 対象フィールド: サイト登録納期予定日、サイト登録確認依頼日、間取図完了予定日、間取図完了日、配信日、公開予定日
    - `frontend/frontend/src/components/WorkTaskDetailModal.tsx` を編集
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 2.2 date型フィールドのクリックでshowPickerが呼ばれることのユニットテストを書く
    - _Requirements: 6.1_

- [x] 3. チェックポイント - ここまでのテストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 4. CallModePage の次電日・訪問予定日時フィールドに showPicker() を追加
  - [x] 4.1 次電日フィールド（type="date"）に `inputRef` と `onClick` を追加する
    - `const nextCallDateRef = useRef<HTMLInputElement>(null)` を追加
    - TextField に `inputRef={nextCallDateRef}` と `onClick={() => nextCallDateRef.current?.showPicker?.()}` を追加
    - `frontend/frontend/src/pages/CallModePage.tsx` を編集
    - _Requirements: 1.1_

  - [x] 4.2 訪問予定日時フィールド（type="datetime-local"）に `inputRef` と `onClick` を追加する
    - `const appointmentDateRef = useRef<HTMLInputElement>(null)` を追加
    - TextField に `inputRef={appointmentDateRef}` と `onClick={() => appointmentDateRef.current?.showPicker?.()}` を追加
    - `frontend/frontend/src/pages/CallModePage.tsx` を編集
    - _Requirements: 2.1_

  - [ ]* 4.3 次電日・訪問予定日時フィールドのクリックでshowPickerが呼ばれることのユニットテストを書く
    - _Requirements: 1.1, 2.1_

- [x] 5. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVPとして省略可能
- `showPicker()` の呼び出しはすべてオプショナルチェーン（`?.`）で安全に行う
- `useEffect` 内での呼び出しは `setTimeout(..., 0)` + `try-catch` で SecurityError を回避する
- データモデル・APIの変更は一切なし
