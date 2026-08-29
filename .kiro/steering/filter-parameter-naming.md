---
title: フィルターパラメータの命名規則（絶対に間違えないルール）
inclusion: auto
---

# フィルターパラメータの命名規則（絶対に間違えないルール）

## ⚠️ 重要：変数名のリネームは8箇所すべてを変更する

フィルターパラメータの変数名を変更する際は、**必ず8箇所すべて**を変更してください。
**1箇所でも変更漏れがあると、フィルターが機能しなくなります。**

---

## 🚨 過去の障害：townNameFilterのリネーム漏れ

**発生日**: 2026年8月25日

**症状**:
- 「K 大分 石垣 マンション 追客中」フィルタを選択しても、AA14840（東大道）など関係ない売主が表示される
- フィルター保存時に「ReferenceError: townName filter is not defined」エラーが発生
- 売主リストの取得時に「Failed to fetch sellers: ReferenceError: townName filter is not defined」エラーが発生

**根本原因**:
- `addressKeywordFilter` → `townNameFilter` にリネームする際に、**8箇所のうち5箇所しか変更していなかった**
- 変更漏れ：
  1. ❌ state定義（`useState`）
  2. ❌ UIコンポーネント（`TextField`のvalue/onChange）
  3. ❌ クリア処理（「フィルタークリア」ボタン）
  4. ❌ ラベル自動生成（一時フィルター保存時）
  5. ❌ useEffect依存配列（フィルター変更時の自動再取得）

**影響**:
- フィルターが全く機能しない
- エラーが発生してフィルター保存ができない
- ユーザーが混乱する

---

## 📋 変数名を変更する際の必須チェックリスト

フィルターパラメータの変数名（例: `addressKeywordFilter` → `townNameFilter`）を変更する際は、**必ず以下の8箇所すべて**を変更してください。

### ✅ 必須の変更箇所（8箇所）

#### 1. **state定義**（`useState`）

**ファイル**: `frontend/frontend/src/pages/SellersPage.tsx`

**場所**: 350行目付近

```typescript
// ❌ 変更前
const [addressKeywordFilter, setAddressKeywordFilter] = useState('');

// ✅ 変更後
const [townNameFilter, setTownNameFilter] = useState('');
```

---

#### 2. **UIコンポーネント**（`TextField`のvalue/onChange）

**ファイル**: `frontend/frontend/src/pages/SellersPage.tsx`

**場所**: 1360行目付近

```typescript
// ❌ 変更前
<TextField
  label="地名・町名"
  value={addressKeywordFilter}
  onChange={(e) => setAddressKeywordFilter(e.target.value)}
/>

// ✅ 変更後
<TextField
  label="地名・町名"
  value={townNameFilter}
  onChange={(e) => setTownNameFilter(e.target.value)}
/>
```

---

#### 3. **クリア処理**（「フィルタークリア」ボタン）

**ファイル**: `frontend/frontend/src/pages/SellersPage.tsx`

**場所**: 1550行目付近

```typescript
// ❌ 変更前
setAddressKeywordFilter('');

// ✅ 変更後
setTownNameFilter('');
```

---

#### 4. **ラベル自動生成**（一時フィルター保存時）

**ファイル**: `frontend/frontend/src/pages/SellersPage.tsx`

**場所**: 1580行目付近

```typescript
// ❌ 変更前
if (addressKeywordFilter.trim()) {
  labelParts.push(addressKeywordFilter.trim());
}

// ✅ 変更後
if (townNameFilter.trim()) {
  labelParts.push(townNameFilter.trim());
}
```

---

#### 5. **useEffect依存配列**（フィルター変更時の自動再取得）

**ファイル**: `frontend/frontend/src/pages/SellersPage.tsx`

**場所**: 795行目付近

```typescript
// ❌ 変更前
useEffect(() => {
  fetchSellers();
}, [page, rowsPerPage, ..., visitAssigneeFilter, selectedCategory, sortBy, sortOrder]);

// ✅ 変更後
useEffect(() => {
  fetchSellers();
}, [page, rowsPerPage, ..., visitAssigneeFilter, townNameFilter, selectedCategory, sortBy, sortOrder]);
```

---

#### 6. **フィルター保存処理**（一時フィルター保存時）

**ファイル**: `frontend/frontend/src/pages/SellersPage.tsx`

**場所**: 630行目付近

```typescript
// ❌ 変更前
if (addressKeywordFilter.trim()) filtersToSave.addressKeyword = addressKeywordFilter.trim();

// ✅ 変更後
if (townNameFilter.trim()) filtersToSave.townName = townNameFilter.trim();
```

---

#### 7. **フィルター復元処理**（一時フィルター選択時）

**ファイル**: `frontend/frontend/src/pages/SellersPage.tsx`

