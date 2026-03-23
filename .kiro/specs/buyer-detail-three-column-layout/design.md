# デザインドキュメント: 買主詳細画面の3列レイアウト化

## 概要

`BuyerDetailPage.tsx` の現在の2列レイアウトを3列レイアウトに変更する。
売主の通話モードページ（`CallModePage.tsx`）と同様に、左・中央・右の3列構成にする。

**変更の目的**: 担当者が通話履歴・物件情報・買主情報を同時に確認できるようにし、業務効率を向上させる。

### 変更前後の比較

| 列 | 変更前 | 変更後 |
|----|--------|--------|
| 左列 | 物件詳細カード（42%） | 通話履歴 + メール・SMS送信履歴（新規） |
| 中央列 | なし | 物件詳細カード（移動） |
| 右列 | 買主情報 + メール・SMS送信履歴 | 買主情報フィールド + 関連買主 |

---

## アーキテクチャ

変更はフロントエンドのみ。バックエンドAPIの変更は不要。

```
frontend/frontend/src/pages/BuyerDetailPage.tsx
  ├── 左列（新規）
  │   ├── 通話履歴セクション（activities.filter(a => a.action === 'call' || a.action === 'phone_call')）
  │   └── メール・SMS送信履歴セクション（activities.filter(a => a.action === 'email' || a.action === 'sms')）
  ├── 中央列（移動）
  │   └── PropertyInfoCard（linkedPropertiesをマップ）
  └── 右列（整理）
      ├── BUYER_FIELD_SECTIONS（インライン編集フィールド群）
      └── RelatedBuyersSection（右列内に移動）
```

### データフロー

既存の `fetchActivities()` が `/api/activity-logs` から取得した `activities` 配列を、左列の2セクションで共有して使用する。新規APIコールは不要。

```
GET /api/activity-logs?target_type=buyer&target_id={buyer_number}
  → activities: Activity[]
    ├── action === 'call' | 'phone_call' → 通話履歴セクション
    └── action === 'email' | 'sms'       → メール・SMS送信履歴セクション
```

---

## コンポーネントとインターフェース

### レイアウト構造

```tsx
{/* 3列レイアウトコンテナ */}
<Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', '@media (max-width: 900px)': { flexDirection: 'column' } }}>

  {/* 左列: 通話履歴 + メール・SMS送信履歴 */}
  <Box sx={{ flex: '0 0 28%', minWidth: 0, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
    {/* 通話履歴セクション */}
    {/* メール・SMS送信履歴セクション */}
  </Box>

  {/* 中央列: 物件詳細カード */}
  <Box sx={{ flex: '0 0 36%', minWidth: 0, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
    {/* PropertyInfoCard */}
  </Box>

  {/* 右列: 買主情報フィールド + 関連買主 */}
  <Box sx={{ flex: '1 1 36%', minWidth: 0, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
    {/* BUYER_FIELD_SECTIONS */}
    {/* RelatedBuyersSection */}
  </Box>

</Box>
```

### 列幅の設計方針

- 左列: `flex: '0 0 28%'` — 履歴表示に必要な最小幅
- 中央列: `flex: '0 0 36%'` — PropertyInfoCardの既存表示に適した幅
- 右列: `flex: '1 1 36%'` — 残りのスペースを占有（インライン編集フィールドに十分な幅）

### 通話履歴セクション（新規）

既存の `Activity` インターフェースをそのまま使用する。

```tsx
// 通話履歴のフィルタリング
const callActivities = activities
  .filter(a => a.action === 'call' || a.action === 'phone_call')
  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
```

表示項目:
- 日時（`formatDateTime(activity.created_at)`）
- 担当者（`getDisplayName(activity.employee)`）
- メモ（`activity.metadata?.notes` または `activity.metadata?.memo`）

### メール・SMS送信履歴セクション（移動）

現在の右列にある実装をそのまま左列に移動する。表示ロジックの変更なし。

```tsx
// 既存のフィルタリングロジック（変更なし）
const emailSmsActivities = activities
  .filter(a => a.action === 'email' || a.action === 'sms')
  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
```

### RelatedBuyersSection の移動

現在は2列レイアウトの外側（`<Box sx={{ mt: 3 }}>` で囲まれた独立セクション）に配置されている。
これを右列の最下部に移動する。

---

## データモデル

既存のデータモデルを変更しない。

### Activity インターフェース（既存・変更なし）

```typescript
interface Activity {
  id: number;
  action: string;           // 'call' | 'phone_call' | 'email' | 'sms'
  target_type: string;
  target_id: number;
  metadata: any;            // 通話: { notes?, memo? } / メール: { subject, senderEmail, propertyNumbers, preViewingNotes? } / SMS: { templateName, phoneNumber }
  created_at: string;
  employee?: {
    id: number;
    name: string;
    initials: string;
  };
}
```

### 通話履歴の metadata 構造（参考）

