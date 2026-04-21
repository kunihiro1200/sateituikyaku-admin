# 要件定義書

## はじめに

本機能は、売主管理システム（sateituikyaku-admin）の物件リスト詳細画面（`PropertyListingDetailPage`）において、「一般媒介非公開（仮）」フィールドの表示・操作UIを追加するものである。

`atbb状況`フィールドの値に「一般」という文字が含まれる場合のみ、「一般媒介非公開（仮）」フィールドを表示する。このフィールドは「非公開予定」と「不要」の2択ボタンUIで操作でき、スプレッドシートのDD列（カラム名「一般媒介非公開（仮）」）と相互同期する。

なお、`general_mediation_private` フィールドはデータベースおよびスプレッドシートのカラムマッピングに既に存在しており、本機能はフロントエンドのUI追加とバックエンドの専用APIエンドポイント追加が主な実装範囲となる。

## 用語集

- **PropertyListingDetailPage**: 物件リスト詳細画面（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
- **atbb_status**: ATBBの公開状況を示すフィールド（「一般・公開中」「一般・公開前」「専任・公開中」等）
- **general_mediation_private**: 「一般媒介非公開（仮）」フィールドのDBカラム名。値は「非公開予定」または「不要」または空文字
- **PropertyListingService**: 物件リストのバックエンドサービス（`backend/src/services/PropertyListingService.ts`）
- **スプレッドシート**: Google スプレッドシート（物件リスト管理用）。DD列が「一般媒介非公開（仮）」に対応
- **確認ボタン**: 既存の「確認：未/済」トグルボタンUI（本機能の参考実装）

---

## 要件

### 要件1: 条件付き表示

**ユーザーストーリー:** 担当者として、atbb状況が「一般」を含む物件の詳細画面を開いたとき、「一般媒介非公開（仮）」フィールドを確認・操作したい。そうすることで、一般媒介物件の非公開予定状況を管理できる。

#### 受け入れ基準

1. WHEN `atbb_status` の値に「一般」という文字列が含まれる場合、THE PropertyListingDetailPage SHALL 「一般媒介非公開（仮）」フィールドを表示する
2. WHEN `atbb_status` の値に「一般」という文字列が含まれない場合（「専任・公開中」「非公開（専任）」「他社物件」等）、THE PropertyListingDetailPage SHALL 「一般媒介非公開（仮）」フィールドを非表示にする
3. WHEN `atbb_status` が未設定（空文字またはnull）の場合、THE PropertyListingDetailPage SHALL 「一般媒介非公開（仮）」フィールドを非表示にする
4. THE PropertyListingDetailPage SHALL 「一般媒介非公開（仮）」フィールドを「atbb状況」フィールドの右側に配置する

---

### 要件2: ボタンUI

**ユーザーストーリー:** 担当者として、「一般媒介非公開（仮）」フィールドを「非公開予定」または「不要」の2択ボタンで操作したい。そうすることで、直感的に状態を切り替えられる。

#### 受け入れ基準

1. THE PropertyListingDetailPage SHALL 「非公開予定」と「不要」の2つのボタンを ButtonGroup として表示する
2. WHEN 現在の `general_mediation_private` の値が「非公開予定」の場合、THE PropertyListingDetailPage SHALL 「非公開予定」ボタンを赤色背景（`contained` バリアント、`color="error"`）で表示し、「不要」ボタンを白色背景（`outlined` バリアント）で表示する
3. WHEN 現在の `general_mediation_private` の値が「不要」または空文字またはnullの場合、THE PropertyListingDetailPage SHALL 「不要」ボタンを白色背景（`outlined` バリアント）で表示し、「非公開予定」ボタンを白色背景（`outlined` バリアント）で表示する
4. WHEN ユーザーが「非公開予定」ボタンをクリックした場合、THE PropertyListingDetailPage SHALL `general_mediation_private` の値を「非公開予定」に更新するAPIリクエストを送信する
5. WHEN ユーザーが「不要」ボタンをクリックした場合、THE PropertyListingDetailPage SHALL `general_mediation_private` の値を「不要」に更新するAPIリクエストを送信する
6. WHILE APIリクエストが処理中の場合、THE PropertyListingDetailPage SHALL ボタンを無効化（disabled）して二重送信を防止する

