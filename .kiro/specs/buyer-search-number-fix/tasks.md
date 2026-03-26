# Implementation Plan

- [x] 1. 検索バーのナビゲーションバグを修正する
  - `frontend/frontend/src/pages/BuyerDetailPage.tsx` の検索バー `onKeyDown` ハンドラーを修正する
  - `handleNavigate` を `navigate` に変更してバリデーションチェックをバイパスする
  - 半角・全角どちらの入力でも `toHalfWidth` 変換後に直接遷移する
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. デプロイする
  - `git add .` でファイルをステージング
  - `git commit -m "fix: buyer search bar navigation bypass validation check"` でコミット
  - `git push origin main` でデプロイ
