# Bugfix Requirements Document

## Introduction

通話モードページ（CallModePage）のヘッダーにある「画像」ボタンを押すと、Google Drive APIが「Shared drive not found: 1d9oHRSQ1_UAC5XakBLijUsendj0ZxD4F」というエラーを返し、500エラーが発生するバグを修正する。

このエラーは `GET /api/drive/folders/:sellerNumber` エンドポイントで発生しており、`GoogleDriveService` の `findFolderByName` および `listFiles` メソッドが `driveId` パラメータに共有ドライブIDではなく「業務依頼」フォルダのIDを渡していることが根本原因である。Google Drive API の `corpora: 'drive'` を使用する場合、`driveId` には共有ドライブ自体のID（ルートレベルのID）を指定する必要があるが、現在は「業務依頼」フォルダのIDが誤って渡されている。

以前は正常に動作していたが、何らかの変更（環境変数の変更、または共有ドライブ構成の変更）によりこのエラーが発生するようになった。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 通話モードページで「画像」ボタンを押す THEN システムは `GET /api/drive/folders/:sellerNumber` に対して500エラーを返す

1.2 WHEN `GoogleDriveService.findFolderByName` が `corpora: 'drive'` で呼び出される THEN システムは `driveId` に「業務依頼」フォルダのIDを渡し、Google Drive APIが「Shared drive not found」エラーを返す

1.3 WHEN `GoogleDriveService.listFiles` が共有ドライブ内のフォルダに対して呼び出される THEN システムは `driveId` に「業務依頼」フォルダのIDを渡し、Google Drive APIが「Shared drive not found」エラーを返す

1.4 WHEN リトライ処理が走る THEN システムは同じエラーを3回繰り返し、最終的に500エラーを返す

### Expected Behavior (Correct)

2.1 WHEN 通話モードページで「画像」ボタンを押す THEN システムは売主に対応するGoogle Driveフォルダを正常に取得し、ファイル一覧をダイアログに表示する

2.2 WHEN `GoogleDriveService.findFolderByName` が共有ドライブ内を検索する THEN システムは正しい共有ドライブIDを `driveId` に渡し、「業務依頼」フォルダ配下のサブフォルダを正常に検索できる

2.3 WHEN 売主に対応するフォルダが「業務依頼」フォルダ内に存在する THEN システムはそのフォルダを開いてファイル一覧を表示する

2.4 WHEN 売主に対応するフォルダが「業務依頼」フォルダ内に存在しない THEN システムは新しいフォルダを作成し、空のファイル一覧を表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ファイルアップロード機能（`POST /api/drive/folders/:sellerNumber/files`）を使用する THEN システムは引き続き正常にファイルをアップロードできる

3.2 WHEN ファイル削除機能（`DELETE /api/drive/files/:fileId`）を使用する THEN システムは引き続き正常にファイルを削除できる

3.3 WHEN フォルダ内容取得（`GET /api/drive/folders/contents`）を使用する THEN システムは引き続き正常にフォルダ内容を取得できる

3.4 WHEN 売主フォルダのIDがDBの `seller_drive_folders` テーブルに既に保存されている THEN システムは引き続きそのIDを優先して使用する

3.5 WHEN 公開物件サイト用のバックエンド（`backend/api/`）を使用する THEN システムは変更の影響を受けない（作業対象は `backend/src/` のみ）
