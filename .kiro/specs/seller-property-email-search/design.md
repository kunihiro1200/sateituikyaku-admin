# Design Document: 売主リスト・物件リストにメールアドレス検索機能を追加

## Overview

売主リスト一覧画面と物件リスト一覧画面の検索バーに、メールアドレスでの検索機能を追加します。現在、買主リストでは既にメールアドレス検索が実装されていますが（コミット: 4ce5983e）、売主リストと物件リストではメールアドレスが検索できません。

この機能により、ユーザーはメールアドレス（または一部）を入力して売主や物件を素早く検索できるようになります。

### 目的

- メールアドレスから売主情報を素早く検索できるようにする
- 売主のメールアドレスから物件情報を素早く検索できるようにする
- 既存の検索機能に影響を与えない
- 検索パフォーマンスを維持する

### 重要な違い

**売主リスト**:
- メールアドレスは**暗号化**されている（`sellers.email`）
- 全件取得→復号化→部分一致検索が必要
- 既存の検索ロジック（名前、住所、電話番号）と同じアプローチ

**物件リスト**:
- メールアドレスは**平文**で保存されている（`property_listings.seller_email`）
- ILIKE検索で直接検索可能
- 買主リストの実装と同じアプローチ

## Architecture

### システム構成

```
[フロントエンド: SellersPage.tsx]
         ↓ 検索クエリ送信
[バックエンド: /api/sellers/search]
         ↓
[SellerService.searchSellers()]
         ↓ 全件取得→復号化→フィルタリング
[Supabase: sellers テーブル]
```

```
[フロントエンド: PropertyListingsPage.tsx]
         ↓ 検索クエリ送信
[バックエンド: /api/property-listings/search]
         ↓
[PropertyListingService.searchByPropertyNumber()]
         ↓ ILIKE検索
[Supabase: property_listings テーブル]
```

### 変更対象ファイル

1. **バックエンド**
   - `backend/src/services/SellerService.supabase.ts` - `searchSellers()` メソッドにメールアドレス検索を追加
   - `backend/src/services/PropertyListingService.ts` - `searchByPropertyNumber()` メソッドにメールアドレス検索を追加

2. **フロントエンド**
   - 変更不要（既存の検索バーがそのまま使用可能）

## Components and Interfaces

### 1. SellerService.searchSellers() メソッド

#### 現在の実装

```typescript
async searchSellers(query: string, includeDeleted: boolean = false): Promise<Seller[]> {
  // 売主番号での検索（高速パス）
  if (lowerQuery.match(/^[a-z]{2}\d+$/i)) {
    // データベースで直接検索
  }
  
  // 名前、住所、電話番号での検索（低速パス）
  // 全件取得→復号化→部分一致検索
  const decryptedSellers = await Promise.all(sellers.map(seller => this.decryptSeller(seller)));
  
  const results = decryptedSellers.filter(
    (seller) =>
      (seller.name && seller.name.toLowerCase().includes(lowerQuery)) ||
      (seller.address && seller.address.toLowerCase().includes(lowerQuery)) ||
      (seller.phoneNumber && seller.phoneNumber.toLowerCase().includes(lowerQuery)) ||
      (seller.sellerNumber && seller.sellerNumber.toLowerCase().includes(lowerQuery))
  );
}
```

#### 変更後の実装

```typescript
async searchSellers(query: string, includeDeleted: boolean = false): Promise<Seller[]> {
  // 売主番号での検索（高速パス）
  if (lowerQuery.match(/^[a-z]{2}\d+$/i)) {
    // データベースで直接検索
  }
  
  // 名前、住所、電話番号、メールアドレスでの検索（低速パス）
  // 全件取得→復号化→部分一致検索
  const decryptedSellers = await Promise.all(sellers.map(seller => this.decryptSeller(seller)));
  
  const results = decryptedSellers.filter(
    (seller) =>
      (seller.name && seller.name.toLowerCase().includes(lowerQuery)) ||
      (seller.address && seller.address.toLowerCase().includes(lowerQuery)) ||
      (seller.phoneNumber && seller.phoneNumber.toLowerCase().includes(lowerQuery)) ||
      (seller.email && seller.email.toLowerCase().includes(lowerQuery)) ||  // ← メールアドレスを追加
      (seller.sellerNumber && seller.sellerNumber.toLowerCase().includes(lowerQuery))
  );
}
```

