# Design Document: 買主リスト検索バーにメールアドレス検索機能を追加

## Overview

買主リスト一覧画面（`BuyersPage.tsx`）の検索バーに、メールアドレスでの検索機能を追加します。現在、検索バーでは買主番号、名前、電話番号、物件番号での検索が可能ですが、メールアドレスでの検索はできません。

この機能により、ユーザーはメールアドレス（または一部）を入力して買主を素早く検索できるようになります。

### 目的

- メールアドレスから買主情報を素早く検索できるようにする
- 既存の検索機能（買主番号、名前、電話番号、物件番号）に影響を与えない
- 検索パフォーマンスを維持する（500ms以内）

## Architecture

### システム構成

```
[フロントエンド: BuyersPage.tsx]
         ↓ 検索クエリ送信
[バックエンド: /api/buyers/search]
         ↓
[BuyerService.search()]
         ↓
[Supabase: buyers テーブル]
```

### 変更対象ファイル

1. **バックエンド**
   - `backend/src/services/BuyerService.ts` - `search()` メソッドにメールアドレス検索を追加

2. **フロントエンド**
   - 変更不要（既存の検索バーがそのまま使用可能）

## Components and Interfaces

### BuyerService.search() メソッド

**現在の実装**:
```typescript
async search(query: string, limit: number = 20): Promise<any[]> {
  const isNumericOnly = /^\d+$/.test(query);
  const selectFields = 'buyer_number, name, phone_number, email, property_number, latest_status, initial_assignee';

  if (isNumericOnly) {
    // 数字のみ: buyer_number の完全一致 + 他フィールドの部分一致
    const [exactMatch, partialMatch] = await Promise.all([
      this.supabase
        .from('buyers')
        .select(selectFields)
        .eq('buyer_number', query)
        .limit(limit),
      this.supabase
        .from('buyers')
        .select(selectFields)
        .or(`name.ilike.%${query}%,phone_number.ilike.%${query}%,property_number.ilike.%${query}%`)
        .limit(limit),
    ]);
    // 重複を除いて結合
    // ...
  } else {
    // 文字列を含む: 全フィールドで ilike 検索
    const { data, error } = await this.supabase
      .from('buyers')
      .select(selectFields)
      .or(
        `buyer_number.ilike.%${query}%,name.ilike.%${query}%,phone_number.ilike.%${query}%,property_number.ilike.%${query}%`
      )
      .limit(limit);
    // ...
  }
}
```

**変更後の実装**:
```typescript
async search(query: string, limit: number = 20): Promise<any[]> {
  const isNumericOnly = /^\d+$/.test(query);
  const selectFields = 'buyer_number, name, phone_number, email, property_number, latest_status, initial_assignee';

  if (isNumericOnly) {
    // 数字のみ: buyer_number の完全一致 + 他フィールドの部分一致
    const [exactMatch, partialMatch] = await Promise.all([
      this.supabase
        .from('buyers')
        .select(selectFields)
        .eq('buyer_number', query)
        .limit(limit),
      this.supabase
        .from('buyers')
        .select(selectFields)
        .or(`name.ilike.%${query}%,phone_number.ilike.%${query}%,email.ilike.%${query}%,property_number.ilike.%${query}%`)  // ← email を追加
        .limit(limit),
    ]);
    // 重複を除いて結合
    // ...
  } else {
    // 文字列を含む: 全フィールドで ilike 検索
    const { data, error } = await this.supabase
      .from('buyers')
      .select(selectFields)
      .or(
        `buyer_number.ilike.%${query}%,name.ilike.%${query}%,phone_number.ilike.%${query}%,email.ilike.%${query}%,property_number.ilike.%${query}%`  // ← email を追加
      )
      .limit(limit);
    // ...
  }
}
```

### 変更点

1. **数字のみのクエリ（`isNumericOnly === true`）の場合**
   - `partialMatch` クエリの `.or()` 条件に `email.ilike.%${query}%` を追加

2. **文字列を含むクエリ（`isNumericOnly === false`）の場合**
   - `.or()` 条件に `email.ilike.%${query}%` を追加

### 検索条件

- **ILIKE検索**: 大文字小文字を区別しない部分一致検索
- **検索対象フィールド**: `buyer_number`, `name`, `phone_number`, `email`, `property_number`
- **検索結果の上限**: 20件（デフォルト）

## Data Models

### buyers テーブル

| カラム名 | 型 | 説明 |
|---------|-----|------|
| buyer_number | TEXT | 買主番号（主キー） |
| name | TEXT | 名前 |
| phone_number | TEXT | 電話番号 |
| email | TEXT | メールアドレス |
| property_number | TEXT | 物件番号 |
| latest_status | TEXT | 最新状況 |
| initial_assignee | TEXT | 初期担当者 |

## Error Handling

### エラーケース

1. **Supabaseクエリエラー**
   - 既存のエラーハンドリングをそのまま使用
   - `throw new Error(\`Failed to search buyers: \${error.message}\`)`

2. **空の検索結果**
   - 空配列 `[]` を返す（既存の動作を維持）

### エラーログ

- エラーが発生した場合、既存のエラーハンドリングでログが出力される
- フロントエンドでエラーメッセージが表示される

## Testing Strategy

