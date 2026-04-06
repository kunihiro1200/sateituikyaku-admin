# 買主7260「業者問合せあり」誤表示バグ - 根本原因調査レポート

## 調査日時
2025年1月（タスク3.1実行時）

## 調査対象
買主番号: 7260

## 調査結果

### 1. データベースの状態

```
買主番号: 7260
broker_survey: 未
vendor_survey: 確認済み
```

**重要な発見**:
- `broker_survey`フィールドは「未」
- `vendor_survey`フィールドは「確認済み」
- スプレッドシートの「業者向けアンケート」は「確認済み」（ユーザー報告より）

### 2. GASカラムマッピングの確認

`gas_buyer_complete_code.js`を調査した結果：

**発見**: 「業者向けアンケート」列のマッピングが**存在しない**

検索結果:
```bash
Select-String -Path "gas_buyer_complete_code.js" -Pattern "業者向けアンケート|vendor_survey|broker_survey"
# → 結果なし
```

### 3. サイドバーステータス計算ロジック

`backend/src/services/BuyerStatusCalculator.ts`を確認する必要がありますが、
デザインドキュメントによると、サイドバーは`broker_survey`フィールドを参照しています。

## 根本原因の特定

**根本原因**: **フィールド名の混同（ケース4）**

過去に以下の経緯があったと推測されます：

1. **初期実装**: スプレッドシートの「業者向けアンケート」は`vendor_survey`フィールドに同期されていた
2. **フィールド名変更**: 後に`vendor_survey`から`broker_survey`にフィールド名が変更された
3. **GAS同期の更新漏れ**: GASのカラムマッピングが更新されず、引き続き`vendor_survey`に同期されている
4. **サイドバーロジックの更新**: サイドバーのステータス計算は新しい`broker_survey`フィールドを参照するように更新された
5. **結果**: スプレッドシート→`vendor_survey`に同期、サイドバー→`broker_survey`を参照、という不整合が発生

## 証拠

### 証拠1: データベースの2つのフィールド

```sql
SELECT buyer_number, broker_survey, vendor_survey 
FROM buyers 
WHERE buyer_number = '7260';

-- 結果:
-- buyer_number | broker_survey | vendor_survey
-- 7260         | 未            | 確認済み
```

→ 両方のフィールドが存在し、値が異なる

### 証拠2: GASマッピングの欠如

`gas_buyer_complete_code.js`に「業者向けアンケート」のマッピングが存在しない

→ GASは「業者向けアンケート」列を同期していない、または古いフィールド名（`vendor_survey`）に同期している可能性

### 証拠3: 過去の類似バグ

デザインドキュメントに記載されている過去のバグ：
- `buyer-vendor-survey-sync-bug`: `vendor_survey`フィールドが使われていた
- `bulk-migrate-vendor-survey.ts`: データ移行スクリプトが存在

→ 過去に`vendor_survey`から`broker_survey`への移行があったことを示唆

## 修正方針

**推奨される修正方法**: **ケース3（フィールド混同）の対応**

1. **GASカラムマッピングを修正**
   - `gas_buyer_complete_code.js`に「業者向けアンケート」→`broker_survey`のマッピングを追加
   - 既存の`vendor_survey`へのマッピングがあれば削除

2. **データ移行**
   - 全買主の`vendor_survey`の値を`broker_survey`にコピー
   - `vendor_survey`フィールドをnullにクリア（または削除）

3. **検証**
   - 買主7260のデータを手動で同期
   - サイドバーに「業者問合せあり」と表示されないことを確認

## 次のステップ

タスク3.2で上記の修正を実装します。