#### 変更点

- 復号化後のフィルタリング条件に `seller.email` を追加
- 既存の検索ロジック（全件取得→復号化→フィルタリング）をそのまま使用
- パフォーマンスへの影響は最小限（既に全件取得・復号化しているため）

### 2. PropertyListingService.searchByPropertyNumber() メソッド

#### 現在の実装

```typescript
async searchByPropertyNumber(propertyNumber: string, exactMatch: boolean = false): Promise<any[]> {
  let query = this.supabase
    .from('property_listings')
    .select('*');
  
  if (exactMatch) {
    query = query.eq('property_number', sanitizedNumber);
  } else {
    query = query.ilike('property_number', `%${sanitizedNumber}%`);
  }
  
  query = query.order('created_at', { ascending: false });
  
  const { data, error } = await query;
  return data || [];
}
```

#### 変更後の実装

```typescript
async searchByPropertyNumber(propertyNumber: string, exactMatch: boolean = false): Promise<any[]> {
  let query = this.supabase
    .from('property_listings')
    .select('*');
  
  if (exactMatch) {
    query = query.eq('property_number', sanitizedNumber);
  } else {
    // 物件番号またはメールアドレスで部分一致検索
    query = query.or(
      `property_number.ilike.%${sanitizedNumber}%,seller_email.ilike.%${sanitizedNumber}%`
    );
  }
  
  query = query.order('created_at', { ascending: false });
  
  const { data, error } = await query;
  return data || [];
}
```

#### 変更点

- `exactMatch === false` の場合、`.or()` 条件に `seller_email.ilike.%${sanitizedNumber}%` を追加
- ILIKE検索で大文字小文字を区別しない部分一致検索
- 買主リストの実装（コミット: 4ce5983e）と同じアプローチ

### 検索条件

#### 売主リスト

- **検索対象フィールド**: `seller_number`, `name`, `address`, `phone_number`, `email`
- **検索方法**: 全件取得→復号化→部分一致検索（大文字小文字を区別しない）
- **検索結果の上限**: 100件（既存の制限を維持）

#### 物件リスト

- **検索対象フィールド**: `property_number`, `seller_email`
- **検索方法**: ILIKE検索（大文字小文字を区別しない部分一致検索）
- **検索結果の上限**: なし（既存の動作を維持）

## Data Models

### sellers テーブル

| カラム名 | 型 | 説明 | 暗号化 |
|---------|-----|------|--------|
| seller_number | TEXT | 売主番号（主キー） | ❌ |
| name | TEXT | 名前 | ✅ |
| address | TEXT | 住所 | ✅ |
| phone_number | TEXT | 電話番号 | ✅ |
| email | TEXT | メールアドレス | ✅ |

### property_listings テーブル

| カラム名 | 型 | 説明 | 暗号化 |
|---------|-----|------|--------|
| property_number | TEXT | 物件番号（主キー） | ❌ |
| seller_email | TEXT | 売主のメールアドレス | ❌ |
| address | TEXT | 物件住所 | ❌ |

## Error Handling

### エラーケース

1. **Supabaseクエリエラー**
   - 既存のエラーハンドリングをそのまま使用
   - `throw new Error(\`Failed to search sellers: \${error.message}\`)`
   - `throw new Error(\`Failed to search properties by number: \${error.message}\`)`

2. **復号化エラー（売主リストのみ）**
   - 既存のエラーハンドリングをそのまま使用
   - 復号化に失敗した売主はスキップして続行

3. **空の検索結果**
   - 空配列 `[]` を返す（既存の動作を維持）

### エラーログ

- エラーが発生した場合、既存のエラーハンドリングでログが出力される
- フロントエンドでエラーメッセージが表示される

## Testing Strategy

### Unit Tests

#### 売主リスト

