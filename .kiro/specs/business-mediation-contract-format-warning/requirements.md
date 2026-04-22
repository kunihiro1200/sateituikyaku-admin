# 要件定義書

## はじめに

業務詳細画面（`WorkTaskDetailModal`）の「媒介契約」タブにおいて、古い形式のスプレッドシートが使用されている可能性を検知し、ユーザーに警告ポップアップを表示する機能を追加する。

具体的には、以下の2条件が同時に満たされた状態で「保存」ボタンが押された場合に警告を表示する：

1. 「物件所在」（`property_address`）が `"不要"` である
2. 「媒介作成者」（`mediation_creator`）に値が入っている

警告ポップアップには「OK」ボタンのみを表示し、ユーザーが内容を確認した後に保存処理を継続できるようにする。

## 用語集

- **WorkTaskDetailModal**: 業務詳細画面のモーダルコンポーネント（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）
- **MediationSection**: 「媒介契約」タブのコンテンツを描画するコンポーネント（`WorkTaskDetailModal` 内に定義）
- **MediationFormatWarningDialog**: 媒介契約フォーマット警告を表示するダイアログコンポーネント
- **property_address**: 「物件所在」フィールド（テキスト）
- **mediation_creator**: 「媒介作成者」フィールド（担当者イニシャル）
- **handleSave**: 保存処理を実行する関数
- **executeSave**: 実際のAPI保存処理を実行する関数
- **editedData**: 編集中のフィールド変更を保持するオブジェクト
- **getValue**: `editedData` を優先し、なければ `data` から値を取得するヘルパー関数

## 要件

### 要件1：媒介契約フォーマット警告の表示

**ユーザーストーリー：** 担当者として、「物件所在」が "不要" かつ「媒介作成者」に値が入っている状態で保存しようとした場合、古い形式のスプレッドシートを使用している可能性を示す警告を受け取りたい。そうすることで、正しい形式に更新するよう促される。

#### 受け入れ基準

1. WHEN 保存ボタンが押された時、THE WorkTaskDetailModal SHALL `property_address` および `mediation_creator` の最終値（`editedData` 優先、なければ `data` の値）を評価する。

2. WHEN 保存ボタンが押された時、かつ `property_address` の最終値が `"不要"` であり、かつ `mediation_creator` の最終値が空欄でない（`''`・`null`・`undefined` のいずれでもない）場合、THE WorkTaskDetailModal SHALL 保存処理を中断し、MediationFormatWarningDialog を表示する。

3. THE MediationFormatWarningDialog SHALL 以下のメッセージを表示する：「「媒介作成」シートの1行目が古い形式になっているので https://docs.google.com/spreadsheets/d/1PyMxyCHitJJyWH2dh3z6o7Wr6dTD_XPfd3Y9jJD9UEw/edit?usp=sharing に従って変更してください」

4. THE MediationFormatWarningDialog SHALL 「OK」ボタンを表示する。

5. WHEN 「OK」ボタンが押された時、THE WorkTaskDetailModal SHALL MediationFormatWarningDialog を閉じ、保存処理を継続して実行する（`executeSave` を呼び出す）。

6. WHEN `property_address` の最終値が `"不要"` でない場合、THE WorkTaskDetailModal SHALL 要件1のバリデーションチェックをスキップする。

7. WHEN `mediation_creator` の最終値が空欄（`''`・`null`・`undefined`）である場合、THE WorkTaskDetailModal SHALL 要件1のバリデーションチェックをスキップする。

---

### 要件2：既存バリデーションチェックとの順序制御

**ユーザーストーリー：** 担当者として、複数のバリデーション警告が発生した場合でも、一度に1つずつ確認できるようにしたい。

#### 受け入れ基準

1. WHEN 保存ボタンが押された時、THE WorkTaskDetailModal SHALL 既存の `RowAddWarningDialog` チェック（`cw_request_email_site` と `property_list_row_added` の整合性）を最初に実行する。

2. WHEN 既存の `RowAddWarningDialog` チェックが通過した後、THE WorkTaskDetailModal SHALL 要件1の媒介契約フォーマット警告チェックを実行する。

3. WHEN 要件1の媒介契約フォーマット警告チェックが通過した後（または「OK」で確認された後）、THE WorkTaskDetailModal SHALL 既存のサイト登録確認グループ（`checkSiteRegistrationWarning`）および間取図グループ（`checkFloorPlanWarning`）のチェックを実行する。

4. WHEN 要件1の警告が表示されている時、THE WorkTaskDetailModal SHALL サイト登録確認グループおよび間取図グループのチェックを後回しにする。

---

### 要件3：MediationFormatWarningDialog の視覚的表示

**ユーザーストーリー：** 担当者として、警告ダイアログが通常の確認ダイアログと明確に区別できるようにしたい。

#### 受け入れ基準

1. THE MediationFormatWarningDialog SHALL 警告アイコン（MUI の `WarningAmberIcon`）をダイアログタイトル部分に表示する。

2. THE MediationFormatWarningDialog SHALL タイトルに「フォーマット警告」と表示する。

3. THE MediationFormatWarningDialog SHALL メッセージ内のURL（`https://docs.google.com/spreadsheets/d/1PyMxyCHitJJyWH2dh3z6o7Wr6dTD_XPfd3Y9jJD9UEw/edit?usp=sharing`）をクリック可能なリンクとして表示する。

4. THE MediationFormatWarningDialog SHALL 「OK」ボタンを `primary` カラーで表示する。
