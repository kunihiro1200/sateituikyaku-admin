# 要件ドキュメント

## はじめに

買主詳細画面（BuyerDetailPage）における保存UXの改善機能です。現在、ドロップダウン（配信種別フォールド等）を選択すると「編集中」と表示され、保存に時間がかかる問題があります。本機能では、セクション別保存ボタンを導入し、変更があったセクションの保存ボタンをハイライト表示することで、ユーザーが任意のタイミングで素早く保存できるようにします。

## 用語集

- **BuyerDetailPage**: 買主詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **Section**: 買主詳細画面内のフィールドグループ（「問合せ内容」「基本情報」「その他」）
- **SectionSaveButton**: セクション右上に配置する保存ボタン
- **DirtyState**: セクション内のフィールドが変更されたが未保存の状態
- **InlineEditableField**: インライン編集可能なフィールドコンポーネント
- **BuyerApi**: 買主データのCRUD操作を行うAPIクライアント（`buyerApi.update`）
- **SpreadsheetSync**: スプレッドシートへの同期処理（`sync: true` オプション付きAPI呼び出し）

## 要件

### 要件1: セクション別保存ボタンの表示

**ユーザーストーリー:** 担当者として、セクションごとに保存ボタンを確認したい。そうすることで、どのセクションに未保存の変更があるかを一目で把握できる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL セクション（「問合せ内容」「基本情報」「その他」）のヘッダー右側に保存ボタンを表示する
2. WHEN セクション内のいずれかのフィールドが変更された場合、THE SectionSaveButton SHALL ハイライト（強調）表示に切り替わる
3. WHILE DirtyState が false の場合、THE SectionSaveButton SHALL 通常の非ハイライト状態で表示される
4. THE SectionSaveButton SHALL セクションのタイトル行の右端に配置される

### 要件2: セクション別保存の実行

**ユーザーストーリー:** 担当者として、セクションの保存ボタンをクリックしたい。そうすることで、そのセクション内で変更したフィールドのみを即座に保存できる。

#### 受け入れ基準

1. WHEN SectionSaveButton がクリックされた場合、THE BuyerDetailPage SHALL そのセクション内で変更されたフィールドのみを BuyerApi に送信する
2. WHEN SectionSaveButton がクリックされた場合、THE BuyerApi SHALL `sync: true` オプション付きで更新リクエストを実行し SpreadsheetSync を行う
3. WHEN 保存が成功した場合、THE BuyerDetailPage SHALL DirtyState をリセットし SectionSaveButton を非ハイライト状態に戻す
4. WHEN 保存が成功した場合、THE BuyerDetailPage SHALL 成功メッセージをスナックバーで表示する
5. IF 保存が失敗した場合、THEN THE BuyerDetailPage SHALL エラーメッセージをスナックバーで表示し DirtyState を維持する

### 要件3: 保存中の状態表示

**ユーザーストーリー:** 担当者として、保存処理中であることを視覚的に確認したい。そうすることで、操作が受け付けられたことを把握できる。

#### 受け入れ基準

1. WHEN SectionSaveButton がクリックされた場合、THE SectionSaveButton SHALL ローディングインジケーターを表示し、保存完了まで再クリックを無効化する
2. WHEN 保存処理が完了した場合（成功・失敗問わず）、THE SectionSaveButton SHALL ローディング状態を解除する

### 要件4: ドロップダウン変更の変更検知

**ユーザーストーリー:** 担当者として、ドロップダウンを選択した際に変更が検知されてほしい。そうすることで、保存ボタンのハイライトで変更があることを確認できる。

#### 受け入れ基準

1. WHEN ドロップダウン（配信種別・メール種別・問合メール電話対応・3回架電確認済み等）の値が変更された場合、THE BuyerDetailPage SHALL 該当セクションの DirtyState を true に設定する
2. WHEN テキストフィールドの値が変更された場合、THE BuyerDetailPage SHALL 該当セクションの DirtyState を true に設定する
3. WHEN フィールドの値が元の値（保存済みの値）に戻された場合、THE BuyerDetailPage SHALL 該当セクションの DirtyState を false に設定する

### 要件5: 変更フィールドの追跡

**ユーザーストーリー:** 担当者として、変更したフィールドのみが保存されてほしい。そうすることで、意図しないフィールドの上書きを防げる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL セクションごとに変更されたフィールド名と新しい値を追跡する
2. WHEN SectionSaveButton がクリックされた場合、THE BuyerDetailPage SHALL 追跡している変更フィールドのみを含むオブジェクトを BuyerApi に送信する
3. FOR ALL フィールド変更の追跡において、THE BuyerDetailPage SHALL 元の値（ページ読み込み時またはAPIレスポンスの値）と現在の値を比較して変更を判定する（ラウンドトリップ特性）
