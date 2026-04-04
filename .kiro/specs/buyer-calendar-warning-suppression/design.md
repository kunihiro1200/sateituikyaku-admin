# Design Document

## Overview

買主内覧結果ページ（BuyerViewingResultPage）において、カレンダー登録済みの案件で不要な警告ダイアログを表示しないようにする機能を実装します。現在は`calendarOpened`というローカルステートで管理されているため、ページリロード後に警告が再表示されてしまいます。この問題を、データベースの`notification_sender`（通知送信者）フィールドの入力状態で判定することで解決します。

## Architecture

### 修正対象ファイル

- **フロントエンド**: `frontend/frontend/src/pages/BuyerViewingResultPage.tsx`
  - `needsCalendar`ロジックの修正（lines 243-248）

### データフロー

```
ページロード
  ↓
buyerデータ取得（notification_sender含む）
  ↓
needsCalendarロジック評価
  ↓
notification_senderが存在する → needsCalendar = false → 警告なし
notification_senderが空 → 既存ロジック適用 → 条件次第で警告
```

## Components and Interfaces

### 修正箇所

#### BuyerViewingResultPage.tsx (lines 243-248)

**変更前**:
```typescript
const needsCalendar = !!(
  buyer?.viewing_date &&
  buyer?.viewing_time &&
  buyer?.follow_up_assignee &&
  !buyer?.viewing_unconfirmed
);
```

**変更後**:
```typescript
const needsCalendar = !!(
  buyer?.viewing_date &&
  buyer?.viewing_time &&
  buyer?.follow_up_assignee &&
  !buyer?.viewing_unconfirmed &&
  !buyer?.notification_sender
);
```

### 影響を受ける関数

- **guardedNavigate**: `needsCalendar`の値に基づいて警告ダイアログを表示
  - `needsCalendar`がfalseの場合、警告を表示せずに直接ページ遷移
  - `needsCalendar`がtrueかつ`calendarOpened`がfalseの場合、警告ダイアログを表示

## Data Models

### Buyer型

```typescript
interface Buyer {
  viewing_date: string | null;
  viewing_time: string | null;
  follow_up_assignee: string | null;
  viewing_unconfirmed: string | null;
  notification_sender: string | null;  // 通知送信者フィールド
  // ... その他のフィールド
}
```

### needsCalendarロジック

**条件**:
- `viewing_date`が存在する
- `viewing_time`が存在する
- `follow_up_assignee`が存在する
- `viewing_unconfirmed`が空である
- **`notification_sender`が空である** ← 新規追加

**結果**:
- 全ての条件がtrueの場合: `needsCalendar = true` → 警告表示の可能性あり
- いずれかの条件がfalseの場合: `needsCalendar = false` → 警告表示なし

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: notification_sender存在時の警告抑制

*For any* 買主データで`notification_sender`フィールドに値が存在する場合、`needsCalendar`はfalseを返す

**Validates: Requirements 1.1**

### Property 2: notification_sender空時の既存ロジック適用

*For any* 買主データで`notification_sender`フィールドが空の場合、`needsCalendar`は既存の4条件（viewing_date, viewing_time, follow_up_assignee, !viewing_unconfirmed）に基づいて評価される

**Validates: Requirements 1.2, 4.1**

### Property 3: ページリロード後の一貫性

*For any* ページリロード後、データベースから取得した`notification_sender`の値に基づいて`needsCalendar`が評価され、同じ結果を返す

**Validates: Requirements 3.1, 3.2, 3.3**

## Error Handling

### エラーケース

1. **buyerデータが未取得**: `buyer`が`null`または`undefined`の場合
   - 既存の実装: `buyer?.`のオプショナルチェーンで安全に処理
   - `needsCalendar`は`false`となり、警告は表示されない

2. **notification_senderがundefined**: データベースに`notification_sender`カラムが存在しない場合
   - `!buyer?.notification_sender`は`true`となり、既存ロジックが適用される
   - 後方互換性が保たれる

## Testing Strategy

### Unit Tests

#### テストケース1: notification_sender存在時