---

### 要件3: バックエンドAPIエンドポイント

**ユーザーストーリー:** システムとして、「一般媒介非公開（仮）」フィールドの更新を専用APIエンドポイントで処理したい。そうすることで、フロントエンドからの更新リクエストを安全に受け付けられる。

#### 受け入れ基準

1. THE PropertyListingService SHALL `PUT /api/property-listings/:propertyNumber/general-mediation-private` エンドポイントを提供する
2. WHEN リクエストボディの `generalMediationPrivate` フィールドが「非公開予定」または「不要」の場合、THE PropertyListingService SHALL データベースの `general_mediation_private` カラムを更新する
3. IF リクエストボディの `generalMediationPrivate` フィールドが「非公開予定」でも「不要」でもない場合、THEN THE PropertyListingService SHALL HTTP 400 エラーを返す
4. WHEN データベース更新が成功した場合、THE PropertyListingService SHALL HTTP 200 と `{ success: true }` を返す
5. IF データベース更新が失敗した場合、THEN THE PropertyListingService SHALL HTTP 500 エラーを返す

---

### 要件4: スプレッドシート同期

**ユーザーストーリー:** 担当者として、「一般媒介非公開（仮）」フィールドを更新したとき、スプレッドシートのDD列にも自動的に反映されてほしい。そうすることで、DBとスプレッドシートの整合性が保たれる。

#### 受け入れ基準

1. WHEN `general_mediation_private` フィールドが更新された場合、THE PropertyListingService SHALL スプレッドシートの「一般媒介非公開（仮）」列（DD列）に同じ値を書き込む
2. IF スプレッドシートへの同期が失敗した場合、THEN THE PropertyListingService SHALL エラーをログに記録し、データベース更新の結果には影響を与えない（同期失敗はサイレントに処理する）
3. THE PropertyListingService SHALL 既存の `syncToSpreadsheet` メソッドのカラムマッピング（`general_mediation_private` → 「一般媒介非公開（仮）」）を利用してスプレッドシートに同期する

---

### 要件5: フィードバック表示

**ユーザーストーリー:** 担当者として、「一般媒介非公開（仮）」フィールドを更新したとき、操作結果をスナックバーで確認したい。そうすることで、更新が成功したか失敗したかを即座に把握できる。

#### 受け入れ基準

1. WHEN `general_mediation_private` の更新が成功した場合、THE PropertyListingDetailPage SHALL 「一般媒介非公開（仮）」を「{値}」に更新しました」というスナックバーを表示する
2. IF `general_mediation_private` の更新が失敗した場合、THEN THE PropertyListingDetailPage SHALL エラーメッセージをスナックバーで表示する

---

### 要件6: サイドバーカテゴリー「非公開予定（確認後）」

**ユーザーストーリー:** 担当者として、「非公開予定」に設定された物件をサイドバーの専用カテゴリーで一覧確認したい。そうすることで、非公開予定物件を素早く把握・管理できる。

#### 受け入れ基準

1. THE PropertyListingSidebar SHALL 「非公開予定（確認後）」というカテゴリーを表示し、`general_mediation_private` が「非公開予定」の物件件数をバッジで表示する
2. WHEN ユーザーが「非公開予定（確認後）」カテゴリーをクリックした場合、THE PropertyListingSidebar SHALL `general_mediation_private` が「非公開予定」の物件のみをフィルタリングして表示する
3. WHEN `general_mediation_private` の値が「非公開予定」から「不要」に変更された場合、THE PropertyListingSidebar SHALL 該当物件を「非公開予定（確認後）」カテゴリーから即座に除外する（リアルタイム更新）
4. WHEN `general_mediation_private` の値が「不要」または空から「非公開予定」に変更された場合、THE PropertyListingSidebar SHALL 該当物件を「非公開予定（確認後）」カテゴリーに即座に追加する（リアルタイム更新）
5. THE PropertyListingSidebar SHALL 「非公開予定（確認後）」カテゴリーのバッジ件数を、`general_mediation_private` の値変更と同時にリアルタイムで更新する
