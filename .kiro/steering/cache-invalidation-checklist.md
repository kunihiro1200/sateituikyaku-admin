---
inclusion: manual
---

# キャッシュ無効化チェックリスト（絶対に守るべきルール）

## ⚠️ 重要：データ保存後にUIが更新されない場合

**症状**: データベースには保存されているが、ブラウザのUIに反映されない

**最も可能性が高い原因**: **キャッシュが無効化されていない**

---

## 🚨 キャッシュ無効化が必要なケース

### ケース1: 別のサービスがデータを更新した場合

**例**: `PropertyService`が`properties`テーブルを更新したが、`SellerService`のキャッシュが古いまま

**問題**:
- `PropertyService.updateProperty()`がDBを更新
- `SellerService.getSeller()`が古いキャッシュを返す
- UIに古いデータが表示される

**解決策**: 更新したサービスから、関連するサービスのキャッシュを無効化する

```typescript
// PropertyService.updateProperty()
if (data.seller_id) {
  // SellerServiceのキャッシュを無効化
  const { invalidateSellerCache, invalidateListSellersCache } = await import('./SellerService.supabase');
  invalidateSellerCache(data.seller_id);
  invalidateListSellersCache();
}
```

---

### ケース2: 複数のテーブルを更新した場合

**例**: `sellers`テーブルと`properties`テーブルの両方を更新

**問題**:
- 片方のキャッシュしか無効化していない
- もう片方のキャッシュが古いまま

**解決策**: 更新した全てのテーブルに関連するキャッシュを無効化する

```typescript
// sellersテーブルを更新
await supabase.from('sellers').update(sellerData).eq('id', sellerId);

// propertiesテーブルも更新
await supabase.from('properties').update(propertyData).eq('seller_id', sellerId);

// 両方のキャッシュを無効化
invalidateSellerCache(sellerId);
invalidatePropertyCache(sellerId);
invalidateListSellersCache();
```

---

### ケース3: リレーションシップがあるデータを更新した場合

**例**: `properties`テーブルを更新したが、`sellers`テーブルに`property`オブジェクトが含まれている

**問題**:
- `SellerService.getSeller()`が返す`seller.property`が古いまま
- `PropertyService`のキャッシュは無効化したが、`SellerService`のキャッシュは無効化していない

**解決策**: リレーションシップの親側のキャッシュも無効化する

```typescript
// PropertyService.updateProperty()
if (data.seller_id) {
  // 親（Seller）のキャッシュも無効化
  const { invalidateSellerCache } = await import('./SellerService.supabase');
  invalidateSellerCache(data.seller_id);
}
```

---

## 📋 キャッシュ無効化チェックリスト

データ保存処理を実装する際、以下を必ず確認してください：

### ステップ1: どのテーブルを更新するか確認

- [ ] 更新するテーブルをリストアップ
- [ ] リレーションシップがあるテーブルもリストアップ

### ステップ2: どのサービスがキャッシュを持っているか確認

- [ ] 更新するテーブルに対応するサービスを確認
- [ ] リレーションシップの親テーブルに対応するサービスも確認

### ステップ3: キャッシュの種類を確認

各サービスには複数のキャッシュが存在する可能性があります：

- [ ] **インメモリキャッシュ**（例: `_sellerCache`、30秒TTL）
- [ ] **Redisキャッシュ**（例: `CacheHelper.del()`）
- [ ] **リストキャッシュ**（例: `_listSellersCache`、5分TTL）
- [ ] **個別キャッシュ**（例: `propertyBySellerCache`、60秒TTL）

### ステップ4: キャッシュ無効化を実装

- [ ] 更新したテーブルに対応するキャッシュを無効化
- [ ] リレーションシップの親テーブルのキャッシュも無効化
- [ ] リストキャッシュも無効化（一覧ページがある場合）

### ステップ5: テストで確認

- [ ] ブラウザでデータを保存
- [ ] UIが即座に更新されることを確認（ページリロード不要）
- [ ] DevToolsでAPIレスポンスを確認（新しいデータが返ってくることを確認）

---

## 🎯 実例：PropertyService.updateProperty()

### 問題

`PropertyService.updateProperty()`が`properties`テーブルを更新したが、`SellerService.getSeller()`が古いキャッシュを返していた。

### 原因

`PropertyService`は自分のキャッシュ（Redis）は無効化していたが、`SellerService`のインメモリキャッシュ（30秒TTL）は無効化していなかった。

### 解決策

```typescript
// PropertyService.updateProperty()
if (data.seller_id) {
  // Redisキャッシュを無効化
  await CacheHelper.del(`seller:${data.seller_id}`);
  await CacheHelper.delPattern('sellers:list*');
  
  // 🚨 重要：SellerServiceのインメモリキャッシュも無効化
  const { invalidateSellerCache, invalidateListSellersCache } = await import('./SellerService.supabase');
  invalidateSellerCache(data.seller_id);
  invalidateListSellersCache();
  
  // PropertyBySellerキャッシュも無効化
  this.invalidatePropertyBySellerCache(data.seller_id);
}
```

### 結果

