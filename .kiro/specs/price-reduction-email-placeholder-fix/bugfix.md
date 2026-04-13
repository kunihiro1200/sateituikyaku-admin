# Bugfix Requirements Document

## Introduction

物件リストの「値下げ配信メール」機能において、メール本文内のプレースホルダー（`{buyerName}`、`{priceChangeText}`、`{publicUrl}`、`{signature}` 等）が実際の値に置換されずにそのまま送信されるバグを修正する。

このバグにより、買主に送信されるメールが不完全な状態（プレースホルダー文字列がそのまま表示）となり、プロフェッショナルな印象を損ない、物件情報や署名が正しく伝わらない問題が発生している。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 「公開前、値下げメール」ボタンから値下げメールを送信する THEN システムはメール本文中の `{buyerName}` を買主名に置換せずそのまま送信する

1.2 WHEN 「公開前、値下げメール」ボタンから値下げメールを送信する THEN システムはメール本文中の `{priceChangeText}` を価格変更テキストに置換せずそのまま送信する

1.3 WHEN 「公開前、値下げメール」ボタンから値下げメールを送信する THEN システムはメール本文中の `{publicUrl}` を物件公開URLに置換せずそのまま送信する

1.4 WHEN 「公開前、値下げメール」ボタンから値下げメールを送信する THEN システムはメール本文中の `{signature}` を署名テキストに置換せずそのまま送信する

1.5 WHEN 「公開前、値下げメール」ボタンから値下げメールを送信する THEN システムはメール件名中の `{address}` を物件住所に置換せずそのまま送信する

### Expected Behavior (Correct)

2.1 WHEN 「公開前、値下げメール」ボタンから値下げメールを送信する THEN システムは `{buyerName}` を各買主の名前（未設定の場合は「お客様」）に置換した本文を送信 SHALL する

2.2 WHEN 「公開前、値下げメール」ボタンから値下げメールを送信する THEN システムは `{priceChangeText}` を物件の価格変更テキスト（例：「1850万円 → 1350万円（500万円値下げ）」）に置換した本文を送信 SHALL する

2.3 WHEN 「公開前、値下げメール」ボタンから値下げメールを送信する THEN システムは `{publicUrl}` を物件の公開URLに置換した本文を送信 SHALL する

2.4 WHEN 「公開前、値下げメール」ボタンから値下げメールを送信する THEN システムは `{signature}` を会社署名テキストに置換した本文を送信 SHALL する

2.5 WHEN 「公開前、値下げメール」ボタンから値下げメールを送信する THEN システムは `{address}` を物件住所に置換した件名を送信 SHALL する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 買主フィルタリング処理を実行する THEN システムは配信対象買主の絞り込みロジックを CONTINUE TO 正しく動作させる

3.2 WHEN 1人の買主にメールを送信する THEN システムはその買主の名前を `{buyerName}` に CONTINUE TO 正しく差し込む

3.3 WHEN 複数の買主にメールを一括送信する THEN システムは各買主に個別のメールを CONTINUE TO 送信する

3.4 WHEN メール送信が完了する THEN システムはアクティビティログへの記録を CONTINUE TO 正しく行う

3.5 WHEN Gmail Web UIへのフォールバック処理が実行される THEN システムは `GmailDistributionButton` 内の `replacePlaceholders()` による置換を CONTINUE TO 正しく動作させる
