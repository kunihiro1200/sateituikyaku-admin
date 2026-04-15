# 実装計画：seller-exclusion-date-auto-next-contact

## 概要

`frontend/frontend/src/pages/CallModePage.tsx` のみを変更し、サイト＝H の売主に対して以下の2つの自動処理を追加する。

1. 「除外日にすること」選択時に反響日+5日を次電日に自動設定する
2. コメントエリアの除外申請マーク隣に「（なりすまし）として除外してください」Chip を表示する

## タスク

- [x] 1. `calcInquiryDatePlusDays` ヘルパー関数の実装
  - `CallModePage.tsx` のコンポーネント外（ファイル上部）に純粋関数として定義する
  - `inquiryDate`（string | Date）と `days`（number）を受け取り、YYYY-MM-DD 形式の文字列を返す
  - 無効な日付の場合は `null` を返す
  - `setDate(getDate() + days)` を使用してDST安全な日付計算を行う
  - _Requirements: 1.5_

  - [ ]* 1.1 `calcInquiryDatePlusDays` のユニットテストを作成する
    - 月中の通常日付で+5日が正しく計算されること
    - 月末（例: 1月28日 → 2月2日）で月をまたぐこと
    - 年末（12月28日 → 1月2日）で年をまたぐこと
    - うるう年（2月24日 → 2月29日）が正しく計算されること
    - 空文字・無効な日付で `null` を返すこと
    - _Requirements: 1.5_

  - [ ]* 1.2 Property 1 のプロパティベーステストを作成する（fast-check 使用）
    - **Property 1: サイト=Hの場合、次電日は反響日+5日になる**
    - **Validates: Requirements 1.1, 1.5**

- [x] 2. 除外日にすることボタンのクリックハンドラーを修正する
  - `CallModePage.tsx` 内の除外日にすることボタンの `onClick` ハンドラーを変更する
  - `value` が存在する場合に `seller?.site === 'H'` かつ `seller?.inquiryDate` が存在するか判定する
  - 条件を満たす場合は `calcInquiryDatePlusDays(seller.inquiryDate, 5)` の結果を `setEditedNextCallDate` に渡す
  - H以外の場合は既存動作（`exclusionDate` を `setEditedNextCallDate` に渡す）を維持する
  - `value` が空文字（ボタン選択解除）の場合は次電日の自動設定を行わない
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. チェックポイント - 次電日自動設定の動作確認
  - すべてのテストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 4. コメントエリアの「（なりすまし）として除外してください」Chip を追加する
  - `CallModePage.tsx` 内の `exclusionAction` 表示部分を変更する
  - 既存の `<Typography>` を `<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>` で囲む
  - `seller?.site === 'H'` の場合に `<Chip label="（なりすまし）として除外してください" color="warning" size="small" sx={{ fontWeight: 'bold' }} />` を追加する
  - `exclusionAction` が空の場合は追加ラベルを表示しない（既存の条件分岐を維持）
  - `Chip` コンポーネントが未インポートの場合は MUI からインポートを追加する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 4.1 Property 2 のプロパティベーステストを作成する（fast-check 使用）
    - **Property 2: サイト=HかつexclusionActionが存在する場合、なりすましラベルが表示される**
    - **Validates: Requirements 2.1**

- [x] 5. 最終チェックポイント - すべてのテストが通ることを確認する
  - すべてのテストが通ることを確認し、疑問点があればユーザーに確認する。

## 備考

- `*` が付いたサブタスクはオプションであり、MVP優先の場合はスキップ可能
- 変更対象ファイルは `frontend/frontend/src/pages/CallModePage.tsx` のみ（バックエンド変更なし）
- 各タスクは対応する要件番号を参照しているため、トレーサビリティを確保している
