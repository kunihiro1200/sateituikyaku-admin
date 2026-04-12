# 実装計画: seller-followup-navigation-block

## 概要

CallModePageにおいて、追客中ステータスかつ次電日未入力の場合に遷移を完全ブロックする機能を実装する。
NavigationBlockDialogコンポーネントの新規作成、shouldBlockNavigation判定ロジックの追加、全遷移経路へのブロックチェック適用を順に行う。

## タスク

- [x] 1. NavigationBlockDialogコンポーネントの作成
  - `frontend/frontend/src/components/NavigationBlockDialog.tsx` を新規作成する
  - `open` プロップと `onGoToNextCallDate` コールバックのみを持つシンプルな構成にする
  - 「このまま移動する」ボタンは含めない（`onClose` プロップも持たない）
  - 「追客中の売主は次電日の入力が必須です」というメッセージを表示する
  - 「次電日を入力する」ボタンを表示し、クリック時に `onGoToNextCallDate` を呼ぶ
  - _Requirements: 2.2, 2.3, 2.4, 5.1, 5.2_

- [x] 2. CallModePageへの判定ロジックと状態の追加
  - [x] 2.1 `shouldBlockNavigation()` 関数と `navigationBlockDialog` stateを追加する
    - `seller?.status?.includes('追客中')` と `!!editedNextCallDate` で判定する
    - `seller` が null の場合は false を返す
    - `navigationBlockDialog: { open: boolean }` stateを追加する
    - _Requirements: 1.1, 1.3, 1.4, 2.1_

  - [ ]* 2.2 `shouldBlockNavigation` のプロパティテストを書く（fast-check）
    - **Property 1: 追客中判定の部分一致**
    - **Validates: Requirements 1.1, 1.3, 1.4**

  - [ ]* 2.3 `shouldBlockNavigation` の完全性プロパティテストを書く（fast-check）
    - **Property 2: 遷移ブロック条件の完全性**
    - **Validates: Requirements 2.1, 5.4**

- [x] 3. handleBackとnavigateWithWarningCheckへのブロックチェック追加
  - [x] 3.1 `handleBack` の先頭に `shouldBlockNavigation()` チェックを追加する
    - true の場合は `setNavigationBlockDialog({ open: true })` して return する
    - 既存の確度・1番電話チェックはそのまま維持する
    - _Requirements: 2.1, 3.1, 4.1, 4.3_

  - [x] 3.2 `navigateWithWarningCheck` の先頭に同様のブロックチェックを追加する
    - true の場合は `setNavigationBlockDialog({ open: true })` して return する
    - _Requirements: 2.1, 4.1, 4.3_

  - [ ]* 3.3 優先順位のプロパティテストを書く（fast-check）
    - **Property 3: 次電日ブロックの優先順位**
    - **Validates: Requirements 4.1, 4.3**

- [ ] 4. チェックポイント - ここまでのテストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 5. ブラウザ戻るボタン対応（popstateイベント）
  - [x] 5.1 `popstate` イベントハンドラーのuseEffectを追加する
    - マウント時に `window.history.pushState(null, '', window.location.href)` でダミーエントリを追加する
    - `handlePopState` 内で `shouldBlockNavigation()` を判定する
    - ブロック時は `window.history.pushState` で戻しつつ `setNavigationBlockDialog({ open: true })` する
    - 非ブロック時は `navigateWithWarningCheck(() => navigate('/sellers'))` を呼ぶ
    - 依存配列は `[seller?.status, editedNextCallDate]` とする
    - _Requirements: 3.4_

- [x] 6. PageNavigationとSellerStatusSidebarへの遷移ハンドラー連携
  - [x] 6.1 `PageNavigation` に `onNavigate` プロップを渡す
    - `(path) => navigateWithWarningCheck(() => navigate(path))` を渡す
    - _Requirements: 3.3_

  - [x] 6.2 `SellerStatusSidebar` に `onSellerNavigate` プロップを追加・連携する
    - `SellerStatusSidebarProps` に `onSellerNavigate?: (sellerId: string) => void` を追加する
    - `handleSellerClick` 内で `onSellerNavigate` が渡されていれば `navigate()` の代わりに呼ぶ
    - CallModePageから `(sellerId) => navigateWithWarningCheck(() => navigate(\`/sellers/\${sellerId}/call\`))` を渡す
    - _Requirements: 3.2_

- [x] 7. NavigationBlockDialogのレンダリングとhandleGoToNextCallDateの実装
  - [x] 7.1 `handleGoToNextCallDate` 関数を実装する
    - `setNavigationBlockDialog({ open: false })` でダイアログを閉じる
    - `nextCallDateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })` でスクロール
    - `nextCallDateRef.current?.focus()` でフォーカスを移動する
    - `nextCallDateRef.current` が null の場合はスキップする
    - _Requirements: 2.4, 5.2, 5.3_

  - [x] 7.2 CallModePageのJSXに `NavigationBlockDialog` を追加する
    - `open={navigationBlockDialog.open}` と `onGoToNextCallDate={handleGoToNextCallDate}` を渡す
    - _Requirements: 2.2, 2.3_

- [x] 8. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたサブタスクはオプションであり、MVPとして省略可能
- 各タスクは前のタスクの成果物を前提として積み上げる構成になっている
- プロパティテストは fast-check を使用し、最低100回のイテレーションで実行する
- `isFollowingUp` と `shouldBlockNavigation` は純粋関数として切り出すとテストが書きやすい
- Escキー対応は `handleBack` 経由で自動的にブロックされるため、`handleKeyDown` の変更は不要
