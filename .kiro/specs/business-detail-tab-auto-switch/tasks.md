# 実装計画：業務詳細タブ自動切り替え

## 概要

業務一覧（`WorkTasksPage`）でカテゴリーを選択して行をクリックした際に、選択中のカテゴリーに応じて `WorkTaskDetailModal` の表示タブを自動的に切り替える機能を実装する。

## タスク

- [x] 1. WorkTaskDetailModal に initialTabIndex プロパティを追加
  - `WorkTaskDetailModalProps` インターフェースに `initialTabIndex?: number` を追加する
  - `open` の変化を監視する `useEffect` を追加し、`open === true` のとき `setTabIndex(initialTabIndex ?? 0)` を呼び出す
  - 既存の `useEffect([open, propertyNumber])` はデータ取得用のため変更しない
  - 対象ファイル: `frontend/frontend/src/components/WorkTaskDetailModal.tsx`
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 1.1 Property 2 のプロパティテストを作成する（fast-check）
    - **Property 2: initialTabIndex でのタブ初期表示**
    - 有効なタブインデックス（0〜3）を `initialTabIndex` として渡してモーダルを開いたとき、そのタブが `aria-selected="true"` になることを検証する
    - React Testing Library + fast-check を使用する
    - **Validates: Requirements 2.1, 2.2, 2.4**

  - [ ]* 1.2 Property 3 のプロパティテストを作成する（fast-check）
    - **Property 3: モーダル再オープン時のタブリセット**
    - `initialTabIndex=a` でモーダルを開いて閉じ、`initialTabIndex=b` で再度開いたとき、表示タブが `b` であることを検証する
    - **Validates: Requirements 2.3**

- [x] 2. WorkTasksPage に getInitialTabIndexFromCategory 関数と initialTabIndex state を追加
  - `getInitialTabIndexFromCategory(category: string | null): number` 関数をコンポーネント外に定義する
  - マッピングルール：「媒介」→ 0、「サイト」→ 1、「売買契約」「決済」「要台帳」→ 2、それ以外・null・空文字 → 0
  - `const [initialTabIndex, setInitialTabIndex] = useState(0)` を state として追加する
  - 対象ファイル: `frontend/frontend/src/pages/WorkTasksPage.tsx`
  - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 2.1 Property 1 のプロパティテストを作成する（fast-check）
    - **Property 1: カテゴリープレフィックスによるタブインデックスマッピング**
    - 「媒介」で始まる任意の文字列 → 0 を検証する
    - 「サイト」で始まる任意の文字列 → 1 を検証する
    - 「売買契約」「決済」「要台帳」で始まる任意の文字列 → 2 を検証する
    - null・空文字・「all」・その他の文字列 → 0 を検証する
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.2, 3.3**

  - [ ]* 2.2 getInitialTabIndexFromCategory の単体テストを作成する
    - `null` → 0、`''` → 0、`'all'` → 0、`'媒介作成_締日'` → 0 を検証する
    - `'サイト登録依頼してください'` → 1 を検証する
    - `'売買契約締結'` → 2、`'決済完了'` → 2、`'要台帳登録'` → 2 を検証する
    - _Requirements: 3.2, 3.3_

- [x] 3. WorkTasksPage の handleRowClick を修正して initialTabIndex を WorkTaskDetailModal に渡す
  - `handleRowClick` 内で `setInitialTabIndex(getInitialTabIndexFromCategory(selectedCategory))` を呼び出す
  - `WorkTaskDetailModal` に `initialTabIndex={initialTabIndex}` プロパティを追加する
  - 対象ファイル: `frontend/frontend/src/pages/WorkTasksPage.tsx`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.4_

- [x] 4. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## Notes

- `*` が付いたサブタスクはオプションであり、MVP では省略可能
- Property 1 のテストは fast-check の `fc.string().map(s => 'プレフィックス' + s)` パターンで実装する
- Property 2・3 のテストは React Testing Library と fast-check を組み合わせて実装する
- 既存の `open`・`onClose`・`propertyNumber`・`onUpdate`・`initialData` プロパティの動作は変更しない（Requirements 4.3）
