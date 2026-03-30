# バグ修正要件ドキュメント

## Introduction

買主リスト7260の「業者向けアンケート」フィールドがスプレッドシートからデータベースに正しく同期されているが、ブラウザ（買主詳細ページ・新規買主ページ）で表示されない問題を修正する。

根本原因は、フロントエンドとバックエンドでフィールド名が不一致であることです：
- データベース・GAS: `vendor_survey` ✅
- フロントエンド: `broker_survey` ❌

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主詳細ページ（BuyerDetailPage.tsx）を表示する THEN システムは `buyer?.broker_survey` を参照するが、APIレスポンスには `vendor_survey` しか含まれないため、値が表示されない

1.2 WHEN 新規買主ページ（NewBuyerPage.tsx）で「業者向けアンケート」を保存する THEN システムは `broker_survey` フィールド名でデータを送信するが、バックエンドは `vendor_survey` を期待しているため、データが正しく保存されない可能性がある

1.3 WHEN 買主詳細ページで「業者向けアンケート」フィールドを条件付き表示する THEN システムは `buyer?.broker_survey` の値をチェックするが、実際のデータは `vendor_survey` に保存されているため、値があっても非表示になる

### Expected Behavior (Correct)

2.1 WHEN 買主詳細ページ（BuyerDetailPage.tsx）を表示する THEN システムは `buyer?.vendor_survey` を参照し、データベースから取得した値（「確認済み」など）を正しく表示する

2.2 WHEN 新規買主ページ（NewBuyerPage.tsx）で「業者向けアンケート」を保存する THEN システムは `vendor_survey` フィールド名でデータを送信し、バックエンドが正しく保存する

2.3 WHEN 買主詳細ページで「業者向けアンケート」フィールドを条件付き表示する THEN システムは `buyer?.vendor_survey` の値をチェックし、値がある場合のみ表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 他のフィールド（問合時ヒアリング、初動担当など）を表示・編集する THEN システムは引き続き正しく動作する

3.2 WHEN 「業者向けアンケート」以外のボタン選択フィールド（Pinrich、3コール確認など）を操作する THEN システムは引き続き正しく動作する

3.3 WHEN データベースの `vendor_survey` カラムに保存されているデータを読み取る THEN システムは引き続き正しくデータを取得する
