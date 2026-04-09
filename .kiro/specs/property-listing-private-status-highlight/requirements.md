# 要件定義ドキュメント: 物件リスト一覧「非公開」行ハイライト機能

## はじめに

本ドキュメントは、物件リスト一覧画面において、非公開ステータスの物件行を視覚的に区別するための機能要件を定義します。この機能により、ユーザーは一目で非公開物件を識別できるようになり、業務効率が向上します。

## 用語集

- **System**: 物件リスト一覧表示システム
- **PropertyListing**: 物件リストデータ（物件番号、住所、ステータスなどを含む）
- **atbb_status**: 物件のステータスフィールド（「専任・非公開」「一般・公開中」などの値を持つ）
- **Private_Status**: 「非公開」という文字列を含むステータス
- **Gray_Background**: グレー背景色（rgba(0, 0, 0, 0.04)）
- **Default_Background**: デフォルト背景色（inherit）
- **isPrivateStatus_Function**: 非公開ステータスを判定するユーティリティ関数
- **Desktop_View**: デスクトップ表示（テーブル形式）
- **Mobile_View**: モバイル表示（カード形式）

## 要件

### 要件1: 非公開ステータスの視覚的区別

**ユーザーストーリー**: 物件管理者として、物件リスト一覧で非公開物件を一目で識別したいので、非公開物件の行に視覚的な区別が必要です。

#### 受入基準

1. WHEN atbb_statusに「非公開」が含まれる THEN THE System SHALL その行にGray_Backgroundを適用する
2. WHEN atbb_statusがundefinedまたは空文字 THEN THE System SHALL Default_Backgroundを適用する
3. WHEN 非公開行をクリック THEN THE System SHALL 詳細ページに遷移する

### 要件2: 判定ロジックの正確性

**ユーザーストーリー**: 開発者として、非公開ステータスの判定が正確であることを保証したいので、明確な判定ロジックが必要です。

#### 受入基準

1. THE isPrivateStatus_Function SHALL 「非公開」を含む文字列に対してtrueを返す
2. THE isPrivateStatus_Function SHALL 「非公開」を含まない文字列に対してfalseを返す
3. THE isPrivateStatus_Function SHALL undefinedまたは空文字に対してfalseを返す

### 要件3: レスポンシブ対応

**ユーザーストーリー**: モバイルユーザーとして、スマートフォンでも非公開物件を識別したいので、モバイル表示でも同じ視覚的区別が必要です。

#### 受入基準

1. WHEN Mobile_Viewで表示 THEN THE System SHALL カード表示でもGray_Backgroundを適用する
2. WHEN Desktop_Viewで表示 THEN THE System SHALL テーブル行でGray_Backgroundを適用する
3. WHEN 画面サイズを変更 THEN THE System SHALL 両方の表示形式で一貫した背景色を維持する

### 要件4: 既存機能への影響なし

**ユーザーストーリー**: ユーザーとして、背景色の変更が既存の操作に影響しないことを期待するので、全ての既存機能が正常に動作する必要があります。

#### 受入基準

1. WHEN 非公開行にホバー THEN THE System SHALL ホバー効果を適用する
2. WHEN 非公開行を選択 THEN THE System SHALL 選択状態を表示する
3. WHEN 非公開行のチェックボックスをクリック THEN THE System SHALL 選択状態を切り替える

### 要件5: パフォーマンス

**ユーザーストーリー**: ユーザーとして、大量の物件データを表示する際も快適に操作したいので、パフォーマンスの劣化がないことが必要です。

#### 受入基準

1. WHEN 100件以上のPropertyListingを表示 THEN THE System SHALL 1秒以内にレンダリングを完了する
2. WHEN isPrivateStatus_Functionを呼び出し THEN THE System SHALL 1ミリ秒以内に結果を返す
3. WHEN ページをスクロール THEN THE System SHALL スムーズにスクロールする

### 要件6: エラーハンドリング

**ユーザーストーリー**: システム管理者として、予期しないデータでもシステムがクラッシュしないことを期待するので、適切なエラーハンドリングが必要です。

#### 受入基準

1. IF atbb_statusがnull THEN THE System SHALL Default_Backgroundを適用しエラーを発生させない
2. IF atbb_statusが予期しない型 THEN THE System SHALL Default_Backgroundを適用しエラーを発生させない
3. IF PropertyListingデータが不完全 THEN THE System SHALL 可能な範囲で表示を継続する

### 要件7: アクセシビリティ

**ユーザーストーリー**: 視覚障害のあるユーザーとして、スクリーンリーダーでも非公開ステータスを識別したいので、適切なARIA属性が必要です。

#### 受入基準

1. WHEN 非公開行を表示 THEN THE System SHALL aria-label属性に「非公開」を含める
2. WHEN スクリーンリーダーで読み上げ THEN THE System SHALL 非公開ステータスを音声で伝える
3. THE System SHALL 色だけでなくテキストでもステータスを表示する

---

**最終更新日**: 2026年4月9日
**作成理由**: 設計ドキュメントから要件定義を導出
