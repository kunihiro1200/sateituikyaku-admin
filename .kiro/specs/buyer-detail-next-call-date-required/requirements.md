# 要件定義書

## はじめに

買主リスト詳細画面（`BuyerDetailPage`）において、最新状況フィールドのバリデーション機能を追加する。

最新状況に「A」または「B」が含まれるステータスが選択されている場合（ただし「AZ」「BZ」は除外）、次電日（`next_call_date`）の設定を必須とする。保存ボタン押下時に次電日が未設定であれば、警告POPUPを表示して保存を中断する。

## 用語集

- **BuyerDetailPage**: 買主リスト詳細画面のコンポーネント（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **NextCallDateRequiredDialog**: 次電日未設定時に表示する警告ダイアログコンポーネント
- **latest_status**: ★最新状況フィールド（DBカラム名）。買主の現在の状況を示すステータス値
- **next_call_date**: ★次電日フィールド（DBカラム名）。次回電話予定日
- **AZ対象外ステータス**: `AZ:Aだが次電日不要` — 次電日必須チェックの対象外
- **BZ対象外ステータス**: `BZ：Bだが次電日不要` — 次電日必須チェックの対象外
- **A系ステータス**: `latest_status` の値に「A」が含まれ、かつ「AZ」で始まらないステータス（例: `A:この物件を気に入っている（こちらからの一押しが必要）`、`A1`、`AB` 等）
- **B系ステータス**: `latest_status` の値に「B」が含まれ、かつ「BZ」で始まらないステータス（例: `B:1年以内に引っ越し希望だが、この物件ではない。駐車場の要件や、日当たり等が合わない。`、`B2`、`AB` 等）
- **次電日必須対象**: A系ステータスまたはB系ステータスに該当する場合
- **handleSave**: 保存処理を実行する関数
- **editedData**: 編集中のフィールド変更を保持するオブジェクト

## 要件

### 要件1：次電日必須バリデーションチェック

**ユーザーストーリー：** 担当者として、最新状況が「A」または「B」系のステータスの場合に次電日が未設定のまま保存しようとした際、警告を受け取りたい。そうすることで、フォローアップ予定日の設定漏れを防ぐことができる。

#### 受け入れ基準

1. WHEN 保存ボタンが押された時、THE BuyerDetailPage SHALL `latest_status` の最終値（保存済みデータと編集中データを合わせた値）を評価する。

2. WHEN 保存ボタンが押された時、かつ `latest_status` の値に「A」または「B」が含まれ、かつ `latest_status` が「AZ」で始まらず「BZ」で始まらない場合、かつ `next_call_date` が NULL または空文字（未設定）である場合、THE BuyerDetailPage SHALL 保存処理を中断し、NextCallDateRequiredDialog を表示する。

3. WHEN `latest_status` が「AZ」で始まる値（例: `AZ:Aだが次電日不要`）の場合、THE BuyerDetailPage SHALL 次電日必須チェックをスキップする（次電日不要と明示されているため）。

4. WHEN `latest_status` が「BZ」で始まる値（例: `BZ：Bだが次電日不要`）の場合、THE BuyerDetailPage SHALL 次電日必須チェックをスキップする（次電日不要と明示されているため）。

5. WHEN `latest_status` に「A」も「B」も含まれない場合、THE BuyerDetailPage SHALL 次電日必須チェックをスキップする。

6. WHEN `next_call_date` に値が設定されている場合、THE BuyerDetailPage SHALL 次電日必須チェックをスキップし、通常の保存処理を実行する。

---

### 要件2：NextCallDateRequiredDialog の表示内容

**ユーザーストーリー：** 担当者として、次電日が未設定の場合に表示される警告ダイアログで、何をすべきかを明確に理解したい。そうすることで、適切な対応（次電日を設定するか、AZ/BZに変更するか）を判断できる。

#### 受け入れ基準

1. THE NextCallDateRequiredDialog SHALL 警告メッセージとして「最新状況がAやBの場合は次電日の設定は必須です。次電日の設定不要の場合はAZもしくはBZを選択してください。」を表示する。

2. THE NextCallDateRequiredDialog SHALL 「閉じる」ボタンを表示する。

3. WHEN 「閉じる」ボタンが押された時、THE BuyerDetailPage SHALL NextCallDateRequiredDialog を閉じ、保存処理を実行しない（ユーザーが修正できる状態に戻る）。

4. THE NextCallDateRequiredDialog SHALL 警告アイコン（⚠️ または MUI の `WarningAmber` アイコン）をダイアログタイトル部分に表示する。

5. THE NextCallDateRequiredDialog SHALL タイトル背景色またはアイコン色をオレンジ系（`warning` カラー）で表示する。

---

### 要件3：バリデーション対象ステータスの判定ロジック

**ユーザーストーリー：** システムとして、「A」または「B」を含むステータスを正確に判定し、「AZ」「BZ」を確実に除外したい。そうすることで、誤ったバリデーションが発生しない。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL `latest_status` の値に文字「A」が含まれるかどうかを部分一致で判定する。

2. THE BuyerDetailPage SHALL `latest_status` の値に文字「B」が含まれるかどうかを部分一致で判定する。

3. WHEN `latest_status` が「AZ」で始まる場合、THE BuyerDetailPage SHALL 「A」を含む判定の結果に関わらず、次電日必須チェックの対象外とする。

4. WHEN `latest_status` が「BZ」で始まる場合、THE BuyerDetailPage SHALL 「B」を含む判定の結果に関わらず、次電日必須チェックの対象外とする。

5. THE BuyerDetailPage SHALL 以下のステータス例を次電日必須対象として判定する：
   - `A:この物件を気に入っている（こちらからの一押しが必要）`（「A」を含む）
   - `B:1年以内に引っ越し希望だが、この物件ではない。駐車場の要件や、日当たり等が合わない。`（「B」を含む）
   - 「A1」「B2」「AB」等、「A」または「B」を含む任意のステータス

6. THE BuyerDetailPage SHALL 以下のステータス例を次電日必須対象外として判定する：
   - `AZ:Aだが次電日不要`（「AZ」で始まる）
   - `BZ：Bだが次電日不要`（「BZ」で始まる）
   - 「A」も「B」も含まないステータス
   - `latest_status` が NULL または空文字の場合
