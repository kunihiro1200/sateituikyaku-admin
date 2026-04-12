# 要件ドキュメント

## はじめに

業務詳細画面（WorkTaskDetailModal）の「契約決済」タブにおいて、以下の6つのフィールドを非表示にする機能変更。
これらのフィールドは現在 `WorkTaskDetailModal.tsx` の `ContractSettlementSection` コンポーネント内に存在するが、業務フローの変更により不要となったため非表示にする。

対象ファイル: `frontend/frontend/src/components/WorkTaskDetailModal.tsx`

## 用語集

- **WorkTaskDetailModal**: 業務詳細画面のモーダルコンポーネント
- **ContractSettlementSection**: 「契約決済」タブのコンテンツを描画するコンポーネント
- **EditableYesNo**: Yes/No選択フィールドを描画するコンポーネント
- **EditableField**: テキスト・日付・数値フィールドを描画するコンポーネント
- **非表示フィールド**: UIから削除（または `display: none`）するフィールド

## 要件

### 要件1: 「広瀬さんへ依頼（売買契約関連）」フィールドの非表示

**ユーザーストーリー:** 担当者として、不要になった「広瀬さんへ依頼（売買契約関連）」フィールドを画面から非表示にしたい。そうすることで、画面がすっきりし、必要な情報に集中できる。

#### 受け入れ基準

1. THE ContractSettlementSection SHALL NOT render the `EditableYesNo` component with label "広瀬さんへ依頼（売買契約関連）" (`field="hirose_request_sales"`)
2. WHEN the user opens the 「契約決済」 tab, THE ContractSettlementSection SHALL display all other fields except the hidden ones

### 要件2: 「CWへ依頼（売買契約関連）」フィールドの非表示

**ユーザーストーリー:** 担当者として、不要になった「CWへ依頼（売買契約関連）」フィールドを画面から非表示にしたい。そうすることで、画面がすっきりし、必要な情報に集中できる。

#### 受け入れ基準

1. THE ContractSettlementSection SHALL NOT render the `EditableYesNo` component with label "CWへ依頼（売買契約関連）" (`field="cw_request_sales"`)

### 要件3: 「作業内容」フィールドの非表示

**ユーザーストーリー:** 担当者として、不要になった「作業内容」フィールド（書類取得のみ／入力のみ／両方のボタングループ）を画面から非表示にしたい。

#### 受け入れ基準

1. THE ContractSettlementSection SHALL NOT render the `Grid` container that displays the "作業内容" button group (`field="work_content"`)

### 要件4: 「添付資料準備納期」フィールドの非表示

**ユーザーストーリー:** 担当者として、不要になった「添付資料準備納期」フィールドを画面から非表示にしたい。

#### 受け入れ基準

1. THE ContractSettlementSection SHALL NOT render the `EditableField` component with label "添付資料準備納期" (`field="attachment_prep_deadline"`)

### 要件5: 「添付資料完了」フィールドの非表示

**ユーザーストーリー:** 担当者として、不要になった「添付資料完了」フィールドを画面から非表示にしたい。

#### 受け入れ基準

1. THE ContractSettlementSection SHALL NOT render the `EditableField` component with label "添付資料完了" (`field="attachment_completed"`)

### 要件6: 「添付資料印刷」フィールドの非表示

**ユーザーストーリー:** 担当者として、不要になった「添付資料印刷」フィールドを画面から非表示にしたい。

#### 受け入れ基準

1. THE ContractSettlementSection SHALL NOT render the `EditableField` component with label "添付資料印刷" (`field="attachment_printed"`)

### 要件7: 他フィールドへの影響なし

**ユーザーストーリー:** 担当者として、非表示にするフィールド以外の「契約決済」タブのフィールドは引き続き正常に表示・操作できることを確認したい。

#### 受け入れ基準

1. WHEN the 6 fields are hidden, THE ContractSettlementSection SHALL continue to render all remaining fields in their original order
2. WHEN the user edits any remaining field, THE WorkTaskDetailModal SHALL save the changes correctly
3. THE WorkTaskDetailModal SHALL NOT modify any backend API, database schema, or data model as part of this change