**入力**:
```typescript
const buyer = {
  viewing_date: '2026-04-10',
  viewing_time: '14:00',
  follow_up_assignee: 'Y',
  viewing_unconfirmed: null,
  notification_sender: 'Y'  // 存在する
};
```

**期待結果**: `needsCalendar = false`

---

#### テストケース2: notification_sender空時（警告必要）

**入力**:
```typescript
const buyer = {
  viewing_date: '2026-04-10',
  viewing_time: '14:00',
  follow_up_assignee: 'Y',
  viewing_unconfirmed: null,
  notification_sender: null  // 空
};
```

**期待結果**: `needsCalendar = true`

---

#### テストケース3: notification_sender空時（他の条件不足）

**入力**:
```typescript
const buyer = {
  viewing_date: '2026-04-10',
  viewing_time: null,  // 時間なし
  follow_up_assignee: 'Y',
  viewing_unconfirmed: null,
  notification_sender: null
};
```

**期待結果**: `needsCalendar = false`

---

#### テストケース4: viewing_unconfirmedが存在

**入力**:
```typescript
const buyer = {
  viewing_date: '2026-04-10',
  viewing_time: '14:00',
  follow_up_assignee: 'Y',
  viewing_unconfirmed: '未確定',  // 存在する
  notification_sender: null
};
```

**期待結果**: `needsCalendar = false`

---

### Integration Tests

#### テスト1: ページリロード後の動作

**手順**:
1. 買主7282の内覧結果ページを開く
2. 「カレンダーで開く」ボタンを押す（`notification_sender`に値が保存される）
3. ページをリロード
4. 別のページに遷移しようとする

**期待結果**: 警告ダイアログが表示されない

---

#### テスト2: notification_sender未入力時の警告

**手順**:
1. 買主7283の内覧結果ページを開く（`notification_sender`が空）
2. 内覧日・時間・後続担当が設定されている
3. 別のページに遷移しようとする

**期待結果**: 警告ダイアログが表示される

---

### Property-Based Tests

Property-based testingは、このシンプルなロジック変更には不要です。Unit testsで十分にカバーできます。

---

## Implementation Notes

### 修正の最小性

- **変更箇所**: 1箇所のみ（lines 243-248）
- **追加コード**: `&& !buyer?.notification_sender` の1行のみ
- **既存ロジックへの影響**: なし（条件を追加するのみ）

### 後方互換性

- `notification_sender`フィールドが存在しない場合、`!buyer?.notification_sender`は`true`となり、既存ロジックが適用される
- データベースマイグレーションは不要（`notification_sender`カラムは既に存在）

### パフォーマンス

- 追加の条件チェックは1つのみ（`!buyer?.notification_sender`）
- パフォーマンスへの影響は無視できる程度

---

## Deployment

### デプロイ手順

1. **フロントエンドの修正**:
   ```bash
   # frontend/frontend/src/pages/BuyerViewingResultPage.tsx を修正
   git add frontend/frontend/src/pages/BuyerViewingResultPage.tsx
   git commit -m "fix: suppress calendar warning when notification_sender exists"
   git push origin main
   ```

2. **自動デプロイ**:
   - Git pushにより、Vercelが自動的にフロントエンドをデプロイ

3. **動作確認**:
   - 買主7282（`notification_sender`あり）で警告が出ないことを確認
   - 買主7283（`notification_sender`なし）で警告が出ることを確認

---

## Rollback Plan

### ロールバック手順

問題が発生した場合、以下の手順でロールバック：

1. **Gitで前のコミットに戻す**:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **手動で修正を元に戻す**:
   ```typescript
   // lines 243-248を元に戻す
   const needsCalendar = !!(
     buyer?.viewing_date &&
     buyer?.viewing_time &&
     buyer?.follow_up_assignee &&
     !buyer?.viewing_unconfirmed
   );
   ```

---

## Summary

この設計では、`needsCalendar`ロジックに`&& !buyer?.notification_sender`条件を追加することで、カレンダー登録済みの案件で不要な警告ダイアログを表示しないようにします。修正は最小限（1行の追加）で、既存ロジックへの影響はありません。ページリロード後も、データベースの`notification_sender`フィールドに基づいて正しく判定されます。
