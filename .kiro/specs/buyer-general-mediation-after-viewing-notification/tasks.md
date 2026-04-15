# 実装計画：一般媒介内覧後注意書き表示

## 概要

`BuyerViewingResultPage.tsx` の「内覧後売主連絡」フィールド直下に、一般媒介契約における売主への内覧結果報告義務を周知する注意書きを追加する。変更対象はフロントエンドの1ファイルのみ。

## タスク

- [x] 1. BuyerViewingResultPage.tsx に注意書きを追加する
  - Pythonスクリプトを使用してUTF-8エンコーディングを保護しながら編集する
  - 「内覧後売主連絡」フィールドを囲む `Box` 内のボタン群直後に `Typography` を追加する
  - `variant="caption"`, `color="error"`, `sx={{ display: 'block', mt: 0.5 }}` を設定する
  - テキスト: `*一般媒介は内覧後に、全ての売り主に結果報告をしてください`
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 1.1 プロパティテスト：注意書きの常時表示（Property 1）
    - **Property 1: 注意書きの常時表示**
    - `post_viewing_seller_contact` の任意の値（済・未・不要・空欄・null）に対して注意書きが表示されることを確認
    - **Validates: Requirements 2.1, 2.4**

- [x] 2. チェックポイント - 実装確認
  - エンコーディングが正しいか（BOMなしUTF-8）確認する
  - `getDiagnostics` でTypeScriptエラーがないか確認する
  - 注意書きが正しい位置に配置されているか確認する

- [x] 3. フロントエンドをVercelにデプロイする
  - `frontend/frontend/` ディレクトリで `vercel --prod` を実行する
  - デプロイ完了後、本番環境で注意書きが表示されることを確認する
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

## 注意事項

- タスク `*` マーク付きはオプションのため、実装時はスキップ可能
- 日本語テキストを含むため、ファイル編集は必ずPythonスクリプトを使用（UTF-8保護）
- `strReplace` ツールによる直接編集は禁止
- `BuyerStatusCalculator.ts` と `BuyerStatusSidebar.tsx` は変更しない
