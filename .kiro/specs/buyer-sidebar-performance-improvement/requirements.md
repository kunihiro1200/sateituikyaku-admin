# 買主リストサイドバー表示速度改善 - 要件定義書

## Introduction

買主リストページのサイドバーカテゴリー表示に時間がかかっている問題を解決します。売主リストでは同じ問題をGASで事前計算する方式で解決し、表示速度が大幅に改善されました。買主リストにも同じアーキテクチャを適用し、サイドバーの初回表示を1秒以内に完了させます。

## Glossary

- **System**: 買主リスト管理システム
- **GAS**: Google Apps Script（スプレッドシート同期処理）
- **Sidebar**: 買主リストページの左側に表示されるステータスカテゴリー一覧
- **Pre-calculation**: GASによる事前計算処理（10分ごとに実行）
- **buyer_sidebar_counts**: サイドバーカウントを保存するデータベーステーブル

## Requirements

### Requirement 1: サイドバーカウントの高速取得

**User Story:** As a ユーザー, I want サイドバーカテゴリーが即座に表示される, so that 買主リストページの初回ロードが高速になる

#### Acceptance Criteria

1. WHEN 買主リストページを開く, THE System SHALL サイドバーカウントを1秒以内に表示する
2. THE System SHALL `buyer_sidebar_counts`テーブルから事前計算済みのカウントを取得する
3. THE System SHALL 全買主データの取得を待たずにサイドバーを表示する
4. WHEN サイドバーカウントが存在しない, THE System SHALL フォールバック処理として全買主データから計算する

---

### Requirement 2: GASによる事前計算処理

**User Story:** As a システム, I want サイドバーカウントを10分ごとに事前計算する, so that フロントエンドの負荷を軽減できる

#### Acceptance Criteria

1. THE GAS SHALL 10分ごとに`updateBuyerSidebarCounts_()`関数を実行する
2. THE GAS SHALL 全買主データを読み取り、各カテゴリーの件数を計算する
3. THE GAS SHALL 計算結果を`buyer_sidebar_counts`テーブルに保存する
4. THE GAS SHALL 以下のカテゴリーのカウントを計算する:
   - `viewingDayBefore`（内覧日前日）
   - `todayCall`（当日TEL）
   - `todayCallAssigned`（当日TEL（担当別））
   - `assigned`（担当（担当別））

---

### Requirement 3: バックエンドAPIの実装

**User Story:** As a フロントエンド, I want サイドバーカウントを取得するAPIエンドポイント, so that 高速にカウントを表示できる

#### Acceptance Criteria

1. THE System SHALL `/api/buyers/sidebar-counts`エンドポイントを提供する
2. WHEN エンドポイントが呼び出される, THE System SHALL `buyer_sidebar_counts`テーブルからカウントを取得する
3. THE System SHALL 以下の形式でレスポンスを返す:
   ```json
   {
     "viewingDayBefore": 2,
     "todayCall": 5,
     "todayCallAssigned": { "Y": 3, "I": 2 },
     "assigned": { "Y": 150, "I": 200 }
   }
   ```
4. WHEN `buyer_sidebar_counts`テーブルが空, THE System SHALL フォールバック処理として全買主データから計算する

---

### Requirement 4: フロントエンドの並列取得

**User Story:** As a フロントエンド, I want サイドバーカウントと全買主データを並列取得する, so that 初回ロードが高速になる

#### Acceptance Criteria

1. THE System SHALL サイドバーカウント取得と全買主データ取得を並列実行する
2. THE System SHALL サイドバーカウントを先に表示する（プログレッシブローディング）
3. THE System SHALL 全買主データの取得完了を待たずにサイドバーを表示する
4. WHEN 全買主データの取得が完了, THE System SHALL カテゴリー展開時に詳細データを表示する

---

### Requirement 5: キャッシュ戦略

**User Story:** As a システム, I want サイドバーカウントをキャッシュする, so that 2回目以降のアクセスがさらに高速になる

#### Acceptance Criteria

1. THE System SHALL サイドバーカウントを10分間キャッシュする
2. WHEN キャッシュが有効, THE System SHALL キャッシュからカウントを返す
3. WHEN キャッシュが無効, THE System SHALL `buyer_sidebar_counts`テーブルから取得する
4. WHEN 買主データが更新される, THE System SHALL サイドバーカウントキャッシュを無効化する

---

### Requirement 6: 既存機能の完全保護

**User Story:** As a システム, I want 既存のコードを一切変更しない, so that 動作中の機能を絶対に壊さない

#### Acceptance Criteria

1. THE System SHALL 既存のGASコード（`gas_buyer_complete_code.js`）を変更しない
2. THE System SHALL 既存の買主データ同期処理を変更しない
3. THE System SHALL 既存のフィールド同期処理を変更しない
4. THE System SHALL 既存のカテゴリー定義を変更しない
5. THE System SHALL サイドバーのフィルタリングロジック（`BuyerStatusSidebar.tsx`）を変更しない
6. THE System SHALL 既存のAPIエンドポイント（`/api/buyers`, `/api/buyers/status-categories-with-buyers`）を変更しない
7. THE System SHALL 新規エンドポイント追加のみを行う（既存エンドポイントは変更しない）
8. THE System SHALL 売主リストの成功パターンをそのままコピーする（新しい実装は避ける）

