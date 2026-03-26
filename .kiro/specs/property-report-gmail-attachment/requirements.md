# 要件ドキュメント

## はじめに

物件リストの「報告」ページ（`PropertyReportPage.tsx`）のGmail送信確認ダイアログに、画像添付機能を追加する。

参照実装として、売主リストの通話モードページ（`CallModePage.tsx`）で既に実装されている `ImageSelectorModal` を使用した画像添付機能と同じ仕組みで実装する。

バックエンドの `send-report-email` エンドポイント（`backend/src/routes/propertyListings.ts`）は既に `multipart/form-data` と添付ファイルに対応済みのため、フロントエンド（`PropertyReportPage.tsx`）のみ変更する。

## 用語集

- **PropertyReportPage**: 物件リストの報告ページ（`frontend/frontend/src/pages/PropertyReportPage.tsx`）
- **ImageSelectorModal**: 画像選択モーダルコンポーネント（`frontend/frontend/src/components/ImageSelectorModal.tsx`）
- **送信確認ダイアログ**: `sendConfirmDialogOpen` ステートで制御されるメール確認・送信ダイアログ
- **selectedImages**: 選択された画像を保持するステート（`ImageFile[]` 型）
- **ImageFile**: `source`（`'drive'` / `'local'` / `'url'`）を持つ画像オブジェクト
- **send-report-email**: バックエンドのメール送信エンドポイント（`multipart/form-data` 対応済み）
- **CallModePage**: 参照実装元の通話モードページ（`frontend/frontend/src/pages/CallModePage.tsx`）

## 要件

### 要件1: 画像添付ステートの追加

**ユーザーストーリー:** 担当者として、報告メール送信ダイアログで画像を添付したい。そうすることで、物件の写真や資料をメールに添付して売主に送ることができる。

#### 受け入れ基準

1. THE PropertyReportPage SHALL `imageSelectorOpen`（boolean）・`selectedImages`（any[]）・`imageError`（string | null）の3つのステートを保持する
2. THE PropertyReportPage SHALL `handleOpenImageSelector`・`handleImageSelectionConfirm`・`handleImageSelectionCancel` の3つのハンドラー関数を実装する
3. WHEN `handleImageSelectionConfirm` が呼び出される, THE PropertyReportPage SHALL 引数の画像配列を `selectedImages` ステートに保存し、`imageSelectorOpen` を false にし、`imageError` を null にする
4. WHEN `handleImageSelectionCancel` が呼び出される, THE PropertyReportPage SHALL `imageSelectorOpen` を false にする

### 要件2: 送信確認ダイアログへの「画像を添付」ボタン追加

**ユーザーストーリー:** 担当者として、メール確認ダイアログ内で画像を選択・確認したい。そうすることで、送信前に添付画像を確認できる。

#### 受け入れ基準

1. THE PropertyReportPage SHALL 送信確認ダイアログ（`sendConfirmDialogOpen`）の本文編集エリアの下に「画像を添付」ボタンを表示する
2. THE PropertyReportPage SHALL 「画像を添付」ボタンに `ImageIcon` アイコンを使用し、`variant="outlined"` で表示する
3. WHEN 「画像を添付」ボタンがクリックされる, THE PropertyReportPage SHALL `imageSelectorOpen` を true にして `ImageSelectorModal` を開く
4. WHEN `selectedImages` に1枚以上の画像が選択されている, THE PropertyReportPage SHALL 「{N}枚の画像が選択されました」という `severity="success"` の `Alert` を表示する
5. WHEN `imageError` に値がある, THE PropertyReportPage SHALL `severity="error"` の `Alert` でエラーメッセージを表示する

### 要件3: ImageSelectorModalの組み込み

**ユーザーストーリー:** 担当者として、GOOGLE DRIVE・ローカルファイル・URLの3つの方法で画像を選択したい。そうすることで、様々な場所にある画像を添付できる。

#### 受け入れ基準

1. THE PropertyReportPage SHALL `ImageSelectorModal` コンポーネントを `'../components/ImageSelectorModal'` からインポートする
2. THE PropertyReportPage SHALL `ImageSelectorModal` を `open={imageSelectorOpen}`・`onConfirm={handleImageSelectionConfirm}`・`onCancel={handleImageSelectionCancel}` のプロパティで描画する
3. THE PropertyReportPage SHALL `Image as ImageIcon` を `@mui/icons-material` からインポートする

### 要件4: 画像添付付きメール送信

**ユーザーストーリー:** 担当者として、選択した画像を添付してメールを送信したい。そうすることで、物件情報と一緒に画像を売主に届けられる。

#### 受け入れ基準

1. WHEN `handleSend` が呼び出される, THE PropertyReportPage SHALL `selectedImages` の内容を `CallModePage` と同じ変換ロジックで `attachmentImages` 配列に変換する
   - `source === 'drive'` の場合: `{ id: img.driveFileId || img.id, name: img.name }` 形式
   - `source === 'local'` かつ `previewUrl` がある場合: Base64データを抽出して `{ id, name, base64Data, mimeType }` 形式
   - `source === 'url'` かつ `url` がある場合: `{ id, name, url }` 形式
2. WHEN `attachmentImages` が1件以上ある, THE PropertyReportPage SHALL `multipart/form-data` 形式で `/api/property-listings/{propertyNumber}/send-report-email` にリクエストを送信する
3. WHEN `attachmentImages` が0件の場合, THE PropertyReportPage SHALL 従来通り `application/json` 形式でリクエストを送信する
4. WHEN `multipart/form-data` で送信する場合, THE PropertyReportPage SHALL `to`・`subject`・`body`・`template_name`・`report_date`・`report_assignee`・`report_completed` を `FormData` のフィールドとして追加する
5. WHEN `source === 'local'` の画像を送信する場合, THE PropertyReportPage SHALL Base64文字列を `Blob` に変換して `FormData` の `attachments` フィールドに追加する
6. WHEN `source === 'drive'` または `source === 'url'` の画像を送信する場合, THE PropertyReportPage SHALL 画像情報をJSON文字列として `driveAttachments` フィールドに追加する
7. WHEN メール送信が成功する, THE PropertyReportPage SHALL `selectedImages` を空配列にリセットし、`sendConfirmDialogOpen` を false にする

### 要件5: ダイアログクローズ時のリセット

**ユーザーストーリー:** 担当者として、ダイアログをキャンセルしたとき、次回開いたときに前回の選択が残っていないようにしたい。

#### 受け入れ基準

1. WHEN `handleSendCancel` が呼び出される, THE PropertyReportPage SHALL `selectedImages` を空配列にリセットする
2. WHEN `handleSendCancel` が呼び出される, THE PropertyReportPage SHALL `imageError` を null にリセットする
