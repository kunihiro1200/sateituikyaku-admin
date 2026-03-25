# タスクリスト: buyer-detail-chat-notification

## Tasks

- [x] 1. BuyerDetailPage.tsx の BUYER_FIELD_SECTIONS を変更する
  - [x] 1.1 「その他」セクション（title: 'その他'）を BUYER_FIELD_SECTIONS から削除する
  - [x] 1.2 「問合せ内容」セクションから distribution_type フィールドを削除する
  - [x] 1.3 「問合せ内容」セクションの distribution_type があった位置に confirmation_to_assignee フィールドを追加する（fieldType: 'confirmationToAssignee'）

- [x] 2. BuyerDetailPage.tsx のレンダリングロジックを変更する
  - [x] 2.1 ConfirmationToAssignee コンポーネントをインポートする
  - [x] 2.2 propertyAssignee（linkedProperties[0]?.sales_assignee）を取得するロジックを追加する
  - [x] 2.3 fieldType === 'confirmationToAssignee' の場合に ConfirmationToAssignee コンポーネントをレンダリングする特別処理を追加する
  - [x] 2.4 propertyAssignee が null/空の場合は ConfirmationToAssignee を表示しない条件分岐を実装する
  - [x] 2.5 onSendSuccess コールバックで fetchBuyer() を呼び出し、成功スナックバーを表示する
