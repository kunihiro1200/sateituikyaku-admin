# 要件定義書

## はじめに

本機能は、社内管理システム（sateituikyaku-admin）の業務詳細画面「契約決済」タブにある「依頼前に確認」フィールドのUI改善を行うものです。

現在、「依頼前に確認」フィールドは `EditableMultilineField` コンポーネントで実装されており、ロングテキスト（長文）が4行のテキストエリアに表示されています。この表示方法では長文の全文確認が困難なため、ボタン化してポップアップで全文表示できるように変更します。

対象ファイル:
- フロントエンド: `frontend/frontend/src/components/WorkTaskDetailModal.tsx`

## 用語集

- **WorkTaskDetailModal**: 業務依頼リストの詳細モーダルコンポーネント（`WorkTaskDetailModal.tsx`）
- **ContractSettlementSection**: WorkTaskDetailModal内の契約決済タブを描画するコンポーネント
- **PreRequestCheckButton**: 「依頼前に確認」フィールドを置き換えるボタンコンポーネント（新規作成）
- **PreRequestCheckPopup**: ロングテキストを全文表示するポップアップ（ダイアログ）コンポーネント（新規作成）
- **pre_request_check**: 「依頼前に確認」に対応するDBカラム（ロングテキスト型）
- **EditableMultilineField**: 複数行テキストフィールドを表示する既存コンポーネント
- **MUI Dialog**: Material UIのダイアログコンポーネント（ポップアップ実装に使用）

---

## 要件

### 要件1: 「依頼前に確認」フィールドのボタン化

**ユーザーストーリー:** 担当者として、「依頼前に確認」フィールドをボタンに変更したい。そうすることで、画面のレイアウトがすっきりし、必要なときだけ内容を確認できるようになる。

#### 受け入れ基準

1. THE ContractSettlementSection SHALL 「依頼前に確認」ラベルと同じ行に「確認する」ボタンを表示する
2. WHEN `pre_request_check` フィールドの値が空（null、undefined、空文字列）の場合、THE PreRequestCheckButton SHALL ボタンを無効化（disabled）状態で表示する
3. WHEN `pre_request_check` フィールドの値が存在する場合、THE PreRequestCheckButton SHALL ボタンを有効化状態で表示する
4. THE ContractSettlementSection SHALL 既存の `EditableMultilineField` コンポーネントを `PreRequestCheckButton` に置き換える

---

### 要件2: ポップアップによるロングテキスト全文表示

**ユーザーストーリー:** 担当者として、「確認する」ボタンをクリックしてポップアップでロングテキストの全文を確認したい。そうすることで、長文の内容を見やすい形で全て読むことができる。

#### 受け入れ基準

1. WHEN 「確認する」ボタンがクリックされた場合、THE PreRequestCheckPopup SHALL ポップアップ（ダイアログ）を表示する
2. THE PreRequestCheckPopup SHALL `pre_request_check` フィールドの全文をポップアップ内に表示する
3. THE PreRequestCheckPopup SHALL ポップアップのタイトルに「依頼前に確認」と表示する
4. THE PreRequestCheckPopup SHALL テキストの改行（`\n`）を画面上の改行として正しく表示する
5. THE PreRequestCheckPopup SHALL ポップアップ内のテキストをスクロール可能にし、長文でも全文を読めるようにする
6. WHEN ポップアップの「閉じる」ボタンがクリックされた場合、THE PreRequestCheckPopup SHALL ポップアップを閉じる
7. WHEN ポップアップの外側（バックドロップ）がクリックされた場合、THE PreRequestCheckPopup SHALL ポップアップを閉じる

---

### 要件3: 既存機能との互換性維持

**ユーザーストーリー:** 担当者として、ボタン化後も「依頼前に確認」フィールドの編集機能を維持したい。そうすることで、既存のデータ入力・編集ワークフローが損なわれない。

#### 受け入れ基準

1. THE ContractSettlementSection SHALL `pre_request_check` フィールドの値をポップアップ内で読み取り専用（表示のみ）で表示する
2. THE ContractSettlementSection SHALL `pre_request_check` フィールドの編集は既存の保存・編集フローを通じて行えるようにする（ポップアップ内での編集は行わない）
3. THE ContractSettlementSection SHALL ボタン化後も他のフィールド（「重説・契約書入力納期*」「コメント（売買契約）」等）のレイアウトに影響を与えない

---

## 実装上の注意事項

### 現在の実装状況

`WorkTaskDetailModal.tsx` の `ContractSettlementSection` コンポーネントにおける現在の実装：

```tsx
<EditableMultilineField label="依頼前に確認" field="pre_request_check" />
```

`EditableMultilineField` は `Grid` コンテナ内にラベルとテキストエリア（4行）を表示するコンポーネントです。

### 変更対象

- `EditableMultilineField label="依頼前に確認" field="pre_request_check"` を新しいボタン+ポップアップ実装に置き換える

### UIライブラリ

既存コンポーネントと同様に Material UI（MUI）を使用します：
- `Button`: ボタン表示
- `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions`: ポップアップ実装
- `Typography`: テキスト表示
- `Grid`: レイアウト