#### 変更禁止ファイル一覧

**絶対に変更してはいけないファイル**:
- ❌ `gas_buyer_complete_code.js` - 買主リスト用GAS
- ❌ `frontend/src/components/BuyerStatusSidebar.tsx` - サイドバーコンポーネント
- ❌ `backend/src/routes/buyers.ts` - 既存の買主APIルート（新規エンドポイント追加のみOK）
- ❌ `.kiro/steering/buyer-sidebar-status-definition.md` - カテゴリー定義

**変更可能なファイル**（最小限の変更のみ）:
- ✅ `frontend/src/pages/BuyersPage.tsx` - 並列取得の最適化のみ
- ✅ `backend/src/routes/buyers.ts` - 新規エンドポイント追加のみ
- ✅ `backend/src/services/BuyerService.ts` - 新規メソッド追加のみ

---

### Requirement 7: エラーハンドリング

**User Story:** As a システム, I want サイドバーカウント取得エラーを適切に処理する, so that ユーザーに影響を与えない

#### Acceptance Criteria

1. WHEN `buyer_sidebar_counts`テーブルが空, THE System SHALL フォールバック処理として全買主データから計算する
2. WHEN APIエラーが発生, THE System SHALL カウントを0にリセットする
3. WHEN GAS実行エラーが発生, THE System SHALL 次回の10分トリガーで再実行する
4. THE System SHALL エラーログを記録する

---

### Requirement 8: パフォーマンス要件

**User Story:** As a ユーザー, I want サイドバーが即座に表示される, so that ストレスなく買主リストを閲覧できる

#### Acceptance Criteria

1. THE System SHALL サイドバーカウントを1秒以内に表示する
2. THE System SHALL 初回ロード時に最初の50件を即座に表示する
3. THE System SHALL バックグラウンドでサイドバーカウントと全件データを並列取得する
4. THE System SHALL 10分間キャッシュを使用して2回目以降のアクセスを高速化する

---

## 参考実装

### 売主リストの成功事例

**ファイル**: `gas_complete_code.js`

**関数**: `updateSidebarCounts_()`

**テーブル**: `seller_sidebar_counts`

**アーキテクチャ**:
1. GASが10分ごとに`updateSidebarCounts_()`を実行
2. 全売主データを読み取り、各カテゴリーの件数を計算
3. 計算結果を`seller_sidebar_counts`テーブルに保存
4. フロントエンドは`/api/sellers/sidebar-counts`から高速取得
5. 初回表示が1秒以内に完了

### 買主リストの現状

**ファイル**: `gas_buyer_complete_code.js`

**関数**: `updateBuyerSidebarCounts_()`（既に実装済み）

**テーブル**: `buyer_sidebar_counts`（既に存在）

**問題点**:
- フロントエンドが`/api/buyers/sidebar-counts`と`/api/buyers/status-categories-with-buyers`の2つのAPIを並列呼び出し
- 全買主データの取得を待ってからサイドバーを表示
- 初回ロードに時間がかかる

### 改善方針

1. **GASコードは変更しない**（既に`updateBuyerSidebarCounts_()`が実装済み）
2. **バックエンドAPIを実装**（`/api/buyers/sidebar-counts`エンドポイント）
3. **フロントエンドを修正**（並列取得 + プログレッシブローディング）
4. **キャッシュ戦略を適用**（10分間キャッシュ）

---

## 制約条件

### 🚨 最重要：既存機能の完全保護

1. **GASコードは絶対に変更しない**
   - `gas_buyer_complete_code.js`は一切触らない
   - 既に動作している同期処理を壊さない
   - `updateBuyerSidebarCounts_()`関数は既に実装済み

2. **サイドバーロジックは絶対に変更しない**
   - `BuyerStatusSidebar.tsx`のフィルタリングロジックを変更しない
   - カテゴリー定義（`buyer-sidebar-status-definition.md`）を変更しない
   - 既存のカテゴリーキー（`viewingDayBefore`, `todayCall`等）を変更しない

3. **買主データ取得ロジックは変更しない**
   - `/api/buyers`エンドポイントは変更しない
   - `/api/buyers/status-categories-with-buyers`エンドポイントは変更しない
   - 既存のフィルタリング・ソート処理を変更しない

4. **最小限の変更のみ**
   - 表示速度の改善のみに集中
   - 新規エンドポイント追加のみ（既存エンドポイントは変更しない）
   - フロントエンドは並列取得の最適化のみ

5. **売主リストと同じアーキテクチャを踏襲**
   - 実績のある方式を採用
   - 売主リストの成功パターンをコピー
   - 新しい実装は避ける

---

## 期待される改善

- サイドバーの初回表示が即座に完了（1秒以内）
- GASが10分ごとにサイドバーカウントを更新
- フロントエンドはテーブルから高速取得
- 2回目以降のアクセスはキャッシュから即座に表示

---

**最終更新日**: 2026年4月5日  
**作成理由**: 買主リストサイドバーの表示速度を改善し、売主リストと同じ高速表示を実現するため
