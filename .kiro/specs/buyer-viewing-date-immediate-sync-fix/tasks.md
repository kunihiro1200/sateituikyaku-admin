# Tasks

## 1. 根本原因の特定

- [x] 1.1 `buyer-column-mapping.json`を確認し、`viewing_date`と`viewing_time`のマッピングが存在するか確認
- [x] 1.2 フロントエンドのAPI呼び出しを確認し、`viewing_date`と`viewing_time`フィールドが送信されているか確認
- [x] 1.3 `BuyerColumnMapper.ts`の実装を確認し、日付・時間フォーマット変換が正しく行われているか確認
- [x] 1.4 スプレッドシートのI列とBP列のヘッダー名を確認

## 2. マッピング設定の修正

- [x] 2.1 `buyer-column-mapping.json`の`spreadsheetToDatabase`セクションに`viewing_date`と`viewing_time`のマッピングを追加
- [x] 2.2 `buyer-column-mapping.json`の`databaseToSpreadsheet`セクションに`viewing_date`と`viewing_time`のマッピングを追加
- [x] 2.3 `buyer-column-mapping.json`の`typeConversions`セクションに`viewing_date`と`viewing_time`の型を定義

## 3. フォーマット変換の実装

- [x] 3.1 `BuyerColumnMapper.ts`の`mapDatabaseToSpreadsheet()`メソッドに、`viewing_date`フィールドを「YYYY/MM/DD」形式に変換する処理を追加
- [x] 3.2 `BuyerColumnMapper.ts`の`mapDatabaseToSpreadsheet()`メソッドに、`viewing_time`フィールドを「HH:MM」形式に変換する処理を追加

## 4. デバッグログの追加

- [x] 4.1 `BuyerWriteService.ts`の`updateFields()`メソッドに、`viewing_date`と`viewing_time`フィールドの同期状況を記録するデバッグログを追加

## 5. フロントエンドの確認と修正

- [x] 5.1 フロントエンドのコードを確認し、買主の内覧日・時間を保存する際に使用しているAPIエンドポイントを特定
- [x] 5.2 APIリクエストボディに`viewing_date`と`viewing_time`フィールドが含まれているか確認
- [x] 5.3 必要に応じて、フロントエンドのコードを修正し、`viewing_date`と`viewing_time`フィールドを送信するようにする

## 6. テスト

- [x] 6.1 買主5641の内覧日・時間をブラウザUIで保存し、DBとスプレッドシートの両方に即座に同期されることを確認
- [x] 6.2 GASの定期同期を手動実行し、内覧日・時間が維持されることを確認
- [x] 6.3 他の買主フィールド（名前、電話番号など）の保存・同期動作が変更されていないことを確認
- [x] 6.4 スプレッドシートで直接内覧日・時間を編集し、GASの定期同期でDBに反映されることを確認

## 7. デプロイ

- [-] 7.1 修正をコミット
- [ ] 7.2 Vercelにデプロイ
- [ ] 7.3 本番環境で動作確認
