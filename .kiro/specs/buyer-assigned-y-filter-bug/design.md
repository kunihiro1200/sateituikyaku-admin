# 買主「担当(Y)」フィルタバグ修正 Design

## Overview

買主リストの「担当(Y)」サイドバーカテゴリにおいて、サイドバーカウントと一覧表示件数が不一致となるバグを修正しました。

## 最終的な修正内容（コミット a7598425）

### 根本原因

フロントエンドとバックエンドのフィルタリングロジックが異なっていたため、カウント不一致が発生していました。

**バックエンドのロジック**:
```typescript
buyer.follow_up_assignee === assignee || 
(!buyer.follow_up_assignee && buyer.initial_assignee === assignee)
```
- `follow_up_assignee`を優先
- `follow_up_assignee`が空の場合のみ`initial_assignee`をチェック

**フロントエンドの誤ったロジック（修正前）**:
```typescript
b.follow_up_assignee === assignee || b.initial_assignee === assignee
```
- 両方をORで結合
- バックエンドと異なる結果になる

### 修正内容

`frontend/frontend/src/pages/BuyersPage.tsx` (145-152行目):
```typescript
const matches = (
  b.follow_up_assignee === assignee ||
  (!b.follow_up_assignee && b.initial_assignee === assignee)
);
```

### 復元方法

もし再び「データなし」問題が発生した場合：
```bash
git checkout a7598425 -- frontend/frontend/src/pages/BuyersPage.tsx
git add frontend/frontend/src/pages/BuyersPage.tsx
git commit -m "fix: 買主「担当(Y)」フィルタを正常なバージョン(a7598425)に復元"
git push origin main
```

## Glossary

- **Bug_Condition (C)**: フロントエンドとバックエンドのフィルタリングロジックが異なり、「担当(Y)」カテゴリで「データなし」が表示される条件
- **Property (P)**: フロントエンドとバックエンドのロジックが一致し、正しい件数が表示される状態
- **Preservation**: 他のサイドバーカテゴリのフィルタリングが正常に動作し続けること
- **follow_up_assignee**: 後続担当者（優先）
- **initial_assignee**: 初動担当者（`follow_up_assignee`が空の場合のみ使用）

## Bug Details

### Bug Condition

フロントエンドのフィルタリングロジックがバックエンドと異なっていたため、「担当(Y)」カテゴリで「データなし」が表示されていました。

**バックエンドのロジック**:
```typescript
buyer.follow_up_assignee === assignee || 
(!buyer.follow_up_assignee && buyer.initial_assignee === assignee)
```

**フロントエンドの誤ったロジック**:
```typescript
// 修正前（間違い）
b.follow_up_assignee === assignee || b.initial_assignee === assignee
```

### Examples

- **例1**: 本番環境で「担当(Y)」カテゴリをクリックすると「データなし」が表示される
- **例2**: ローカル環境では正しく動作するが、本番環境では動作しない
- **例3**: バックエンドのログでは正しい件数が返されているが、フロントエンドで0件になる

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他のサイドバーカテゴリのフィルタリングは引き続き正常に動作する
- バックエンドのロジックは変更しない
- フロントエンドのロジックをバックエンドに合わせる

**Scope:**
「担当(Y)」以外のカテゴリは影響を受けない。

## Hypothesized Root Cause

フロントエンドのフィルタリングロジックがバックエンドと異なっていました。

**バックエンド** (`BuyerService.getBuyersByStatus()`):
```typescript
buyer.follow_up_assignee === assignee || 
(!buyer.follow_up_assignee && buyer.initial_assignee === assignee)
```
- `follow_up_assignee`を優先
- `follow_up_assignee`が空の場合のみ`initial_assignee`をチェック

**フロントエンド（修正前）**:
```typescript
b.follow_up_assignee === assignee || b.initial_assignee === assignee
```
- 両方をORで結合
- バックエンドと異なる結果になる

## Correctness Properties

Property 1: フロントエンドとバックエンドのロジック一致

_For any_ 「担当(Y)」カテゴリをクリックした場合、フロントエンドとバックエンドで同じフィルタリングロジックが使用され、同じ結果が表示される。

Property 2: Preservation - 他のカテゴリのフィルタリング

_For any_ 「担当(Y)」以外のサイドバーカテゴリをクリックした場合、修正前と同じフィルタリング結果が表示される。

## Fix Implementation

### Changes Required

フロントエンドのフィルタリングロジックをバックエンドと完全に一致させました。

**File**: `frontend/frontend/src/pages/BuyersPage.tsx`

**Lines**: 145-152

**Final Fix (Commit a7598425)**:
```typescript
const matches = (
  b.follow_up_assignee === assignee ||
  (!b.follow_up_assignee && b.initial_assignee === assignee)
);
```

### 修正の経緯

**Iteration 1**: `calculated_status`との比較を削除 → 部分的に改善
**Iteration 2**: `b.follow_up_assignee === assignee || b.initial_assignee === assignee` → まだ不一致
**Iteration 3 (Final)**: バックエンドと完全に一致するロジックに修正 → 成功

## Testing Strategy

### Final Validation

修正後、本番環境で以下を確認しました：

1. **「担当(Y)」カテゴリ**: 正しい件数が表示される
2. **他のカテゴリ**: 引き続き正常に動作する
3. **デバッグログ**: フロントエンドとバックエンドで同じ判定結果が出力される

### Restoration Command

もし再び問題が発生した場合：
```bash
git checkout a7598425 -- frontend/frontend/src/pages/BuyersPage.tsx
git add frontend/frontend/src/pages/BuyersPage.tsx
git commit -m "fix: 買主「担当(Y)」フィルタを正常なバージョン(a7598425)に復元"
git push origin main
```
