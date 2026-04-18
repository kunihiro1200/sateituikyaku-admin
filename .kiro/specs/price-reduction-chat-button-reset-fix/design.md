# 値下げCHATバー表示ロジック修正 デザイン

## Overview

`PriceSection.tsx` の `showChatButton` 計算式が壊れており、2種類のCHATバーの表示ロジックを正しく復元する。

**根本原因**：コミット `e7afe049` でオレンジのバーを追加した際に、元々の青いバーの表示条件（`isPriceChanged`）が削除され、`showChatButton = !isEditMode && !displayScheduledDate` という誤った条件になった。

## Glossary

- **青いバー**：売買価格変更時に表示されるCHAT送信バー。送信で「確認」フィールドが「未」になる重要なバー
- **オレンジのバー**：値下げ予約日をクリアした際に表示される値下げ通知用バー
- **isPriceChanged**：`editedData.price !== undefined && editedData.price !== salesPrice`
- **displayScheduledDate**：`editedData.price_reduction_scheduled_date !== undefined ? editedData.price_reduction_scheduled_date : priceReductionScheduledDate`
- **scheduledDateWasCleared**：値下げ予約日が一度入力された後に空欄にされたことを示すローカル状態（追加が必要）
- **chatSent**：オレンジのバーから送信完了後にバーを非表示にするためのローカル状態（追加が必要）

## Bug Details

### Bug Condition

`showChatButton = !isEditMode && !displayScheduledDate` という条件は、`isPriceChanged` チェックが欠落しているため：
1. 売買価格未変更でも全物件でバーが表示される
2. 青いバーとオレンジのバーが区別されない
3. 送信後のリセット処理がない

### Root Cause

コミット `e7afe049` で `showChatButton` の条件から `isPriceChanged` が削除された。
元の正しい条件（コミット `ea36a7a5` 時点）：
```typescript
// 青いバー：売買価格変更時のみ
const showChatButton = !isEditMode && !displayScheduledDate;
// ※ isPriceChanged は sx の色制御にのみ使用されていた
```

ただし、元のコードでは青いバーとオレンジのバーが1つのボタンで色だけ変わる設計だった。
今回の修正では、2つのバーを明確に分離する。

## Expected Behavior

### 表示ロジック

```
値下げ予約日あり → どちらも非表示
値下げ予約日なし かつ 編集モード → どちらも非表示
値下げ予約日なし かつ 非編集モード:
  ├─ scheduledDateWasCleared === true かつ chatSent === false → オレンジのバーを表示
  └─ isPriceChanged === true → 青いバーを表示
  （両方の条件が成立する場合はオレンジのバーを優先）
```

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/PriceSection.tsx`

#### 変更1：ローカル状態変数の追加

```typescript
const [chatSent, setChatSent] = useState(false);
const [scheduledDateWasCleared, setScheduledDateWasCleared] = useState(false);
```

#### 変更2：displayScheduledDate の変化を監視

値下げ予約日が空欄になった（かつ以前は値があった）場合に `scheduledDateWasCleared` を true にする。
また、値下げ予約日に値が設定された場合はリセットする。

```typescript
const prevScheduledDateRef = useRef<string | null | undefined>(displayScheduledDate);

useEffect(() => {
  const prev = prevScheduledDateRef.current;
  const current = displayScheduledDate;
  
  // 値があった → 空欄になった場合
  if (prev && !current) {
    setScheduledDateWasCleared(true);
    setChatSent(false);
  }
  // 空欄 → 値が設定された場合（リセット）
  if (!prev && current) {
    setScheduledDateWasCleared(false);
    setChatSent(false);
  }
  
  prevScheduledDateRef.current = current;
}, [displayScheduledDate]);
```

#### 変更3：表示条件の分離

```typescript
// オレンジのバー：値下げ予約日をクリアした場合のみ
const showOrangeChatButton = !isEditMode && !displayScheduledDate && scheduledDateWasCleared && !chatSent;

// 青いバー：売買価格が変更された場合（オレンジが表示されていない場合のみ）
const showBlueChatButton = !isEditMode && !displayScheduledDate && isPriceChanged && !showOrangeChatButton;
```

#### 変更4：オレンジのバー送信成功後に chatSent を true に設定

```typescript
const handleSendPriceReductionChat = async () => {
  // ... 既存の送信処理 ...
  
  // 送信成功後
  onChatSendSuccess('値下げ通知を送信しました');
  setChatSent(true);  // ← 追加：オレンジのバーを非表示にする
  setSelectedImageUrl(undefined);
  setChatMessageBody('');
};
```

#### 変更5：JSXの分離

現在の `{showChatButton && (...)}` を2つのブロックに分ける：

```tsx
{/* オレンジのバー：値下げ予約日クリア時の通知用 */}
{showOrangeChatButton && (
  <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #ddd' }}>
    <Button
      fullWidth
      variant="contained"
      onClick={() => { /* 既存のダイアログ開く処理 */ }}
      disabled={sendingChat || !getLatestPriceReduction()}
      sx={{
        backgroundColor: isPriceChanged ? '#e65100' : '#f57c00',
        '&:hover': { backgroundColor: isPriceChanged ? '#bf360c' : '#e65100' },
        fontSize: '0.75rem',
        fontWeight: 'bold',
        animation: isPriceChanged ? 'pulse 2s infinite' : 'none',
        '@keyframes pulse': {
          '0%': { boxShadow: '0 0 0 0 rgba(230, 81, 0, 0.7)' },
          '70%': { boxShadow: '0 0 0 10px rgba(230, 81, 0, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(230, 81, 0, 0)' },
        },
      }}
    >
      {sendingChat ? '送信中...' : '物件担当へCHAT送信（画像添付可能）'}
    </Button>
  </Box>
)}

{/* 青いバー：売買価格変更時の通知用（確認フィールドを「未」にリセット） */}
{showBlueChatButton && (
  <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #ddd' }}>
    <Button
      fullWidth
      variant="contained"
      onClick={() => { /* 既存のダイアログ開く処理 */ }}
      disabled={sendingChat || !getLatestPriceReduction()}
      sx={{
        backgroundColor: '#1976d2',
        '&:hover': { backgroundColor: '#1565c0' },
        fontSize: '0.75rem',
        fontWeight: 'bold',
      }}
    >
      {sendingChat ? '送信中...' : 'CHAT送信'}
    </Button>
  </Box>
)}
```

## Testing Strategy

### Correctness Properties

**Property 1**: オレンジのバーは「値下げ予約日をクリアした場合のみ」表示される
- `scheduledDateWasCleared === false` の場合、オレンジのバーは表示されない
- `displayScheduledDate` に値がある場合、オレンジのバーは表示されない

**Property 2**: 青いバーは「売買価格が変更された場合のみ」表示される
- `isPriceChanged === false` の場合、青いバーは表示されない
- オレンジのバーが表示されている場合、青いバーは表示されない

**Property 3**: オレンジのバー送信後は青いバーに切り替わる
- `chatSent === true` の場合、オレンジのバーは非表示
- `isPriceChanged === true` かつ `chatSent === true` の場合、青いバーが表示される

**Property 4**: 青いバーの送信は「確認」フィールドを「未」にリセットする（既存動作の保全）
- `handlePriceChatSendSuccess` が呼ばれることで `confirmation` が「未」になる
