# 要件定義書

## はじめに

買主詳細画面（`BuyerDetailPage.tsx`）および新規登録画面（`NewBuyerPage.tsx`）に2つのフィールドを追加する。

**機能1**: 【問合メール】電話対応（`inquiry_email_phone`）の値が「不通」の場合に、「3回架電確認済み」（`three_calls_confirmed`）フィールドを必須項目として表示する。

**機能2**: 「業者向けアンケート」（`vendor_survey`）フィールドをヒアリング項目セクションの上に追加する。

両フィールドともスプレッドシートとの相互同期が必要。

---

## 用語集

- **BuyerDetailPage**: 買主詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **NewBuyerPage**: 新規買主登録画面（`frontend/frontend/src/pages/NewBuyerPage.tsx`）
- **BuyerService**: 買主データのCRUD・スプレッドシート同期を担うバックエンドサービス（`backend/src/services/BuyerService.ts`）
- **BuyerWriteService**: DBの変更をスプレッドシートに書き戻すサービス（`backend/src/services/BuyerWriteService.ts`）
- **BuyerColumnMapper**: スプレッドシートカラム名とDBカラム名のマッピングを管理するサービス（`backend/src/services/BuyerColumnMapper.ts`）
- **buyer-column-mapping.json**: カラムマッピング定義ファイル（`backend/src/config/buyer-column-mapping.json`）
- **ボタン選択UI**: ラベルとボタン群を横並びに配置し、各ボタンに `flex: 1` を付与した均等幅のUI（`button-select-layout-rule.md` 参照）
- **phone_response（不通）**: `inquiry_email_phone` フィールドの値が「不通」である状態
- **three_calls_confirmed**: 「3回架電確認済み」フィールドのDBカラム名（既存）
- **vendor_survey**: 「業者向けアンケート」フィールドのDBカラム名（新規追加）

---

## 要件

### 要件1: 「3回架電確認済み」フィールドの条件付き必須表示

**ユーザーストーリー:** 受付担当者として、電話対応が「不通」の場合に「3回架電確認済み」フィールドを必須入力として確認したい。そうすることで、3回架電したことを確実に記録できる。

#### 受け入れ基準

1. WHEN `inquiry_email_phone` フィールドの値が「不通」である、THE BuyerDetailPage SHALL 「3回架電確認済み」フィールドをボタン選択UI（「確認済み」「未」の2択）で表示する
2. WHEN `inquiry_email_phone` フィールドの値が「不通」以外（または空）である、THE BuyerDetailPage SHALL 「3回架電確認済み」フィールドを非表示にする
3. WHEN 「3回架電確認済み」フィールドが表示されている、THE BuyerDetailPage SHALL フィールドラベルに必須マーク（赤色の「*」）を表示する
4. WHEN ユーザーが「確認済み」または「未」ボタンをクリックする、THE BuyerDetailPage SHALL 選択値をDBに即時保存する（`handleInlineFieldSave` 経由）
5. WHEN セクション保存ボタンが押下される、THE BuyerService SHALL `three_calls_confirmed` フィールドをスプレッドシートに同期する
6. WHEN スプレッドシートの「3回架電確認済み」カラムが更新される、THE BuyerSyncService SHALL DBの `three_calls_confirmed` フィールドを更新する（既存の `buyer-column-mapping.json` マッピングを利用）
7. THE BuyerDetailPage SHALL ボタン選択UIを `button-select-layout-rule.md` に定義されたレイアウトルール（ラベルとボタン群の横並び・均等幅）に従って実装する
8. WHEN `inquiry_email_phone` の値が「不通」から他の値に変更される、THE BuyerDetailPage SHALL 「3回架電確認済み」フィールドを非表示にする（値はDBに保持したまま）
9. WHEN NewBuyerPage で `inquiry_email_phone` の値が「不通」に設定される、THE NewBuyerPage SHALL 「3回架電確認済み」フィールドをボタン選択UI（「確認済み」「未」の2択）で表示する

### 要件2: 「業者向けアンケート」フィールドの追加

**ユーザーストーリー:** 受付担当者として、業者向けアンケートの確認状況を記録したい。そうすることで、業者への対応漏れを防止できる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 「業者向けアンケート」フィールドをボタン選択UI（「確認済み」「未」の2択）で表示する
2. THE BuyerDetailPage SHALL 「業者向けアンケート」フィールドをヒアリング項目セクション（`inquiry_hearing` フィールド）の直上に配置する
3. WHEN ユーザーが「確認済み」または「未」ボタンをクリックする、THE BuyerDetailPage SHALL 選択値をDBに即時保存する（`handleInlineFieldSave` 経由）
4. WHEN セクション保存ボタンが押下される、THE BuyerService SHALL `vendor_survey` フィールドをスプレッドシートの「業者向けアンケート」カラムに同期する
5. WHEN スプレッドシートの「業者向けアンケート」カラムが更新される、THE BuyerSyncService SHALL DBの `vendor_survey` フィールドを更新する
6. THE BuyerDetailPage SHALL ボタン選択UIを `button-select-layout-rule.md` に定義されたレイアウトルール（ラベルとボタン群の横並び・均等幅）に従って実装する
7. THE NewBuyerPage SHALL 「業者向けアンケート」フィールドをボタン選択UI（「確認済み」「未」の2択）で表示する
8. THE BuyerColumnMapper SHALL スプレッドシートカラム名「業者向けアンケート」とDBカラム名 `vendor_survey` のマッピングを `buyer-column-mapping.json` に追加する

### 要件3: データベーススキーマの整合性

**ユーザーストーリー:** システム管理者として、新規フィールドがDBに正しく保存・取得されることを確認したい。

#### 受け入れ基準

1. THE BuyerService SHALL `vendor_survey` フィールドを `buyers` テーブルから取得し、APIレスポンスに含める
2. THE BuyerService SHALL `vendor_survey` フィールドの更新を `buyers` テーブルに保存する
3. IF `vendor_survey` カラムが `buyers` テーブルに存在しない、THEN THE システム管理者 SHALL マイグレーションスクリプトを実行してカラムを追加する
4. THE BuyerService SHALL `three_calls_confirmed` フィールドを `buyers` テーブルから取得し、APIレスポンスに含める（既存カラムの確認）
