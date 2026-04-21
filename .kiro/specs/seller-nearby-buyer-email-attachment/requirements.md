# 要件定義書

## はじめに

売主リスト（SellerListPage）の近隣買主候補タブにある「メール送信」モーダル（`EmailConfirmationModal`）に、ファイル添付機能を追加する。

現在のモーダルは件名・本文のみで添付機能がない。通話モードページ（CallModePage）のヘッダーにある「Email送信」機能と同じ添付方法（Google Drive・ローカルファイル・URL）を参考に実装する。

既存の `ImageSelectorModal` コンポーネントと `/api/emails/send-distribution` エンドポイント（`attachments` パラメータ対応済み）を再利用することで、フロントエンドとバックエンドの変更を最小限に抑える。

## 用語集

- **EmailConfirmationModal**: 売主リストの近隣買主候補タブで「メール送信」ボタンをクリックすると表示されるメール送信確認モーダル（`frontend/frontend/src/components/EmailConfirmationModal.tsx`）
- **NearbyBuyersList**: 近隣買主候補タブのリストコンポーネント（`frontend/frontend/src/components/NearbyBuyersList.tsx`）。`EmailConfirmationModal` を呼び出し、`/api/emails/send-distribution` にPOSTする
- **ImageSelectorModal**: 通話モードページで使用されている画像選択モーダル（`frontend/frontend/src/components/ImageSelectorModal.tsx`）。Google Drive・ローカルファイル・URLの3つのタブを持つ
- **ImageFile**: `ImageSelectorModal` が返す添付ファイルの型。`source`（`'drive'` | `'local'` | `'url'`）、`id`、`name`、`previewUrl`、`driveFileId`、`localFile`、`url` などのフィールドを持つ
- **send-distribution API**: `/api/emails/send-distribution` エンドポイント。`attachments` 配列（Google Drive ID・Base64データ・URL）を受け付け、各買主に個別メールを送信する
- **Attachment**: メールに添付するファイル情報。`source` に応じて `{ id, name }`（Drive）、`{ id, name, base64Data, mimeType }`（ローカル）、`{ id, name, url }`（URL）の形式を取る

## 要件

### 要件1: 添付ファイル選択UI

**ユーザーストーリー:** 担当者として、近隣買主候補へのメール送信時にファイルを添付したい。そうすることで、物件の画像や資料を一緒に送ることができる。

#### 受け入れ基準

1. WHEN メール送信確認モーダルが開かれる, THE EmailConfirmationModal SHALL 本文エリアの下に「画像を添付」ボタンを表示する
2. WHEN 「画像を添付」ボタンがクリックされる, THE EmailConfirmationModal SHALL ImageSelectorModal を開く
3. THE ImageSelectorModal SHALL 「GOOGLE DRIVE」「ローカルファイル」「URL」の3つのタブを表示する
4. WHEN ImageSelectorModal で画像が確定される, THE EmailConfirmationModal SHALL 選択された添付ファイルの件数をボタン付近に表示する
5. WHEN 添付ファイルが1件以上選択されている, THE EmailConfirmationModal SHALL 各添付ファイルのファイル名と削除ボタンを一覧表示する
6. WHEN 添付ファイルの削除ボタンがクリックされる, THE EmailConfirmationModal SHALL 対象の添付ファイルを選択リストから除外する

### 要件2: 添付ファイル付きメール送信

**ユーザーストーリー:** 担当者として、選択した添付ファイルを含めてメールを送信したい。そうすることで、買主候補に物件情報を視覚的に伝えることができる。

#### 受け入れ基準

1. WHEN 添付ファイルが選択された状態で送信ボタンがクリックされる, THE NearbyBuyersList SHALL `/api/emails/send-distribution` に `attachments` 配列を含めてPOSTする
2. THE NearbyBuyersList SHALL `attachments` 配列の各要素を以下の形式に変換して送信する:
   - Google Drive ファイル: `{ id: driveFileId, name }`
   - ローカルファイル: `{ id, name, base64Data, mimeType }`（previewUrlのBase64データを使用）
   - URL: `{ id, name, url }`
3. WHEN 添付ファイルなしで送信ボタンがクリックされる, THE NearbyBuyersList SHALL 従来通り `attachments` なしで `/api/emails/send-distribution` にPOSTする
4. WHEN メール送信が成功する, THE NearbyBuyersList SHALL 添付ファイルの選択状態をリセットする

### 要件3: EmailConfirmationModal のインターフェース拡張

**ユーザーストーリー:** 開発者として、`EmailConfirmationModal` が添付ファイル情報を受け渡しできるようにしたい。そうすることで、`NearbyBuyersList` が添付ファイル付き送信を制御できる。

#### 受け入れ基準

1. THE EmailConfirmationModal SHALL `onConfirm` コールバックのシグネチャを `(subject: string, body: string, attachments: ImageFile[]) => Promise<void>` に拡張する
2. THE EmailConfirmationModal SHALL モーダルが閉じられるとき（キャンセル・送信完了）に添付ファイルの選択状態をリセットする
3. WHEN モーダルが `open: true` で再度開かれる, THE EmailConfirmationModal SHALL 前回の添付ファイル選択状態をリセットする

### 要件4: 添付ファイルのサイズ制限

**ユーザーストーリー:** 担当者として、添付ファイルのサイズ制限を事前に知りたい。そうすることで、送信失敗を防ぐことができる。

#### 受け入れ基準

1. THE ImageSelectorModal SHALL 1ファイルあたり5MBを超える場合にエラーメッセージを表示し、確定を拒否する
2. THE ImageSelectorModal SHALL 選択ファイルの合計サイズが10MBを超える場合にエラーメッセージを表示し、確定を拒否する
3. IF 添付ファイルのサイズ制限を超えた状態で確定ボタンがクリックされる, THEN THE ImageSelectorModal SHALL 「{ファイル名} のサイズが5MBを超えています」または「選択した画像の合計サイズが10MBを超えています」というエラーメッセージを表示する