**場所**: 690行目付近、720行目付近

```typescript
// ❌ 変更前
setAddressKeywordFilter(''); // リセット時
if (f.addressKeyword) setAddressKeywordFilter(f.addressKeyword); // 復元時

// ✅ 変更後
setTownNameFilter(''); // リセット時
if (f.townName) setTownNameFilter(f.townName); // 復元時
```

---

#### 8. **fetchSellersのparams**（APIリクエスト時）

**ファイル**: `frontend/frontend/src/pages/SellersPage.tsx`

**場所**: 860行目付近

```typescript
// ❌ 変更前
if (addressKeywordFilter.trim()) {
  params.addressKeyword = addressKeywordFilter.trim();
}

// ✅ 変更後
if (townNameFilter.trim()) {
  params.townName = townNameFilter.trim();
}
```

---

## 🔍 変更漏れを防ぐ方法

### 方法1: grepSearchで全参照を検索

変数名を変更する前に、**必ず全参照を検索**してください。

```typescript
// 例: addressKeywordFilter の全参照を検索
grepSearch("addressKeywordFilter", {
  includePattern: "frontend/frontend/src/pages/SellersPage.tsx"
});
```

検索結果の**すべての箇所**を変更してください。

---

### 方法2: semantic_renameツールを使用

**semantic_rename**ツールを使用すると、変数名を一括でリネームできます。

```typescript
semantic_rename({
  path: "frontend/frontend/src/pages/SellersPage.tsx",
  line: 356, // state定義の行
  character: 8, // const [addressKeywordFilter] の先頭位置
  oldName: "addressKeywordFilter",
  newName: "townNameFilter"
});
```

**注意**: semantic_renameは完璧ではないため、変更後も必ず全参照を確認してください。

---

### 方法3: TypeScriptのコンパイルエラーを確認

変更後、**必ずTypeScriptのコンパイルエラーを確認**してください。

```bash
cd frontend/frontend
npm run build
```

コンパイルエラーが出た場合、変更漏れがあります。

---

## 📝 チェックリストテンプレート

変数名を変更する際は、以下のチェックリストを使用してください。

```markdown
## フィルターパラメータのリネーム：`旧変数名` → `新変数名`

- [ ] 1. state定義（`useState`）
- [ ] 2. UIコンポーネント（`TextField`のvalue/onChange）
- [ ] 3. クリア処理（「フィルタークリア」ボタン）
- [ ] 4. ラベル自動生成（一時フィルター保存時）
- [ ] 5. useEffect依存配列（フィルター変更時の自動再取得）
- [ ] 6. フィルター保存処理（一時フィルター保存時）
- [ ] 7. フィルター復元処理（一時フィルター選択時）
- [ ] 8. fetchSellersのparams（APIリクエスト時）
- [ ] 9. grepSearchで全参照を確認（漏れがないか最終確認）
- [ ] 10. TypeScriptのコンパイルエラーを確認
- [ ] 11. ブラウザで動作確認（フィルター保存・復元・適用）
```

---

## 🚨 絶対に守るべきルール

1. **変数名を変更する際は、必ず8箇所すべてを変更する**
2. **変更前に必ずgrepSearchで全参照を検索する**
3. **変更後は必ずTypeScriptのコンパイルエラーを確認する**
4. **変更後は必ずブラウザで動作確認する**
5. **semantic_renameツールを使用しても、必ず全参照を手動で確認する**

---

## 💡 今後の改善案

### 提案1: カスタムフックに抽出

フィルターロジックをカスタムフックに抽出することで、変更漏れを防ぐことができます。

```typescript
// frontend/frontend/src/hooks/useSellerFilters.ts
export function useSellerFilters() {
  const [townNameFilter, setTownNameFilter] = useState('');
  
  // フィルター保存・復元・クリア処理を一元管理
  const saveFilter = () => { ... };
  const restoreFilter = () => { ... };
  const clearFilter = () => { ... };
  
  return {
    townNameFilter,
    setTownNameFilter,
    saveFilter,
    restoreFilter,
    clearFilter,
  };
}
```

### 提案2: フィルター定義オブジェクトを使用

フィルター定義を1つのオブジェクトにまとめることで、変更箇所を減らすことができます。

```typescript
const [filters, setFilters] = useState({
  region: [],
  townName: '',
  propertyType: [],
  status: [],
  // ...
});
```

---

## まとめ

**フィルターパラメータの変数名を変更する際は、必ず8箇所すべてを変更してください。**

**このドキュメントを読んでから、変数名を変更してください。**

---

**最終更新日**: 2026年8月25日  
**作成理由**: townNameFilterのリネーム漏れによる障害を防ぐため  
**関連ファイル**: `frontend/frontend/src/pages/SellersPage.tsx`
