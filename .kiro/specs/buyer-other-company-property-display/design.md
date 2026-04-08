# 設計書：買主リスト詳細画面の他社物件表示機能

## 概要

買主詳細画面の物件詳細カード（PropertyInfoCard）に「他社物件」セクションを追加し、スプレッドシートDJ列（`other_company_property`）とH列（`building_name_price`）のデータを表示する機能を実装します。

この機能により、買主が興味を持っている他社物件の情報を一目で確認できるようになります。

## アーキテクチャ

### システム構成

```
[スプレッドシート] ← GAS同期（10分ごと） → [Supabase DB]
                                                    ↓
                                            [Backend API]
                                                    ↓
                                            [Frontend]
                                                    ↓
                                        [PropertyInfoCard]
```

### データフロー

1. **スプレッドシート → データベース**
   - GAS同期処理（10分ごと）
   - DJ列（`他社物件`） → `buyers.other_company_property`
   - H列（`建物名/価格 内覧物件は赤表示（★は他社物件）`） → `buyers.building_name_price`

2. **データベース → フロントエンド**
   - BuyerDetailPageが30秒ごとに買主データを再取得
   - PropertyInfoCardに買主データを渡す

3. **PropertyInfoCard内での表示**
   - `other_company_property`が空でない場合、「他社物件」セクションを表示
   - `building_name_price`の値を表示

## コンポーネントとインターフェース

### 1. データベーススキーマ

**テーブル**: `buyers`

| カラム名 | 型 | NULL許可 | 説明 |
|---------|-----|---------|------|
| `other_company_property` | TEXT | YES | スプレッドシートDJ列「他社物件」 |
| `building_name_price` | TEXT | YES | スプレッドシートH列「建物名/価格 内覧物件は赤表示（★は他社物件）」 |

**既存カラム**: すでにマイグレーション済み（`backend/migrations/042_add_buyers_complete.sql`）

### 2. カラムマッピング

**ファイル**: `backend/src/config/buyer-column-mapping.json`

```json
{
  "spreadsheetToDatabase": {
    "建物名/価格 内覧物件は赤表示（★は他社物件）": "building_name_price",
    "他社物件": "other_company_property"
  }
}
```

**既存設定**: すでに設定済み

### 3. TypeScript型定義

**ファイル**: `frontend/frontend/src/components/PropertyInfoCard.tsx`

```typescript
interface Buyer {
  pre_viewing_notes?: string;
  viewing_notes?: string;
  other_company_property?: string;  // 追加
  building_name_price?: string;     // 追加
  [key: string]: any;
}
```

### 4. PropertyInfoCardコンポーネント

**ファイル**: `frontend/frontend/src/components/PropertyInfoCard.tsx`

**変更箇所**: 「内覧前伝達事項」セクションの直後に「他社物件」セクションを追加

**表示条件**: `buyer?.other_company_property`が空でない場合のみ表示

**表示位置**: 
- 「内覧前伝達事項」の直後
- 「種別」「担当名」などの基本情報の前

## データモデル

### Buyerエンティティ

```typescript
interface Buyer {
  // 既存フィールド
  buyer_number: string;
  name?: string;
  phone_number?: string;
  email?: string;
  viewing_date?: string;
  latest_status?: string;
  pre_viewing_notes?: string;
  viewing_notes?: string;
  
  // 新規追加フィールド
  other_company_property?: string;  // 他社物件フラグ
  building_name_price?: string;     // 建物名/価格
  
  [key: string]: any;
}
```

### データ取得フロー

```typescript
// BuyerDetailPage.tsx
const fetchBuyer = async () => {
  const res = await api.get(`/api/buyers/${buyer_number}`);
  setBuyer(res.data);  // other_company_property, building_name_price を含む
};

// PropertyInfoCard.tsx
<PropertyInfoCard
  propertyId={property.property_number}
  buyer={buyer}  // other_company_property, building_name_price を含む
/>
```

## エラーハンドリング

### 1. データ取得エラー

**シナリオ**: 買主データの取得に失敗

**対応**: 
- PropertyInfoCardは既存のエラーハンドリングを使用
- 「他社物件」セクションは表示されない（条件分岐により）

### 2. データ同期エラー

**シナリオ**: スプレッドシートからデータベースへの同期に失敗

