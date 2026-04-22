# 要件定義書

## はじめに

本機能は、業務詳細画面（`WorkTaskDetailModal`）の「売主、買主詳細」タブにある「ローン」フィールドの表示形式を変更するものです。

現在、「ローン」フィールドは「あり」「なし」のボタン選択（`EditableButtonSelect`）として実装されていますが、このフィールドはスプレッドシートからDBへの同期のみで管理されるため、ユーザーがUIから直接編集できないようにする必要があります。

本変更により、「ローン」フィールドをテキスト表示（読み取り専用）に変更し、スプレッドシートからの同期値のみを表示する形式に統一します。

## 用語集

- **WorkTaskDetailModal**: 業務詳細画面のモーダルコンポーネント（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）
- **SellerBuyerDetailSection**: 「売主、買主詳細」タブのコンテンツコンポーネント（`WorkTaskDetailModal.tsx` 内に定義）
- **EditableButtonSelect**: ボタン選択フィールドコンポーネント（既存）。ユーザーが選択肢をクリックして値を変更できる
- **ReadOnlyDisplayField**: 読み取り専用テキスト表示コンポーネント（既存）。値を表示するのみで編集不可
- **loan**: `work_tasks` テーブルの「ローン」カラム（値: 「あり」または「なし」）
- **WorkTaskSyncService**: スプレッドシートと `work_tasks` テーブルを同期するサービス（`backend/src/services/WorkTaskSyncService.ts`）
- **work-task-column-mapping.json**: スプレッドシートカラム名とDBカラム名のマッピング設定ファイル

---

## 要件

### 要件1: 「ローン」フィールドの読み取り専用表示への変更

**ユーザーストーリー:** 業務担当者として、「ローン」フィールドがスプレッドシートからの同期値のみで管理されることを理解した上で、UIから誤って値を変更できないようにしたい。

#### 受け入れ基準

1. THE SellerBuyerDetailSection SHALL 「ローン」フィールドを `EditableButtonSelect` ではなく `ReadOnlyDisplayField` として表示する
2. WHEN `work_tasks` テーブルの `loan` カラムに値（「あり」または「なし」）が存在するとき、THE SellerBuyerDetailSection SHALL その値をテキストとして表示する
3. IF `work_tasks` テーブルの `loan` カラムが `null` または空のとき、THEN THE SellerBuyerDetailSection SHALL 空文字またはハイフン（`-`）を表示する
4. THE SellerBuyerDetailSection SHALL 「ローン」フィールドに対してユーザーがクリック・選択・編集できるインタラクティブな要素を表示しない

---

### 要件2: スプレッドシート同期による値管理の維持

**ユーザーストーリー:** 業務担当者として、「ローン」フィールドの値がスプレッドシートからの同期によってのみ更新されることを期待する。

#### 受け入れ基準

1. WHEN `WorkTaskSyncService` がスプレッドシートから同期を実行したとき、THE WorkTaskSyncService SHALL スプレッドシートの「ローン」列の値を `work_tasks` テーブルの `loan` カラムに反映する
2. THE WorkTaskDetailModal SHALL フロントエンドのUIから `loan` フィールドの値を `PUT /api/work-tasks/:propertyNumber` に送信しない
3. THE WorkTaskSyncService SHALL 既存の `work-task-column-mapping.json` の「ローン」→ `loan` マッピングを維持する

---

### 要件3: 既存フィールドへの影響なし

**ユーザーストーリー:** 業務担当者として、「ローン」フィールドの変更が「売主、買主詳細」タブの他のフィールドに影響しないことを期待する。

#### 受け入れ基準

1. THE SellerBuyerDetailSection SHALL 「ローン」フィールド以外の全フィールド（売主情報・買主情報・金融機関名・日程・司法書士・仲介業者情報）を従来と同様に編集可能な状態で表示する
2. THE SellerBuyerDetailSection SHALL 「金融機関名」フィールドを引き続き `EditableField`（テキスト入力）として表示する
3. WHEN ユーザーが「ローン」以外のフィールドを編集して保存したとき、THE WorkTaskDetailModal SHALL 従来と同様に `work_tasks` テーブルに値を保存する