### Unit Tests

1. **メールアドレス検索のテスト**
   - 完全なメールアドレスで検索
   - メールアドレスの一部（ドメイン名など）で検索
   - 大文字小文字を区別しない検索

2. **既存機能の回帰テスト**
   - 買主番号検索が正常に動作することを確認
   - 名前検索が正常に動作することを確認
   - 電話番号検索が正常に動作することを確認
   - 物件番号検索が正常に動作することを確認

3. **パフォーマンステスト**
   - 検索クエリの実行時間が500ms以内であることを確認

### Integration Tests

1. **フロントエンドからの検索テスト**
   - BuyersPageの検索バーにメールアドレスを入力
   - 検索結果が正しく表示されることを確認

2. **エッジケース**
   - 空文字列での検索
   - 特殊文字を含むメールアドレスでの検索
   - 存在しないメールアドレスでの検索

### Test Data

```typescript
// テスト用買主データ
const testBuyers = [
  {
    buyer_number: '12345',
    name: '山田太郎',
    phone_number: '090-1234-5678',
    email: 'yamada@example.com',
    property_number: 'AA1234',
  },
  {
    buyer_number: '12346',
    name: '佐藤花子',
    phone_number: '080-9876-5432',
    email: 'sato@test.co.jp',
    property_number: 'BB5678',
  },
];

// テストケース
describe('BuyerService.search with email', () => {
  it('should search by full email address', async () => {
    const results = await buyerService.search('yamada@example.com');
    expect(results).toHaveLength(1);
    expect(results[0].email).toBe('yamada@example.com');
  });

  it('should search by partial email (domain)', async () => {
    const results = await buyerService.search('example.com');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].email).toContain('example.com');
  });

  it('should be case-insensitive', async () => {
    const results = await buyerService.search('YAMADA@EXAMPLE.COM');
    expect(results).toHaveLength(1);
    expect(results[0].email).toBe('yamada@example.com');
  });

  it('should not affect existing search functionality', async () => {
    // 買主番号検索
    const byNumber = await buyerService.search('12345');
    expect(byNumber).toHaveLength(1);
    
    // 名前検索
    const byName = await buyerService.search('山田');
    expect(byName).toHaveLength(1);
    
    // 電話番号検索
    const byPhone = await buyerService.search('090-1234');
    expect(byPhone).toHaveLength(1);
  });
});
```

## Implementation Plan

### Phase 1: バックエンド実装

1. `backend/src/services/BuyerService.ts` の `search()` メソッドを修正
   - `isNumericOnly === true` の場合の `.or()` 条件に `email.ilike.%${query}%` を追加
   - `isNumericOnly === false` の場合の `.or()` 条件に `email.ilike.%${query}%` を追加

2. ローカル環境でテスト
   - Postmanまたはcurlで `/api/buyers/search?q=test@example.com` をテスト
   - 検索結果が正しく返されることを確認

### Phase 2: テスト

1. Unit Testsを実装
   - メールアドレス検索のテストケースを追加
   - 既存機能の回帰テストを実行

2. Integration Testsを実行
   - フロントエンドの検索バーでメールアドレスを入力
   - 検索結果が正しく表示されることを確認

### Phase 3: デプロイ

1. Vercelにデプロイ
   - `backend` プロジェクトをデプロイ
   - デプロイ後、本番環境でテスト

2. 動作確認
   - 本番環境の買主リスト画面でメールアドレス検索をテスト
   - 既存の検索機能が正常に動作することを確認

## Performance Considerations

### 検索パフォーマンス

- **ILIKE検索**: PostgreSQLの`ILIKE`演算子を使用（大文字小文字を区別しない部分一致検索）
- **インデックス**: `email`カラムにインデックスが存在する場合、検索パフォーマンスが向上
- **検索結果の上限**: 20件（デフォルト）でパフォーマンスを維持

### パフォーマンス目標

- 検索クエリの実行時間: **500ms以内**
- 既存の検索機能と同等のパフォーマンス

### パフォーマンス最適化（将来的な改善案）

1. **インデックスの追加**
   - `buyers`テーブルの`email`カラムにインデックスを追加
   - `CREATE INDEX idx_buyers_email ON buyers USING gin (email gin_trgm_ops);`

2. **全文検索の導入**
   - PostgreSQLの全文検索機能を使用
   - より高速な検索を実現

## Security Considerations

### SQLインジェクション対策

- Supabaseクライアントを使用しているため、SQLインジェクションのリスクは低い
- クエリパラメータは自動的にエスケープされる

### 個人情報保護

- メールアドレスは個人情報のため、検索結果の表示には注意が必要
- 既存の実装では、検索結果にメールアドレスが含まれている（`selectFields`に`email`が含まれている）

## Deployment

### デプロイ手順

1. **コードの変更**
   - `backend/src/services/BuyerService.ts` を修正
   - Gitにコミット・プッシュ

2. **Vercelデプロイ**
   - Vercelが自動的にデプロイを開始
   - デプロイ完了を確認

3. **動作確認**
   - 本番環境の買主リスト画面でメールアドレス検索をテスト
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

---

**最終更新日**: 2026年4月9日  
**作成者**: Kiro AI Assistant  
**レビュー状態**: 未レビュー
