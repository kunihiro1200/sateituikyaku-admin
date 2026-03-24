# 設計書

## 概要

CallModePageの「査定計算」セクションに郵送フィールドを追加する。査定方法が「郵送」の場合のみ表示し、「未」/「済」のボタン形式でmailing_statusを管理する。サイドバーのmailingPendingカテゴリーとの連携、およびスプレッドシートBY列との双方向同期を実装する。

---

## アーキテクチャ

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/frontend/src/pages/CallModePage.tsx` | 郵送フィールドUI追加 |
| `backend/src/config/column-mapping.json` | BY列「郵送」マッピング追加 |
| `backend/src/services/EnhancedAutoSyncService.ts` | スプレッドシート→DB同期にmailing_status追加 |

### 変更不要ファイル（既存実装済み）

| ファイル | 理由 |
|---------|------|
| `backend/src/services/SellerService.supabase.ts` | `decryptSeller`に`mailingStatus`実装済み、`updateSeller`に`mailing_status`更新実装済み |
| `frontend/frontend/src/utils/sellerStatusFilters.ts` | `isMailingPending`関数実装済み |
| `frontend/frontend/src/components/SellerStatusSidebar.tsx` | `mailingPending`カテゴリー表示実装済み |

---

## 詳細設計

### 1. フロントエンド: CallModePage.tsx

#### 1.1 郵送フィールドの表示条件

査定計算セクション内で、`editedValuationMethod === '郵送'` の場合のみ郵送フィールドを表示する。

```tsx
{/* 郵送フィールド（査定方法が「郵送」の場合のみ表示） */}
{editedValuationMethod === '郵送' && (
  <Box sx={{ mt: 1 }}>
    <Typography variant="caption" color="text.secondary">
      郵送
      {seller?.updatedAt && (
        <span style={{ marginLeft: 8, color: '#888' }}>
          （{formatDateTime(seller.updatedAt)}）
        </span>
      )}
    </Typography>
    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
      {['未', '済'].map((option) => (
        <Button
          key={option}
          variant={mailingStatus === option ? 'contained' : 'outlined'}
          size="small"
          onClick={() => handleMailingStatusChange(option)}
          disabled={savingMailingStatus}
        >
          {option}
        </Button>
      ))}
    </Box>
  </Box>
)}
```

#### 1.2 状態変数の追加

```tsx
// 郵送ステータス用の状態
const [mailingStatus, setMailingStatus] = useState<string>('');
const [savingMailingStatus, setSavingMailingStatus] = useState(false);
```

#### 1.3 初期化ロジック

売主データロード時に`mailingStatus`を初期化する。査定方法が「郵送」でmailing_statusが未設定の場合はデフォルト「未」を設定する。

```tsx
// seller データロード時の初期化（既存のuseEffect内に追加）
setMailingStatus(seller.mailingStatus || (seller.valuationMethod === '郵送' ? '未' : ''));
```

#### 1.4 ハンドラー関数

```tsx
const handleMailingStatusChange = async (status: string) => {
  setSavingMailingStatus(true);
  try {
    await api.patch(`/sellers/${id}`, { mailingStatus: status });
    setMailingStatus(status);
    setSeller(prev => prev ? { ...prev, mailingStatus: status } : prev);
  } catch (error) {
    console.error('郵送ステータス保存エラー:', error);
  } finally {
    setSavingMailingStatus(false);
  }
};
```

#### 1.5 査定方法変更時の連動

既存の`editedValuationMethod`の変更ハンドラーに、郵送ステータスのデフォルト設定を追加する。

```tsx
// 査定方法が「郵送」に変更された場合、mailing_statusが未設定なら「未」をデフォルト設定
if (newMethod === '郵送' && !mailingStatus) {
  setMailingStatus('未');
}
```

---

### 2. バックエンド: column-mapping.json

スプレッドシートBY列「郵送」とDBの`mailing_status`カラムのマッピングを追加する。

```json
// spreadsheetToDatabase に追加
"郵送": "mailing_status"