**対応**:
- GAS同期処理のエラーログに記録
- 次回の同期（10分後）で再試行
- フロントエンドでは古いデータが表示される

### 3. 空データ

**シナリオ**: `other_company_property`が空または`null`

**対応**:
- 「他社物件」セクションを表示しない
- エラーメッセージは表示しない

## テスティング戦略

### 単体テスト

#### 1. PropertyInfoCardコンポーネント

**テストケース**:

1. **他社物件セクションの表示**
   - `buyer.other_company_property`が空でない場合、セクションが表示される
   - `buyer.building_name_price`の値が正しく表示される

2. **他社物件セクションの非表示**
   - `buyer.other_company_property`が空の場合、セクションが表示されない
   - `buyer.other_company_property`が`null`の場合、セクションが表示されない

3. **スタイリング**
   - 背景色が`#fff9e6`である
   - 枠線が`1px solid #f0e5c0`である
   - 角丸が適用されている
   - 内側の余白が適用されている

4. **改行の保持**
   - `building_name_price`に改行が含まれる場合、改行が保持される
   - `whiteSpace: 'pre-wrap'`が適用されている

#### 2. データ取得

**テストケース**:

1. **買主データの取得**
   - `fetchBuyer()`が`other_company_property`と`building_name_price`を含むデータを返す

2. **30秒ごとの再取得**
   - `setInterval`が正しく設定されている
   - 30秒ごとに`fetchBuyer()`が呼び出される

### 統合テスト

#### 1. スプレッドシート → データベース同期

**テストケース**:

1. **DJ列の同期**
   - スプレッドシートDJ列に値を入力
   - GAS同期処理を実行
   - データベースの`other_company_property`に値が保存される

2. **H列の同期**
   - スプレッドシートH列に値を入力
   - GAS同期処理を実行
   - データベースの`building_name_price`に値が保存される

3. **空値の同期**
   - スプレッドシートDJ列を空にする
   - GAS同期処理を実行
   - データベースの`other_company_property`が`null`になる

#### 2. エンドツーエンドテスト

**テストケース**:

1. **他社物件情報の表示**
   - スプレッドシートDJ列に「他社物件」と入力
   - スプレッドシートH列に「建物名：〇〇マンション\n価格：3000万円」と入力
   - GAS同期処理を実行（10分待機）
   - 買主詳細画面を開く
   - PropertyInfoCardに「他社物件」セクションが表示される
   - 「建物名：〇〇マンション」と「価格：3000万円」が改行付きで表示される

2. **他社物件情報の削除**
   - スプレッドシートDJ列を空にする
   - GAS同期処理を実行（10分待機）
   - 買主詳細画面を開く
   - PropertyInfoCardに「他社物件」セクションが表示されない

3. **リアルタイム更新**
   - 買主詳細画面を開いたまま30秒待機
   - PropertyInfoCardが自動的に再取得される
   - 最新の他社物件情報が表示される

### 手動テスト

#### 1. UI確認

**テストケース**:

1. **表示位置**
   - 「他社物件」セクションが「内覧前伝達事項」の直後に表示される
   - 「種別」「担当名」の前に表示される

2. **スタイリング**
   - 黄色の背景色で視覚的に区別できる
   - ベージュの枠線が表示される
   - 角丸が適用されている
   - 内側の余白が適切である

3. **改行の保持**
   - 複数行のテキストが正しく表示される
   - 改行が保持されている

4. **長文の表示**
   - 長文のテキストが正しく折り返される
   - レイアウトが崩れない

#### 2. レスポンシブ確認

**テストケース**:

1. **デスクトップ**
   - 全幅（`xs={12}`）で表示される
   - レイアウトが崩れない

2. **タブレット**
   - 全幅で表示される
   - レイアウトが崩れない

3. **モバイル**
   - 全幅で表示される
   - レイアウトが崩れない

## 実装計画

### Phase 1: フロントエンド実装

**タスク**:

1. PropertyInfoCardコンポーネントに「他社物件」セクションを追加
2. Buyer型定義に`other_company_property`と`building_name_price`を追加
3. 表示条件の実装（`buyer?.other_company_property`が空でない場合のみ表示）
4. スタイリングの実装（黄色背景、ベージュ枠線、角丸、余白）
5. 改行保持の実装（`whiteSpace: 'pre-wrap'`）

