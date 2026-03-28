# 買主Gmail・SMS内覧前伝達事項バグ修正 タスクリスト

## Phase 1: 探索的バグ確認（未修正コードでのテスト）

- [x] 1.1 `mergeAngleBracketPlaceholders()` のバグ再現テストを作成する
  - `pre_viewing_notes = "駐車場は右側"` で呼び出し、結果に値が含まれないことを確認
  - 未修正コードで実行して失敗を記録する

- [x] 1.2 `SmsDropdownButton` のバグ再現テストを作成する
  - `preViewingNotes = "担当者同行必須"` でメッセージ生成し、値が含まれないことを確認
  - 未修正コードで実行して失敗を記録する

## Phase 2: Gmail修正（バックエンド）

- [x] 2.1 `SmsDropdownButton` の呼び出し元ファイルを特定する
  - `grepSearch` で `SmsDropdownButton` のインポート箇所を検索する

- [x] 2.2 `EmailTemplateService.mergeAngleBracketPlaceholders()` を修正する
  - `buyer` パラメータの型定義に `pre_viewing_notes?: string` を追加する
  - 末尾の `result = result.replace(/<<内覧前伝達事項v>>/g, '');` を削除する
  - `result = result.replace(/<<内覧前伝達事項v>>/g, buyer.pre_viewing_notes || '');` を追加する

- [-] 2.3 Gmail修正のユニットテストを作成・実行する
  - `pre_viewing_notes` あり/なしの両ケースをテスト
  - 他プレースホルダー（`<<氏名>>`、`<<住居表示>>`、`<<SUUMO　URLの表示>>`）が正常動作することをテスト

## Phase 3: SMS修正（フロントエンド）

- [x] 3.1 `SmsDropdownButtonProps` インターフェースに `preViewingNotes?: string` を追加する

- [x] 3.2 コンポーネントの分割代入に `preViewingNotes` を追加する

- [x] 3.3 各SMSテンプレートに内覧前伝達事項の差し込みロジックを追加する
  - `preViewingNotes` が空でない場合のみセクションを追加する
  - 差し込み位置: 各テンプレートの本文末尾（会社署名の直前）
  - 対象テンプレート: `land_no_permission`、`minpaku`、`land_need_permission`、`offer_no_viewing`、`offer_ok_viewing`、`no_response`、`no_response_offer`、`pinrich`、`house_mansion`

- [x] 3.4 `SmsDropdownButton` の呼び出し元で `preViewingNotes` プロップを渡すよう修正する

- [~] 3.5 SMS修正のユニットテストを作成・実行する
  - `preViewingNotes` あり/なしの両ケースを全テンプレートでテスト
  - 空の場合にメッセージが変わらないことをテスト

## Phase 4: 保全確認テスト

- [~] 4.1 Gmail保全テストを実行する
  - 他プレースホルダーが修正前後で同じ結果になることを確認
  - `<<SUUMO　URLの表示>>` が空文字に置換されることを確認

- [~] 4.2 SMS保全テストを実行する
  - `preViewingNotes` が空の場合、全テンプレートのメッセージが修正前後で同一であることを確認
  - SMS履歴記録ロジックが変更されていないことを確認

## Phase 5: 統合確認

- [x] 5.1 型チェック・リントを実行する（`getDiagnostics`）
  - `backend/src/services/EmailTemplateService.ts`
  - `frontend/frontend/src/components/SmsDropdownButton.tsx`
  - 呼び出し元ファイル

- [x] 5.2 修正内容の最終レビュー
  - 変更が最小限であることを確認
  - 既存動作への影響がないことを確認