// databaseToSpreadsheet に追加
"mailing_status": "郵送"
```

---

### 3. バックエンド: EnhancedAutoSyncService.ts

`updateSingleSeller`メソッドおよび`syncSingleSeller`メソッドに`mailing_status`の同期処理を追加する。

```typescript
// updateSingleSeller メソッド内に追加
const mailingStatus = row['郵送'];
if (mailingStatus !== undefined && mailingStatus !== '') {
  updateData.mailing_status = String(mailingStatus);
}
```

また、`detectUpdatedSellers`メソッドの比較対象フィールドに`mailing_status`を追加する。

```typescript
// detectUpdatedSellers の SELECT クエリに追加
'mailing_status'

// 比較ロジックに追加
const dbMailingStatus = dbSeller.mailing_status || '';
const sheetMailingStatus = sheetRow['郵送'] || '';
if (sheetMailingStatus !== '' && sheetMailingStatus !== dbMailingStatus) {
  needsUpdate = true;
}
```

---

## データフロー

### DB → スプレッドシート（即時同期）

```
ユーザーがCallModePageで「未」/「済」ボタンをクリック
  ↓
handleMailingStatusChange() が PATCH /api/sellers/:id を呼び出し
  ↓
SellerService.updateSeller() が sellers.mailing_status を更新
  ↓
SyncQueue.enqueue() が同期をキューに追加
  ↓
SpreadsheetSyncService.syncToSpreadsheet() → ColumnMapper.mapToSheet()
  ↓
スプレッドシートBY列「郵送」に「未」または「済」を書き込み
```

### スプレッドシート → DB（定期同期、10分ごと）

```
GASの syncSellerList トリガーが発火
  ↓
スプレッドシートBY列「郵送」の値を読み取り
  ↓
バックエンドAPIにPOSTリクエスト
  ↓
EnhancedAutoSyncService.updateSingleSeller() が mailing_status を更新
  ↓
DBの sellers.mailing_status が更新される
```

---

## 正確性プロパティ

### プロパティ1: 表示条件の不変性

`editedValuationMethod === '郵送'` の場合のみ郵送フィールドが表示される。

```
∀ seller: seller.valuationMethod === '郵送' ⟺ 郵送フィールドが表示される
```

### プロパティ2: デフォルト値の不変性

査定方法が「郵送」に変更された直後、mailing_statusが未設定の場合は「未」がデフォルト値となる。

```
∀ seller: seller.valuationMethod === '郵送' ∧ seller.mailingStatus === null
  → 表示されるmailingStatus === '未'
```

### プロパティ3: mailingPendingカウントの整合性

`isMailingPending(seller)` は `seller.mailingStatus === '未'` と等価である。

```
∀ seller: isMailingPending(seller) ⟺ seller.mailingStatus === '未'
```

### プロパティ4: 双方向同期のラウンドトリップ

DB→スプレッドシート→DBの同期後、mailing_statusの値が保持される。

```
∀ status ∈ {'未', '済'}:
  DB.mailing_status = status
  → SpreadsheetSync → Sheet['郵送'] = status
  → GAS Sync → DB.mailing_status = status
```

### プロパティ5: 値の制約

mailing_statusは「未」または「済」のみ。UIがボタン形式のため自然に保証される。

```
∀ mailing_status: mailing_status ∈ {'未', '済', null}
```

---

## 実装上の注意事項

### 既存実装との整合性

- `SellerService.supabase.ts`の`decryptSeller`には既に`mailingStatus: seller.mailing_status`が実装済み
- `SellerService.supabase.ts`の`updateSeller`には既に`mailing_status`の更新処理が実装済み
- `sellerStatusFilters.ts`の`isMailingPending`は既に`seller.mailingStatus === '未'`で実装済み
- `SellerStatusSidebar.tsx`の`mailingPending`カテゴリーは既に実装済み

### column-mapping.jsonの注意事項

`seller-spreadsheet-column-mapping.md`のルールに従い、`spreadsheetToDatabase`と`databaseToSpreadsheet`の両方にマッピングを追加する。

### EnhancedAutoSyncServiceの注意事項

`auto-sync-timing.md`に記載の通り、Vercel本番環境では`EnhancedPeriodicSyncManager`は動作しない。実質的な定期同期はGASの`syncSellerList`（10分トリガー）が担う。`EnhancedAutoSyncService`の`updateSingleSeller`メソッドへの追加は、GASからのAPIコール時に使用される。
