# フロントエンド・バックエンドデバッグチェックリスト（絶対に守るべきルール）

## ⚠️ 重要：UIに表示されない問題の必須確認手順

**症状**: データベースには保存されているが、ブラウザのUIに表示されない

**必須手順（この順番で実行）**:

### ステップ1: フロントエンドが使用しているAPIエンドポイントを特定

```bash
# フロントエンドのコードでAPIエンドポイントを検索
grepSearch "fetch.*sellers" --includePattern="frontend/**/*.tsx"
grepSearch "axios.*sellers" --includePattern="frontend/**/*.tsx"
grepSearch "useQuery.*sellers" --includePattern="frontend/**/*.tsx"
```

**確認ポイント**:
- どのエンドポイントを呼び出しているか？（例: `/api/sellers/by-number`, `/api/sellers/:id`）
- どのフィールドを使用しているか？（例: `seller.visitDate`）

---

### ステップ2: 本番環境のAPIレスポンスを確認

**方法1: ブラウザのDevTools（最優先）**

1. 本番環境でページを開く
2. DevToolsを開く（F12）
3. Networkタブを選択
4. ページをリロード
5. APIリクエストを探す（例: `by-number?sellerNumber=AA13729`）
6. レスポンスタブをクリック
7. **問題のフィールドが含まれているか確認**（例: `visitDate`）

**方法2: curlコマンド（認証が必要な場合は使えない）**

```bash
curl https://your-backend.vercel.app/api/sellers/by-number/AA13729
```

---

### ステップ3: エンドポイントの実装を確認

```bash
# エンドポイントの実装を検索
grepSearch "router.get.*by-number" --includePattern="backend/src/routes/*.ts"
```

**確認ポイント**:
- `res.json({ ... })`で返しているフィールドに、問題のフィールドが含まれているか？
- 例: `visitDate: seller.visitDate` が含まれているか？

---

### ステップ4: ローカル環境でテスト

```bash
# ローカルでエンドポイントをテスト
npx ts-node backend/test-endpoint.ts
```

**テストスクリプト例**:
```typescript
import { SellerService } from './src/services/SellerService.supabase';

const sellerService = new SellerService();
const seller = await sellerService.getSeller('AA13729');
console.log('visitDate:', seller.visitDate);
```

---

## 📋 チェックリスト（必ず全て確認）

UIに表示されない問題が発生したら、以下を**この順番で**確認：

- [ ] **ステップ1**: フロントエンドが使用しているAPIエンドポイントを特定した
- [ ] **ステップ2**: 本番環境のAPIレスポンスを確認した（DevTools）
- [ ] **ステップ3**: エンドポイントの実装で`res.json({ ... })`に問題のフィールドが含まれているか確認した
- [ ] **ステップ4**: ローカル環境でテストした

---

## 🚨 よくある間違い

### ❌ 間違い1: データベースだけを確認して終わる

```bash
# ❌ これだけでは不十分
SELECT visit_date FROM sellers WHERE seller_number = 'AA13729';
# → データベースには保存されているが、APIレスポンスに含まれていない可能性
```

### ❌ 間違い2: ローカル環境だけをテストする

```bash
# ❌ ローカルでは動作するが、本番では動作しない可能性
npx ts-node backend/test-seller-service.ts
# → 本番環境のAPIレスポンスを必ず確認する
```

### ❌ 間違い3: `getSeller()`メソッドだけをテストする

```typescript
// ❌ getSeller()は正しく動作するが、エンドポイントのレスポンスに含まれていない可能性
const seller = await sellerService.getSeller('AA13729');
console.log('visitDate:', seller.visitDate); // ✅ 正しく表示される

// しかし、エンドポイントのres.json()に含まれていない
res.json({
  id: seller.id,
  name: seller.name,
  // visitDate: seller.visitDate, // ← これが欠落している
});
```

---

## ✅ 正しいデバッグフロー

### 例: AA13729の訪問日時が表示されない問題

**ステップ1: フロントエンドのコードを確認**

```bash
grepSearch "fetch.*sellers" --includePattern="frontend/**/*.tsx"
```

**結果**: `CallModePage.tsx`が`/api/sellers/by-number?sellerNumber=AA13729`を使用している

---

**ステップ2: 本番環境のAPIレスポンスを確認**

DevToolsで確認：
```json
{
  "id": "3fa6793f-e029-4e3c-bbf4-d5afccba5504",
  "sellerNumber": "AA13729",
  "name": "北山 壽人",
  "propertyAddress": "大分市岩田町1-12-1三和コーポ 501",
  "address": "埼玉県蕨市南町1-33-32-606",
  "phoneNumber": "09041258945",
  "email": "jujin@yahoo.co.jp"
  // ❌ visitDate が含まれていない
}
```

**問題発見**: APIレスポンスに`visitDate`が含まれていない

---

**ステップ3: エンドポイントの実装を確認**

```bash
grepSearch "router.get.*by-number" --includePattern="backend/src/routes/*.ts"
```

**結果**: `backend/src/routes/sellers.ts`の459行目

```typescript
res.json({
  id: seller.id,
  sellerNumber: seller.sellerNumber,
  name: seller.name,
  propertyAddress: seller.propertyAddress,
  address: seller.address,
  phoneNumber: seller.phoneNumber,
  email: seller.email,
  // ❌ visitDate: seller.visitDate, が欠落している
});
```

**問題発見**: `res.json()`に`visitDate`が含まれていない

---

**ステップ4: 修正**

```typescript
res.json({
  id: seller.id,
  sellerNumber: seller.sellerNumber,
  name: seller.name,
  propertyAddress: seller.propertyAddress,
  address: seller.address,
  phoneNumber: seller.phoneNumber,
  email: seller.email,
  visitDate: seller.visitDate, // ✅ 追加
  visitAssignee: seller.visitAssignee, // ✅ 追加
});
```

---

## 🎯 まとめ

**UIに表示されない問題の必須確認手順**:

1. **フロントエンドが使用しているAPIエンドポイントを特定**
2. **本番環境のAPIレスポンスを確認**（DevTools）
3. **エンドポイントの実装で`res.json({ ... })`を確認**
4. **ローカル環境でテスト**

**この順番で確認することで、問題を早期に発見できます。**

---

**最終更新日**: 2026年4月3日  
**作成理由**: AA13729の訪問日時表示問題で、本番環境のAPIレスポンス確認が最後になってしまったため  
**教訓**: データベースやローカル環境だけでなく、本番環境のAPIレスポンスを最初に確認する
