# 要件ドキュメント

## はじめに

買主詳細画面（BuyerDetailPage）の「特記事項担当への伝言/質問事項★」フィールドと、内覧結果・後続対応画面（BuyerViewingResultPage）の「内覧結果・後続対応」フィールドに、ヒアリング項目と同じクイックボタン機能を追加する。

## 用語集

- **BuyerDetailPage**: 買主詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **BuyerViewingResultPage**: 内覧結果・後続対応画面（`frontend/frontend/src/pages/BuyerViewingResultPage.tsx`）
- **message_to_assignee**: 「特記事項担当への伝言/質問事項★」フィールドのDBキー
- **viewing_result_follow_up**: 「内覧結果・後続対応」フィールドのDBキー
- **クイックボタン**: テキストフィールドのカーソル位置に定型文を挿入するChipボタン
- **RichTextCommentEditor**: リッチテキスト編集コンポーネント（`insertAtCursor`メソッドを持つ）
- **InlineEditableField**: インライン編集可能なフィールドコンポーネント

## 要件

### 要件1: message_to_assigneeフィールドへのクイックボタン追加

**ユーザーストーリー:** 担当者として、特記事項担当への伝言/質問事項フィールドに定型文を素早く入力したい。そうすることで、入力作業を効率化できる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 「特記事項担当への伝言/質問事項★」フィールドの上部にクイックボタン群を表示する
2. WHEN クイックボタンがクリックされた場合、THE BuyerDetailPage SHALL 対応するテキストをカーソル位置に太字（`<b>テキスト</b>`）で挿入する
3. THE BuyerDetailPage SHALL 以下の10個のクイックボタンを表示する：
   - 「内覧理由」→ `内覧理由：`
   - 「家族構成」→ `家族構成：`
   - 「購入物件の譲れない点」→ `購入物件の譲れない点：`
   - 「この物件の気に入っている点」→ `この物件の気に入っている点：`
   - 「この物件の駄目な点」→ `この物件の駄目な点：`
   - 「購入時障害となる点」→ `購入時障害となる点：`
   - 「仮審査」→ `仮審査：`
   - 「連絡の付きやすい曜日、時間帯」→ `連絡の付きやすい曜日、時間帯：`
   - 「次のアクション」→ `次のアクション：`
   - 「クロージング」→ `クロージング：`
4. THE BuyerDetailPage SHALL message_to_assigneeフィールドをRichTextCommentEditorで表示する
5. WHEN message_to_assigneeフィールドの内容が変更された場合、THE BuyerDetailPage SHALL 保存ボタンを表示する

### 要件2: viewing_result_follow_upフィールドへのクイックボタン追加

**ユーザーストーリー:** 担当者として、内覧結果・後続対応フィールドに定型文を素早く入力したい。そうすることで、内覧後の記録作業を効率化できる。

#### 受け入れ基準

1. THE BuyerViewingResultPage SHALL 「内覧結果・後続対応」フィールドの上部にクイックボタン群を表示する
2. WHEN クイックボタンがクリックされた場合、THE BuyerViewingResultPage SHALL 対応するテキストをフィールドの先頭に挿入する
3. THE BuyerViewingResultPage SHALL 以下の10個のクイックボタンを表示する（要件1と同じボタン定義）：
   - 「内覧理由」→ `内覧理由：`
   - 「家族構成」→ `家族構成：`
   - 「購入物件の譲れない点」→ `購入物件の譲れない点：`
   - 「この物件の気に入っている点」→ `この物件の気に入っている点：`
   - 「この物件の駄目な点」→ `この物件の駄目な点：`
   - 「購入時障害となる点」→ `購入時障害となる点：`
   - 「仮審査」→ `仮審査：`
   - 「連絡の付きやすい曜日、時間帯」→ `連絡の付きやすい曜日、時間帯：`
   - 「次のアクション」→ `次のアクション：`
   - 「クロージング」→ `クロージング：`