1. **メールアドレス検索のテスト**
   - 完全なメールアドレスで検索
   - メールアドレスの一部（ドメイン名など）で検索
   - 大文字小文字を区別しない検索

2. **既存機能の回帰テスト**
   - 売主番号検索が正常に動作することを確認
   - 名前検索が正常に動作することを確認
   - 住所検索が正常に動作することを確認
   - 電話番号検索が正常に動作することを確認

3. **パフォーマンステスト**
   - 検索クエリの実行時間が既存の検索と同等であることを確認

#### 物件リスト

1. **メールアドレス検索のテスト**
   - 完全なメールアドレスで検索
   - メールアドレスの一部（ドメイン名など）で検索
   - 大文字小文字を区別しない検索

2. **既存機能の回帰テスト**
   - 物件番号検索が正常に動作することを確認

3. **パフォーマンステスト**
   - 検索クエリの実行時間が500ms以内であることを確認

### Integration Tests

1. **フロントエンドからの検索テスト**
   - 売主リストの検索バーにメールアドレスを入力
   - 物件リストの検索バーにメールアドレスを入力
   - 検索結果が正しく表示されることを確認

2. **エッジケース**
   - 空文字列での検索
   - 特殊文字を含むメールアドレスでの検索
   - 存在しないメールアドレスでの検索

### Test Data

```typescript
// テスト用売主データ
const testSellers = [
  {
    seller_number: 'AA12345',
    name: encrypt('山田太郎'),
    address: encrypt('東京都渋谷区〇〇1-2-3'),
    phone_number: encrypt('090-1234-5678'),
    email: encrypt('yamada@example.com'),
  },
  {
    seller_number: 'BB12346',
    name: encrypt('佐藤花子'),
    address: encrypt('東京都新宿区〇〇4-5-6'),
    phone_number: encrypt('080-9876-5432'),
    email: encrypt('sato@test.co.jp'),
  },
];

// テスト用物件データ
const testProperties = [
  {
    property_number: 'AA12345',
    seller_email: 'yamada@example.com',
    address: '東京都渋谷区〇〇1-2-3',
  },
  {
    property_number: 'BB12346',
    seller_email: 'sato@test.co.jp',
    address: '東京都新宿区〇〇4-5-6',
  },
];

// テストケース（売主リスト）
describe('SellerService.searchSellers with email', () => {
  it('should search by full email address', async () => {
    const results = await sellerService.searchSellers('yamada@example.com');
    expect(results).toHaveLength(1);
    expect(results[0].email).toBe('yamada@example.com');
  });

  it('should search by partial email (domain)', async () => {
    const results = await sellerService.searchSellers('example.com');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].email).toContain('example.com');
  });

  it('should be case-insensitive', async () => {
    const results = await sellerService.searchSellers('YAMADA@EXAMPLE.COM');
    expect(results).toHaveLength(1);
    expect(results[0].email).toBe('yamada@example.com');
  });

  it('should not affect existing search functionality', async () => {
    // 売主番号検索
    const byNumber = await sellerService.searchSellers('AA12345');
    expect(byNumber).toHaveLength(1);
    
    // 名前検索
    const byName = await sellerService.searchSellers('山田');
    expect(byName).toHaveLength(1);
    
    // 住所検索
    const byAddress = await sellerService.searchSellers('渋谷区');
    expect(byAddress).toHaveLength(1);
    
    // 電話番号検索
    const byPhone = await sellerService.searchSellers('090-1234');
    expect(byPhone).toHaveLength(1);
  });
});

// テストケース（物件リスト）
describe('PropertyListingService.searchByPropertyNumber with email', () => {
  it('should search by full email address', async () => {
    const results = await propertyListingService.searchByPropertyNumber('yamada@example.com');
    expect(results).toHaveLength(1);
    expect(results[0].seller_email).toBe('yamada@example.com');
  });

  it('should search by partial email (domain)', async () => {
    const results = await propertyListingService.searchByPropertyNumber('example.com');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].seller_email).toContain('example.com');
  });

  it('should be case-insensitive', async () => {
    const results = await propertyListingService.searchByPropertyNumber('YAMADA@EXAMPLE.COM');
    expect(results).toHaveLength(1);
    expect(results[0].seller_email).toBe('yamada@example.com');
  });

  it('should not affect existing search functionality', async () => {
    // 物件番号検索
    const byNumber = await propertyListingService.searchByPropertyNumber('AA12345');
    expect(byNumber).toHaveLength(1);
  });
});
```

