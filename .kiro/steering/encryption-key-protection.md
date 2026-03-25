# ENCRYPTION_KEY 保護ルール（絶対に守るべきルール）

## ⚠️ 最重要：ENCRYPTION_KEYは絶対に変更しない

**ENCRYPTION_KEYを変更すると、データベースに保存されている全ての暗号化データが復号できなくなります。**

---

## 🚨 絶対に禁止

- ❌ **ENCRYPTION_KEYの文字を追加・削除・変更してはいけない**
- ❌ **「32文字にするため」などの理由でキーを変更してはいけない**
- ❌ **ユーザーにENRYPTION_KEYの変更を指示してはいけない**

---

## 📋 仕様

**ファイル**: `backend/src/utils/encryption.ts`

**アルゴリズム**: AES-256-GCM

**キー長**: 正確に **32文字**（UTF-8）

```typescript
const KEY_LENGTH = 32;

if (key.length !== KEY_LENGTH) {
  throw new Error(`ENCRYPTION_KEY must be exactly ${KEY_LENGTH} characters`);
}
```

**暗号化対象フィールド**（売主テーブル）:
- `name`（名前）
- `phone_number`（電話番号）
- `email`（メールアドレス）

---

## 🔴 過去の失敗事例（2026年2月）

**何が起きたか**:
- KIROがユーザーに「ENCRYPTION_KEYのUを削除してください」と誤って指示した
- ユーザーが `1rJEtoCusAIMzyR86P6TQr0ND600D/dU` → `1rJEtoCusAIMzyR86P6TQr0ND600D/d` に変更
- 全売主の名前・電話番号・メールが文字化け（暗号化されたBase64文字列がそのまま表示）

**影響**:
- 売主リストの名前が `acLCZeMGRDaf/DM8rFZBircz+...` のような文字列で表示された
- 全データが読めない状態になった

**解決方法**:
- Vercelの環境変数で `ENCRYPTION_KEY` を元の値（`U` を含む32文字）に戻す
- Redeployするだけで復旧（データ自体は壊れていない）

---

## ✅ 正しい対応

ENCRYPTION_KEYに関する問題が発生した場合：

1. **絶対にキーを変更しない**
2. 現在のキーが正しく設定されているか確認する
3. Vercelの環境変数に正確に設定されているか確認する
4. キーの前後に余分なスペースがないか確認する（`.trim()` は実装済み）

---

## まとめ

**ENCRYPTION_KEYは一度設定したら永久に変更しない。**

変更した瞬間に全暗号化データが読めなくなる。

---

**最終更新日**: 2026年2月28日
**作成理由**: KIROが誤ってENRYPTION_KEYの変更を指示し、全売主データが文字化けした事故を防ぐため

---

## 🚨 最重要：暗号化フィールドを別テーブルにコピーする際のルール（2026年3月追加）

### 問題の背景

**日付**: 2026年3月25日

**問題**: AA9926の物件リスト詳細画面で売主名が表示されなかった

**根本原因**: `PropertyListingSyncService.mapSellerToPropertyListing()` が `sellers` テーブルから取得した `name`（暗号化済み）をそのまま `property_listings.seller_name` にコピーした。復号処理を通していなかったため、暗号文がそのまま保存された。

**間違っていたコード**:
```typescript
// ❌ 間違い（nameが暗号化されたまま）
const { data: seller } = await this.supabase
  .from('sellers')
  .select('*')
  .eq('property_number', propertyNumber)
  .single();

return {
  seller_name: seller.name,  // ← 暗号化文字列がそのまま入る
  ...
};
```

**正しいコード**:
```typescript
// ✅ 正しい（SellerServiceで復号してからコピー）
import { decrypt } from '../utils/encryption';

return {
  seller_name: seller.name ? decrypt(seller.name) : null,  // ← 復号してから保存
  ...
};
```

---

### ✅ 絶対に守るべきルール

**`sellers` テーブルの暗号化フィールドを他のテーブルにコピーする際は、必ず復号してから保存すること。**

#### 暗号化対象フィールド（再掲）

| sellersカラム | 説明 | コピー先での扱い |
|-------------|------|----------------|
| `name` | 売主名 | `decrypt(seller.name)` してから保存 |
| `phone_number` | 電話番号 | `decrypt(seller.phone_number)` してから保存 |
| `email` | メールアドレス | `decrypt(seller.email)` してから保存 |

#### 復号の方法

```typescript
import { decrypt } from '../utils/encryption';

// ✅ 正しい復号方法
const sellerName = seller.name ? decrypt(seller.name) : null;
const sellerPhone = seller.phone_number ? decrypt(seller.phone_number) : null;
const sellerEmail = seller.email ? decrypt(seller.email) : null;
```

または `SellerService.decryptSeller()` を使う：

```typescript
import { SellerService } from './SellerService.supabase';

const sellerService = new SellerService();
const decryptedSeller = await sellerService.decryptSeller(rawSeller);
// decryptedSeller.name, decryptedSeller.phoneNumber, decryptedSeller.email は復号済み
```

---

### 📋 チェックリスト

`sellers` テーブルのデータを別テーブルにコピー・同期する処理を実装する前に確認：

- [ ] コピー元のフィールドが暗号化対象（`name`, `phone_number`, `email`）か確認したか？
- [ ] `decrypt()` または `SellerService.decryptSeller()` を通してから保存しているか？
- [ ] 暗号化文字列（`acLCZeMGRDaf/...` のような文字列）がそのまま保存されていないか確認したか？

---

**最終更新日**: 2026年3月25日
**追記理由**: PropertyListingSyncServiceが暗号化された売主名をそのままproperty_listingsにコピーし、AA9926の売主名が表示されなくなった問題の再発防止