- ✅ DB保存後、UIが即座に更新される
- ✅ ページリロード不要
- ✅ APIレスポンスに新しいデータが含まれる

---

## 🔍 デバッグ方法

### 症状：UIが更新されない

**確認手順**:

1. **ブラウザのDevToolsを開く**
2. **Networkタブを確認**
   - APIリクエストが送信されているか？
   - APIレスポンスに新しいデータが含まれているか？
3. **Consoleタブを確認**
   - キャッシュヒットのログが出ているか？
   - 例: `[PERF] getSeller cache hit (in-memory): 5ms`

### APIレスポンスに新しいデータが含まれていない場合

**原因**: キャッシュが無効化されていない

**解決策**:
1. 更新処理を実装したサービスを確認
2. キャッシュ無効化のコードが含まれているか確認
3. 関連するサービスのキャッシュも無効化しているか確認

### APIレスポンスに新しいデータが含まれている場合

**原因**: フロントエンドのステート管理の問題

**解決策**:
1. フロントエンドのコードを確認
2. APIレスポンスを受け取った後、ステートを更新しているか確認

---

## 💡 ベストプラクティス

### 1. キャッシュ無効化関数をエクスポートする

```typescript
// SellerService.supabase.ts
export function invalidateSellerCache(sellerId: string): void {
  _sellerCache.delete(sellerId);
}

export function invalidateListSellersCache(): void {
  _listSellersCache.clear();
}
```

**理由**: 他のサービスから簡単にキャッシュを無効化できる

---

### 2. 更新処理の最後にキャッシュを無効化する

```typescript
async updateProperty(propertyId: string, updates: any) {
  // 1. DBを更新
  const { data } = await supabase.from('properties').update(updates).eq('id', propertyId);
  
  // 2. キャッシュを無効化（最後に実行）
  if (data.seller_id) {
    await this.invalidateAllCaches(data.seller_id);
  }
  
  return data;
}
```

**理由**: DB更新が成功した後にキャッシュを無効化することで、整合性を保つ

---

### 3. 関連するキャッシュを全て無効化する

```typescript
private async invalidateAllCaches(sellerId: string) {
  // Redisキャッシュ
  await CacheHelper.del(`seller:${sellerId}`);
  await CacheHelper.delPattern('sellers:list*');
  
  // インメモリキャッシュ
  const { invalidateSellerCache, invalidateListSellersCache } = await import('./SellerService.supabase');
  invalidateSellerCache(sellerId);
  invalidateListSellersCache();
  
  // 個別キャッシュ
  this.invalidatePropertyBySellerCache(sellerId);
}
```

**理由**: 漏れがないように、関連するキャッシュを全て無効化する

---

## 🚨 よくある間違い

### ❌ 間違い1: Redisキャッシュだけを無効化

```typescript
// ❌ 間違い（インメモリキャッシュが残る）
await CacheHelper.del(`seller:${sellerId}`);
```

**問題**: インメモリキャッシュ（30秒TTL）が残っているため、30秒間は古いデータが返される

**正解**: インメモリキャッシュも無効化する

```typescript
// ✅ 正しい
await CacheHelper.del(`seller:${sellerId}`);
invalidateSellerCache(sellerId);
```

---

### ❌ 間違い2: 個別キャッシュだけを無効化

```typescript
// ❌ 間違い（リストキャッシュが残る）
invalidateSellerCache(sellerId);
```

**問題**: リストキャッシュ（5分TTL）が残っているため、一覧ページで古いデータが表示される

**正解**: リストキャッシュも無効化する

```typescript
// ✅ 正しい
invalidateSellerCache(sellerId);
invalidateListSellersCache();
```

---

### ❌ 間違い3: 関連サービスのキャッシュを無効化していない

```typescript
// ❌ 間違い（SellerServiceのキャッシュが残る）
// PropertyService.updateProperty()
await CacheHelper.del(`property:${propertyId}`);
```

**問題**: `SellerService.getSeller()`が返す`seller.property`が古いまま

**正解**: 関連サービスのキャッシュも無効化する

```typescript
// ✅ 正しい
await CacheHelper.del(`property:${propertyId}`);
const { invalidateSellerCache } = await import('./SellerService.supabase');
invalidateSellerCache(sellerId);
```

---

## 📚 関連ドキュメント

- `backend/src/services/SellerService.supabase.ts` - インメモリキャッシュの実装
- `backend/src/services/PropertyService.ts` - キャッシュ無効化の実装例
- `backend/src/utils/cache.ts` - Redisキャッシュヘルパー

---

## まとめ

**データ保存後にUIが更新されない場合、最初に確認すべきこと**:

1. ✅ **キャッシュが無効化されているか？**
2. ✅ **関連サービスのキャッシュも無効化されているか？**
3. ✅ **リストキャッシュも無効化されているか？**

**このチェックリストを徹底することで、キャッシュ関連の問題を完全に防止できます。**

---

**最終更新日**: 2026年4月1日  
**作成理由**: PropertyService.updateProperty()でキャッシュ無効化が漏れていたため、UIが更新されなかった問題の再発防止  
**関連Issue**: 土地面積（当社調べ）保存エラー修正（AA13886）
