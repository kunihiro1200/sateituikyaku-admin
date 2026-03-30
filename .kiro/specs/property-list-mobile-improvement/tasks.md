# 実装計画: property-list-mobile-improvement

## 概要

物件リストページ（PropertyListingsPage.tsx）のスマホ版ステータスフィルターをAccordion形式に変更し、報告ページ（PropertyReportPage.tsx）にスマホ用レイアウトを追加する。

## タスク

- [x] 1. PropertyListingsPage.tsx のスマホ版ステータスフィルターを Accordion 形式に変更
  - [x] 1.1 MUI インポートに Accordion, AccordionSummary, AccordionDetails を追加し、ExpandMore を ExpandMoreIcon としてインポートする
    - `@mui/material` から `Accordion`, `AccordionSummary`, `AccordionDetails` を追加
    - `@mui/icons-material` から `ExpandMore as ExpandMoreIcon` を追加
    - _要件: 1.1_

  - [x] 1.2 `mobileStatusOpen` state を削除し、`mobileAccordionExpanded` state を追加する
    - `const [mobileStatusOpen, setMobileStatusOpen] = useState(false);` を削除
    - `const [mobileAccordionExpanded, setMobileAccordionExpanded] = useState(false);` を追加
    - _要件: 1.6_

  - [x] 1.3 ヘッダー内の「ステータス ▼」ボタンを削除する
    - `isMobile && (...)` で囲まれた `Button` コンポーネント（ステータス ▼）を削除
    - _要件: 1.6_

  - [x] 1.4 スマホ版のステータスフィルター表示を Accordion 形式に変更する
    - 既存の `isMobile ? (mobileStatusOpen && ...)` による条件分岐を削除
    - BuyersPage.tsx の実装パターンを参考に、`isMobile && (<Accordion ...>)` 形式に変更
    - `AccordionSummary` に「ステータスフィルター」ラベルと `ExpandMoreIcon` を表示
    - `AccordionDetails` 内に `PropertySidebarStatus` を配置
    - _要件: 1.1, 1.2, 1.3_

  - [x] 1.5 ステータス選択時に `setMobileAccordionExpanded(false)` でアコーディオンを自動クローズする
    - `PropertySidebarStatus` の `onStatusChange` コールバック内に `setMobileAccordionExpanded(false)` を追加
    - _要件: 1.4_

  - [x] 1.6 選択中ステータスがある場合に AccordionSummary へ視覚的表示を追加する
    - `sidebarStatus` が非 null かつ `'all'` 以外の場合、`AccordionSummary` の `sx` に背景色を設定
    - 選択中ステータス名を `AccordionSummary` 内に表示（caption テキスト）
    - _要件: 1.7_

  - [ ]* 1.7 プロパティテスト: ステータス選択後のアコーディオン自動クローズ
    - **プロパティ1: ステータス選択後のアコーディオン自動クローズ**
    - **検証: 要件 1.4**
    - 任意のステータス文字列に対して、ステータス選択後に `mobileAccordionExpanded` が `false` になることを fast-check で検証

- [x] 2. PropertyListingsPage.tsx のスマホ版「未報告」遷移の動作確認
  - [x] 2.1 `handleRowClick` が `sidebarStatus.startsWith('未報告')` で報告ページへ遷移するロジックを確認する
    - 既存の `handleRowClick` 実装を確認（変更不要の場合は確認のみ）
    - スマホのカードクリックが `handleRowClick` を呼び出していることを確認
    - _要件: 2.1, 2.2, 2.3_

  - [ ]* 2.2 プロパティテスト: handleRowClick のナビゲーション先
    - **プロパティ2: handleRowClick のナビゲーション先**
    - **検証: 要件 2.2, 2.4**
    - 任意の `sidebarStatus` と物件番号に対して、`'未報告'` で始まる場合は `/report` パスへ、それ以外は通常パスへ遷移することを fast-check で検証

- [ ] 3. チェックポイント - タスク1・2の完了確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 4. PropertyReportPage.tsx にスマホ用レイアウトを追加
  - [x] 4.1 `useTheme` と `useMediaQuery` を MUI からインポートし、`isMobile` を取得する
    - `import { ..., useTheme, useMediaQuery } from '@mui/material';` に追加
    - コンポーネント内に `const theme = useTheme(); const isMobile = useMediaQuery(theme.breakpoints.down('sm'));` を追加
    - _要件: 3.1, 3.9_

  - [x] 4.2 ヘッダーの `flexDirection` を `isMobile ? 'column' : 'row'` に変更する
    - ヘッダー `Box` の `sx` に `flexDirection: isMobile ? 'column' : 'row'` と `alignItems: isMobile ? 'flex-start' : 'center'` を追加
    - _要件: 3.2, 3.8_

  - [x] 4.3 2カラムレイアウトの `flexDirection` を `isMobile ? 'column' : 'row'` に変更する
    - 左右2カラムの親 `Box` の `sx` に `flexDirection: isMobile ? 'column' : 'row'` を追加
    - _要件: 3.3, 3.5, 3.7_

  - [x] 4.4 左カラムを `isMobile` 時は `width: '100%'` に変更する
    - 左カラム `Box` の `sx` を `isMobile ? { width: '100%' } : { flex: '0 0 380px', minWidth: 0 }` に変更
    - _要件: 3.4_

  - [x] 4.5 送信履歴テーブルを `isMobile` 時は `overflowX: 'auto'` で横スクロール可能に変更する
    - `TableContainer` の `sx` に `overflowX: 'auto'` を追加し、`maxHeight` を `isMobile ? 'none' : 220` に変更
    - _要件: 3.6_

- [ ] 5. 最終チェックポイント - 全テスト通過確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 備考

- `*` が付いたサブタスクはオプションであり、スキップ可能
- 各タスクは要件との対応を明示しており、トレーサビリティを確保
- チェックポイントでインクリメンタルな検証を行う
- プロパティテストは fast-check を使用し、最低100回のランダム入力で検証する
