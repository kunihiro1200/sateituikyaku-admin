# Bugfix Requirements Document

## Introduction

営業担当フィールドに「外す」という値が入力されている場合、GAS、バックエンド、フロントエンドの全てで「外す」を**空欄扱い**している。しかし、「外す」は**有効な営業担当の値**であり、空欄ではない。

この問題により、営担が「外す」の売主が誤ったサイドバーカテゴリに分類される。

**具体例（AA9484）**:
- 営業担当: 「外す」
- 状況（当社）: 「他決→追客」
- 次電日: 今日ではない
- 専任他決打合せ: 「完了」ではない

**現在の動作（バグ）**:
- 「未訪問他決」カテゴリに含まれる（営担が空欄扱いされるため）

**期待される動作**:
- 「訪問後他決」カテゴリに含まれる（営担が「外す」という有効な値として扱われるため）

---

## Bug Analysis

### Current Behavior (Defect)

#### 1.1 GAS（gas_complete_code.js）

**695行目**:
```javascript
var isVisitAssigneeValid = visitAssignee && visitAssignee !== '' && visitAssignee !== '外す';  // 「外す」は空欄扱い
```

WHEN 営担が「外す」の場合 THEN `isVisitAssigneeValid` が `false` になる（空欄扱い）

#### 1.2 バックエンド（backend/src/services/EnhancedAutoSyncService.ts）

**797行目**:
```typescript
const sheetVisitAssignee = (rawSheetVisitAssignee === '外す' || rawSheetVisitAssignee === '') ? null : (rawSheetVisitAssignee || null);
```

WHEN 営担が「外す」の場合 THEN `sheetVisitAssignee` が `null` に変換される

**1293行目、1594行目**:
```typescript
if (visitAssignee === '外す' || visitAssignee === '') {
  updateData.visit_assignee = null;
}
```

WHEN 営担が「外す」の場合 THEN データベースに `null` として保存される

#### 1.3 バックエンド（backend/src/services/SellerService.supabase.ts）

**1051行目、1099行目**:
```typescript
.neq('visit_assignee', '外す')
```

WHEN サイドバーカウント集計時 THEN 営担が「外す」の売主が除外される

#### 1.4 フロントエンド（frontend/frontend/src/utils/sellerStatusFilters.ts）

**203行目**:
```typescript
if (!visitAssignee || visitAssignee.trim() === '' || visitAssignee.trim() === '外す') {
  return false;
}
```

WHEN 営担が「外す」の場合 THEN `hasVisitAssignee()` が `false` を返す（担当なし扱い）

**678行目、922行目、938行目、989行目**:
同様に「外す」を空欄扱いしている

---

### Expected Behavior (Correct)

#### 2.1 GAS（gas_complete_code.js）

WHEN 営担が「外す」の場合 THEN `isVisitAssigneeValid` が `true` になる（有効な値として扱う）

**修正後のコード**:
```javascript
var isVisitAssigneeValid = visitAssignee && visitAssignee !== '';  // 「外す」を削除
```

#### 2.2 バックエンド（backend/src/services/EnhancedAutoSyncService.ts）

WHEN 営担が「外す」の場合 THEN `sheetVisitAssignee` が `'外す'` として保持される

**修正後のコード（797行目）**:
```typescript
const sheetVisitAssignee = (rawSheetVisitAssignee === '') ? null : (rawSheetVisitAssignee || null);
```

**修正後のコード（1293行目、1594行目）**:
```typescript
if (visitAssignee === '') {
  updateData.visit_assignee = null;
}
```

#### 2.3 バックエンド（backend/src/services/SellerService.supabase.ts）

WHEN サイドバーカウント集計時 THEN 営担が「外す」の売主を含める

**修正後のコード（1051行目、1099行目）**:
```typescript
// .neq('visit_assignee', '外す') を削除
```

#### 2.4 フロントエンド（frontend/frontend/src/utils/sellerStatusFilters.ts）

WHEN 営担が「外す」の場合 THEN `hasVisitAssignee()` が `true` を返す（有効な値として扱う）

**修正後のコード（203行目）**:
```typescript
if (!visitAssignee || visitAssignee.trim() === '') {
  return false;
}
```

**修正後のコード（678行目、922行目、938行目、989行目）**:
同様に `&& visitAssignee.trim() !== '外す'` を削除

---

### Unchanged Behavior (Regression Prevention)

#### 3.1 空文字の営担

WHEN 営担が空文字（`''`）の場合 THEN 引き続き担当なしとして扱う

#### 3.2 nullの営担

WHEN 営担が `null` の場合 THEN 引き続き担当なしとして扱う

#### 3.3 有効なイニシャル（Y, I, K等）

WHEN 営担が有効なイニシャル（例: `'Y'`, `'I'`, `'K'`）の場合 THEN 引き続き有効な担当として扱う

#### 3.4 サイドバーカテゴリの他の条件

WHEN サイドバーカテゴリの他の条件（状況、次電日、専任他決打合せ等）THEN 引き続き正しく判定される

---

## Bug Condition

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SellerData
  OUTPUT: boolean
  
  // 営担が「外す」の場合にバグが発生
  RETURN X.visit_assignee = '外す'
END FUNCTION
```

### Property Specification

```pascal
// Property: Fix Checking - 「外す」を有効な値として扱う
FOR ALL X WHERE isBugCondition(X) DO
  result ← processVisitAssignee'(X)
  ASSERT result.isValid = true AND result.value = '外す'
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking - 他の値の扱いは変更しない
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT processVisitAssignee(X) = processVisitAssignee'(X)
END FOR
```

**Key Definitions:**
- **processVisitAssignee**: 修正前の営担処理関数
- **processVisitAssignee'**: 修正後の営担処理関数

---

## Impact

### サイドバーカテゴリへの影響

#### 訪問後他決カテゴリ

**条件**: 専任他決打合せ ≠ "完了" AND 次電日 ≠ 今日 AND 状況（当社） IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取") AND **営担あり**

**現在の動作（バグ）**: 営担が「外す」の売主は「営担なし」として扱われ、このカテゴリに含まれない

**期待される動作**: 営担が「外す」の売主は「営担あり」として扱われ、このカテゴリに含まれる

#### 未訪問他決カテゴリ

**条件**: 専任他決打合せ ≠ "完了" AND 次電日 ≠ 今日 AND 状況（当社） IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取") AND **営担なし**

**現在の動作（バグ）**: 営担が「外す」の売主は「営担なし」として扱われ、このカテゴリに含まれる

**期待される動作**: 営担が「外す」の売主は「営担あり」として扱われ、このカテゴリに含まれない

---

## Affected Files

### GAS
- `gas_complete_code.js` (695行目)

### Backend
- `backend/src/services/EnhancedAutoSyncService.ts` (797行目、1293行目、1594行目)
- `backend/src/services/SellerService.supabase.ts` (1051行目、1099行目)

### Frontend
- `frontend/frontend/src/utils/sellerStatusFilters.ts` (203行目、678行目、922行目、938行目、989行目)

---

## Notes

- この修正は、以前にコミット `5b0e733d` で実装されたが、サイドバー問題対応のため `git reset --hard aec54bd5` で取り消された
- 今回は、サイドバー問題が解決した後に再度実装する
- テストスクリプトも再作成する必要がある
