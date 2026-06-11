---
inclusion: manual
---



# 識別子プレフィックスルール（絶対に間違えないルール）

## ⚠️ 重要：売主番号と物件番号のプレフィックス

**売主番号**と**物件番号**には**AAやBBなどのプレフィックスが付きます**。
**買主番号**には**プレフィックスが付かず、数字のみ**です。

---

## ✅ 正しい識別子の形式

### 売主番号

**形式**: `AA` + 数字（例: AA13501）

**例**:
- ✅ AA13501
- ✅ AA13729
- ✅ BB14
- ❌ 13501（プレフィックスなし）

**データベースカラム**: `seller_number`

**スプレッドシート**: 売主リストスプレッドシート

---

### 物件番号

**形式**: `AA` + 数字（例: AA13501）

**例**:
- ✅ AA13501
- ✅ AA13729
- ✅ BB14
- ❌ 13501（プレフィックスなし）

**データベースカラム**: `property_number`

**スプレッドシート**: 物件リストスプレッドシート

---

### 買主番号

**形式**: 数字のみ（例: 7282）または FK + 数字（福岡物件の場合、例: FK1）

**例**:
- ✅ 7282（通常）
- ✅ 1234（通常）
- ✅ FK1（福岡物件）
- ✅ FK2（福岡物件）
- ❌ AA7282（プレフィックス付き）
- ❌ BB7282（プレフィックス付き）

**データベースカラム**: `buyer_number`

**スプレッドシート**: 買主リストスプレッドシート（E列）

**福岡判定ルール**:
- 買主登録時に `property_listings.address` に「福岡」が含まれる場合 → FK○○
- または `other_company_property` に「福岡」が含まれる場合 → FK○○
- 連番管理スプレッドシート（`19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs`）の **J2セル** で管理
- 既存の数字のみの買主番号（旧来の福岡買主含む）はそのまま維持

**注意**: 2026年6月以前の既存買主は数字のみの番号のまま。FK○○は新規登録分から適用。

---

## 🚨 絶対に守るべきルール

### ルール1: 売主番号・物件番号にはプレフィックスが必須

```typescript
// ✅ 正しい
const sellerNumber = 'AA13501';
const propertyNumber = 'AA13501';

// ❌ 間違い
const sellerNumber = '13501';
const propertyNumber = '13501';
```

### ルール2: 買主番号にはプレフィックスを付けない

```typescript
// ✅ 正しい
const buyerNumber = '7282';

// ❌ 間違い
const buyerNumber = 'AA7282';
const buyerNumber = 'BB7282';
```

### ルール3: データベース検索時の注意

```typescript
// 売主を検索（プレフィックス付き）
const seller = await supabase
  .from('sellers')
  .select('*')
  .eq('seller_number', 'AA13501')
  .single();

// 買主を検索（数字のみ）
const buyer = await supabase
  .from('buyers')
  .select('*')
  .eq('buyer_number', '7282')
  .single();
```

---

## 📋 識別子の比較表

| 種類 | プレフィックス | 例 | データベースカラム |
|------|--------------|-----|------------------|
| 売主番号 | ✅ あり（AA, BB等） | AA13501 | `seller_number` |
| 物件番号 | ✅ あり（AA, BB等） | AA13501 | `property_number` |
| 買主番号 | ❌ なし（数字のみ） | 7282 | `buyer_number` |

---

## 🎯 実例

### 例1: 売主AA13501を検索

```typescript
// ✅ 正しい
const seller = await supabase
  .from('sellers')
  .select('*')
  .eq('seller_number', 'AA13501')
  .single();
```

### 例2: 買主7282を検索

```typescript
// ✅ 正しい
const buyer = await supabase
  .from('buyers')
  .select('*')
  .eq('buyer_number', '7282')
  .single();

// ❌ 間違い
const buyer = await supabase
  .from('buyers')
  .select('*')
  .eq('buyer_number', 'AA7282')  // プレフィックスを付けてはいけない
  .single();
```

### 例3: GASコードでの買主番号の扱い

```javascript
// ✅ 正しい
var buyerNumber = row['買主番号'];  // '7282'（数字のみ）
if (!buyerNumber || typeof buyerNumber !== 'string') continue;

// データベースに保存
updateData.buyer_number = buyerNumber;  // '7282'
```

---

## 🚨 よくある間違い

### ❌ 間違い1: 買主番号にプレフィックスを付ける

```typescript
// ❌ 間違い
const buyerNumber = 'AA7282';  // 買主番号にはプレフィックスを付けない
```

### ❌ 間違い2: 売主番号のプレフィックスを省略

```typescript
// ❌ 間違い
const sellerNumber = '13501';  // 売主番号にはプレフィックスが必須
```

### ❌ 間違い3: 型の混同

```typescript
// ❌ 間違い（数値型）
const buyerNumber = 7282;  // 文字列型で扱う

// ✅ 正しい（文字列型）
const buyerNumber = '7282';
```

---

## 📝 チェックリスト

識別子を扱う前に、以下を確認してください：

- [ ] 売主番号にはプレフィックス（AA, BB等）が付いているか？
- [ ] 物件番号にはプレフィックス（AA, BB等）が付いているか？
- [ ] 買主番号はプレフィックスなしの数字のみか？
- [ ] 識別子を文字列型で扱っているか？

---

## まとめ

**識別子のプレフィックスルール**:

1. **売主番号**: プレフィックス付き（例: AA13501）
2. **物件番号**: プレフィックス付き（例: AA13501）
3. **買主番号**: プレフィックスなし（例: 7282）

**このルールを徹底することで、識別子の混同を完全に防止できます。**

---

**最終更新日**: 2026年4月3日  
**作成理由**: 買主番号と売主番号・物件番号のプレフィックスルールを明確化するため
