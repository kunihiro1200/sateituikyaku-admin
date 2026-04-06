# 実装計画：買主Pinrich条件付き必須バリデーション

## 概要

買主詳細ページ（BuyerDetailPage.tsx）において、「Pinrich」フィールドを条件付き必須項目として実装します。メールアドレスが空白でなく、かつ「業者問合せ」フィールドが空白の場合に、「Pinrich」フィールドの入力を必須とします。

## タスク

- [x] 1. isPinrichRequired 関数の実装
  - BuyerDetailPage.tsx に `isPinrichRequired` 関数を追加
  - メールアドレスと業者問合せの条件判定ロジックを実装（`AND(ISNOTBLANK([メールアドレス]), ISBLANK([業者問合せ]))`）
  - null/undefined チェックと文字列変換エラーハンドリングを追加
  - _要件: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. checkMissingFields 関数の修正
  - [x] 2.1 Pinrich の条件付き必須チェックを追加
    - `checkMissingFields` 関数内に `isPinrichRequired(buyer)` を使用した条件付きチェックを追加
    - Pinrich が「未選択」の場合も未入力として扱う処理を実装
    - 既存の必須チェックロジックとの重複を防止
    - _要件: 1.1, 1.4, 7.1, 7.2, 7.3, 7.4_
  
  - [x] 2.2 REQUIRED_FIELD_LABEL_MAP に Pinrich を追加
    - `REQUIRED_FIELD_LABEL_MAP` に `pinrich: 'Pinrich'` を追加
    - ValidationWarningDialog に正しい表示名が渡されることを確認
    - _要件: 3.2_

- [x] 3. 動的バリデーションの実装
  - useEffect を追加して `buyer.email`、`buyer.broker_inquiry`、`buyer.pinrich` の変更を監視
  - 変更時に `checkMissingFields()` を自動実行する処理を実装
  - 必須条件を満たす場合に `missingRequiredFields` を更新
  - _要件: 3.1, 3.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_

- [x] 4. 初期表示時のバリデーション
  - `fetchBuyer()` 関数内に初期チェックロジックを追加
  - `isPinrichRequired(res.data)` で必須状態を判定
  - 必須条件を満たし、かつ Pinrich が空または「未選択」の場合に `initialMissing` に追加
  - `missingRequiredFields` を初期化
  - _要件: 8.1, 8.2, 8.3_

- [-] 5. Checkpoint - 動作確認とテスト
  - ブラウザで買主詳細ページを開き、以下のシナリオをテスト：
    - 初期表示時のハイライト表示
    - メールアドレス変更時の動的バリデーション
    - 業者問合せ選択時のハイライト解除
    - Pinrich入力時のハイライト解除
    - 保存時のバリデーション
  - エッジケース（空白文字のみ、「未選択」）をテスト
  - 既存の必須フィールドバリデーションが正常に動作することを確認
  - Ensure all tests pass, ask the user if questions arise.

## 注意事項

- タスク実行時は日本語を含むファイルを編集するため、Pythonスクリプトを使用してUTF-8エンコーディングで書き込みを行う
- `strReplace` ツールを使用した日本語ファイルの直接編集は避ける
- 既存の必須バリデーションロジックを壊さないこと
- Pinrich が「未選択」の場合は未入力として扱うこと