## Performance Considerations

### 売主リスト

#### 検索パフォーマンス

- **暗号化フィールド検索**: 全件取得→復号化→フィルタリングが必要
- **既存の制限**: 最大100件に制限（既存の実装を維持）
- **パフォーマンス目標**: 既存の検索と同等（全件取得・復号化は既に実行されているため、追加のオーバーヘッドは最小限）

#### パフォーマンス最適化（将来的な改善案）

1. **インデックスの追加**（効果なし）
   - 暗号化フィールドにはインデックスが効かない
   - 全件取得が必要

2. **キャッシュの導入**
   - 復号化結果をキャッシュ
   - 検索速度を向上

### 物件リスト

#### 検索パフォーマンス

- **ILIKE検索**: PostgreSQLの`ILIKE`演算子を使用（大文字小文字を区別しない部分一致検索）
- **インデックス**: `seller_email`カラムにインデックスが存在する場合、検索パフォーマンスが向上
- **パフォーマンス目標**: **500ms以内**

#### パフォーマンス最適化（将来的な改善案）

1. **インデックスの追加**
   - `property_listings`テーブルの`seller_email`カラムにインデックスを追加
   - `CREATE INDEX idx_property_listings_seller_email ON property_listings USING gin (seller_email gin_trgm_ops);`

2. **全文検索の導入**
   - PostgreSQLの全文検索機能を使用
   - より高速な検索を実現

## Security Considerations

### SQLインジェクション対策

- Supabaseクライアントを使用しているため、SQLインジェクションのリスクは低い
- クエリパラメータは自動的にエスケープされる

### 個人情報保護

- メールアドレスは個人情報のため、検索結果の表示には注意が必要
- 売主リスト: メールアドレスは暗号化されている（`sellers.email`）
- 物件リスト: メールアドレスは平文で保存されている（`property_listings.seller_email`）

### 暗号化キー保護

- `ENCRYPTION_KEY`は絶対に変更しない（encryption-key-protection.mdを参照）
- 変更すると全ての暗号化データが復号できなくなる

## Deployment

### デプロイ手順

1. **コードの変更**
   - `backend/src/services/SellerService.supabase.ts` を修正
   - `backend/src/services/PropertyListingService.ts` を修正
   - Gitにコミット・プッシュ

2. **Vercelデプロイ**
   - Vercelが自動的にデプロイを開始
   - デプロイ完了を確認

3. **動作確認**
   - 本番環境の売主リスト画面でメールアドレス検索をテスト
   - 本番環境の物件リスト画面でメールアドレス検索をテスト
   - 既存の検索機能が正常に動作することを確認

### ロールバック手順

1. Vercelのダッシュボードから前のデプロイメントに戻す
2. または、Gitで前のコミットに戻してプッシュ

## Monitoring and Logging

### ログ出力

- 既存のログ出力をそのまま使用
- エラーが発生した場合、`console.error()`でログが出力される

### モニタリング

- Vercelのログでエラーを監視
- 検索クエリの実行時間を監視（必要に応じて）

## Future Enhancements

### 将来的な改善案

1. **検索精度の向上**
   - メールアドレスの完全一致を優先的に表示
   - 検索結果のランキング機能

2. **検索履歴の保存**
   - ユーザーの検索履歴を保存
   - よく検索されるメールアドレスを提案

3. **オートコンプリート機能**
   - メールアドレスの入力中に候補を表示
   - ユーザーの入力を補助

4. **検索フィルターの追加**
   - メールアドレスのみで検索するフィルター
   - 検索対象フィールドを選択できる機能

5. **売主リストのパフォーマンス改善**
   - 復号化結果のキャッシュ
   - 検索速度の向上

---

**最終更新日**: 2026年4月9日  
**作成者**: Kiro AI Assistant  
**レビュー状態**: 未レビュー