**ファイル**:
- `frontend/frontend/src/components/PropertyInfoCard.tsx`

**所要時間**: 1時間

### Phase 2: テスト

**タスク**:

1. 単体テストの実装
2. 統合テストの実行
3. 手動テストの実行
4. バグ修正

**所要時間**: 2時間

### Phase 3: デプロイ

**タスク**:

1. フロントエンドのビルド
2. Vercelへのデプロイ
3. 本番環境での動作確認

**所要時間**: 30分

## 制約事項

### 技術的制約

1. **GAS同期処理の変更禁止**
   - 既存のGAS同期処理（10分ごと）を変更しない
   - カラムマッピングは既に設定済み

2. **データベーススキーマの変更不要**
   - `other_company_property`と`building_name_price`カラムは既に存在
   - マイグレーション不要

3. **バックエンドAPIの変更不要**
   - 既存のAPIが`other_company_property`と`building_name_price`を返す
   - 新規エンドポイント不要

### ビジネス制約

1. **既存レイアウトの維持**
   - PropertyInfoCardの既存レイアウトを大きく変更しない
   - 「内覧前伝達事項」の直後に追加

2. **視覚的な区別**
   - 黄色の背景色で他社物件情報を目立たせる
   - 既存の「内覧前伝達事項」（黄色背景）と同じスタイル

3. **データ同期の遅延**
   - スプレッドシート更新後、最大10分の遅延が発生する
   - フロントエンドは30秒ごとに再取得

## 非機能要件

### パフォーマンス

1. **表示速度**
   - 他社物件情報の表示は1秒以内に完了
   - 既存のPropertyInfoCardの表示速度に影響しない

2. **データ取得**
   - 買主データの取得は既存のAPIを使用
   - 追加のAPIリクエスト不要

### 可用性

1. **エラーハンドリング**
   - データ取得エラー時も既存のエラーハンドリングを使用
   - 「他社物件」セクションは表示されない

2. **データ同期**
   - GAS同期処理のエラー時も次回の同期で再試行
   - フロントエンドでは古いデータが表示される

### 保守性

1. **コードの可読性**
   - 既存のPropertyInfoCardのコードスタイルに従う
   - コメントを追加して意図を明確にする

2. **テスト容易性**
   - 単体テストが容易な構造
   - 表示条件が明確

## セキュリティ

### データ保護

1. **個人情報の扱い**
   - `building_name_price`は個人情報を含まない
   - 既存のセキュリティポリシーに従う

2. **アクセス制御**
   - 既存の買主詳細画面のアクセス制御を使用
   - 追加のアクセス制御不要

## デプロイ手順

### 1. フロントエンドのデプロイ

```bash
# フロントエンドディレクトリに移動
cd frontend/frontend

# ビルド
npm run build

# Vercelへのデプロイ
vercel --prod
```

### 2. 動作確認

1. 買主詳細画面を開く
2. PropertyInfoCardに「他社物件」セクションが表示されることを確認
3. スプレッドシートDJ列を更新
4. 10分後に買主詳細画面を再読み込み
5. 更新された他社物件情報が表示されることを確認

## ロールバック手順

### フロントエンドのロールバック

```bash
# Vercelの管理画面から前のデプロイメントに戻す
# または
vercel rollback
```

### データベースのロールバック

- データベーススキーマの変更なし
- ロールバック不要

## モニタリング

### ログ

1. **フロントエンドログ**
   - ブラウザのコンソールログ
   - エラー発生時のログ

2. **バックエンドログ**
   - 既存のAPIログ
   - 追加のログ不要

### メトリクス

1. **表示速度**
   - PropertyInfoCardの表示速度
   - 既存のメトリクスを使用

2. **エラー率**
   - データ取得エラー率
   - 既存のメトリクスを使用

## まとめ

この設計書では、買主詳細画面の物件詳細カードに「他社物件」セクションを追加する機能を定義しました。

主な実装内容：
- PropertyInfoCardコンポーネントに「他社物件」セクションを追加
- `buyer.other_company_property`が空でない場合のみ表示
- `buyer.building_name_price`の値を黄色背景で表示
- 既存のGAS同期処理とデータベーススキーマを使用
- バックエンドAPIの変更不要

この機能により、買主が興味を持っている他社物件の情報を一目で確認できるようになります。