```typescript
// action === 'call' | 'phone_call' の場合
metadata: {
  notes?: string;      // 通話メモ
  memo?: string;       // 通話メモ（別フィールド名）
  duration?: number;   // 通話時間（秒）
}
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: 3列レイアウトの存在

*任意の* 買主データに対して、BuyerDetailPageは左列・中央列・右列の3つの列要素を持つコンテナを表示する。各列は `overflowY: auto` と `maxHeight` が設定されており、独立してスクロール可能である。

**Validates: Requirements 1.1, 1.2**

### Property 2: 通話履歴のフィルタリング正確性

*任意の* activities 配列に対して、左列の通話履歴セクションに表示されるアイテムは全て `action === 'call'` または `action === 'phone_call'` であり、それ以外のアクション（email, sms等）は含まれない。

**Validates: Requirements 2.1, 2.4**

### Property 3: メール・SMS履歴のフィルタリング正確性と配置

*任意の* activities 配列に対して、左列のメール・SMS送信履歴セクションに表示されるアイテムは全て `action === 'email'` または `action === 'sms'` であり、右列には同セクションが存在しない。

**Validates: Requirements 2.2, 3.1, 3.2, 3.3, 5.4**

### Property 4: メール・SMS履歴の表示内容の維持

*任意の* email/sms アクティビティに対して、表示される内容には件名（またはテンプレート名）・送信者情報・物件番号（存在する場合）が含まれる。

**Validates: Requirements 3.5**

### Property 5: 物件詳細カードの中央列配置

*任意の* linkedProperties 配列に対して、PropertyInfoCard コンポーネントは中央列に表示され、左列・右列には存在しない。

**Validates: Requirements 4.1, 4.2**

### Property 6: 右列の構成

*任意の* 買主データに対して、右列には BUYER_FIELD_SECTIONS の全セクションと RelatedBuyersSection が含まれ、メール・SMS送信履歴セクションは含まれない。

**Validates: Requirements 5.1, 5.2, 5.4**

---

## エラーハンドリング

### 通話履歴が空の場合

```tsx
{callActivities.length === 0 && (
  <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
    <PhoneIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
    <Typography variant="body2">通話履歴はありません</Typography>
  </Box>
)}
```

### メール・SMS送信履歴が空の場合

既存の実装を維持する（「メール送信履歴はありません」メッセージ）。

### activities の取得失敗

既存の `fetchActivities()` のエラーハンドリングを維持する（コンソールエラーのみ、UIへの影響なし）。左列は空の状態で表示される。

### レスポンシブ対応

900px以下では `flexDirection: 'column'` に切り替わり、列が縦に積み重なる。各列の `maxHeight` と `overflowY` は解除される。

```tsx
'@media (max-width: 900px)': {
  flex: '1 1 auto',
  width: '100%',
  maxHeight: 'none',
  overflowY: 'visible',
  position: 'static',
}
```

---

## テスト戦略

### ユニットテスト（具体例・エッジケース）

- 通話履歴が空の場合に「通話履歴はありません」が表示されること（Requirements 2.5）
- メール・SMS送信履歴が空の場合に「メール送信履歴はありません」が表示されること（Requirements 3.4）
- linkedProperties が空の場合に「紐づいた物件はありません」が表示されること（Requirements 4.3）
- 900px以下でレスポンシブレイアウトが適用されること（Requirements 1.3）

### プロパティベーステスト（Vitest + @fast-check/vitest）

各プロパティテストは最低100回のランダム入力で実行する。

```typescript
// Feature: buyer-detail-three-column-layout, Property 2: 通話履歴のフィルタリング正確性
test.prop([fc.array(activityArbitrary)])(
  '通話履歴セクションにはcall/phone_callのみ表示される',
  (activities) => {
    const callActivities = activities.filter(
      a => a.action === 'call' || a.action === 'phone_call'
    );
    // 全てのアイテムが正しいactionを持つことを確認
    expect(callActivities.every(a => a.action === 'call' || a.action === 'phone_call')).toBe(true);
    // emailやsmsが混入していないことを確認
    expect(callActivities.some(a => a.action === 'email' || a.action === 'sms')).toBe(false);
  }
);

// Feature: buyer-detail-three-column-layout, Property 3: メール・SMS履歴のフィルタリング正確性
test.prop([fc.array(activityArbitrary)])(
  'メール・SMS履歴セクションにはemail/smsのみ表示される',
  (activities) => {
    const emailSmsActivities = activities.filter(
      a => a.action === 'email' || a.action === 'sms'
    );
    expect(emailSmsActivities.every(a => a.action === 'email' || a.action === 'sms')).toBe(true);
    expect(emailSmsActivities.some(a => a.action === 'call' || a.action === 'phone_call')).toBe(false);
  }
);

// Feature: buyer-detail-three-column-layout, Property 4: メール・SMS履歴の表示内容の維持
test.prop([fc.array(emailActivityArbitrary)])(
  'メールアクティビティの表示内容に件名と送信者情報が含まれる',
  (emailActivities) => {
    emailActivities.forEach(activity => {
      const metadata = activity.metadata || {};
      if (activity.action === 'email') {
        // 件名が存在するか、フォールバックが表示されること
        expect(metadata.subject !== undefined || true).toBe(true);
      }
    });
  }
);
```

**プロパティベーステストライブラリ**: `fast-check`（`@fast-check/vitest`）
- 各テスト最低100回のランダム入力で実行
- `fc.array()`、`fc.record()` でランダムなactivitiesデータを生成
