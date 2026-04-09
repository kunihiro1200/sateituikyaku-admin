---
inclusion: manual
---

# カレンダー送信400エラー修正記録

## 修正日
2026年4月8日

## 問題
売主リストと買主リストでカレンダー送信時に400エラーが発生。特定のアカウント（yurine~、mariko~など）でのみ発生。

## 根本原因
1. **カレンダーURLの二重エンコード問題**：`encodeURIComponent()`でエンコード後、`.replace(/%/g, '')`で%記号を削除していたため、URLが壊れていた
2. **営業担当/後続担当のカレンダーに作成されない問題**：`srcParam`が実装されていなかったため、ログインユーザーのカレンダーにイベントが作成されていた

## 修正内容

### 1. カレンダーURLの二重エンコード問題を修正（コミット: ee918d58）
- `encodeURIComponent()`を削除（`URLSearchParams`が自動的にエンコードするため）
- `.replace(/%/g, '')`を削除（これがURLを壊していた原因）

**修正前**:
```typescript
const calTitle = encodeURIComponent(`【訪問】${propertyAddress}`);
const calParams = new URLSearchParams({
  text: calTitle.replace(/%/g, ''),  // ❌ URLが壊れる
});
```

**修正後**:
```typescript
const calTitle = `【訪問】${propertyAddress}`;
const calParams = new URLSearchParams({
  text: calTitle,  // ✅ URLSearchParamsが自動的にエンコード
});
```

### 2. 売主訪問予約カレンダー送信を営担のカレンダーに直接作成（コミット: ab1de80c）
- `srcParam`を追加して、営業担当のカレンダーに直接イベントを作成

**修正内容**:
```typescript
// 営担のカレンダーに直接作成（srcパラメータを使用）
const srcParam = assignedEmail ? `&src=${encodeURIComponent(assignedEmail)}` : '';

window.open(
  `https://calendar.google.com/calendar/render?${calParams.toString()}${srcParam}`,
  '_blank'
);
```

### 3. 買主内覧カレンダー送信を後続担当のカレンダーに直接作成（コミット: 46a1e4fd）
- 買主リストにも`srcParam`を追加（以前実装されていたが、削除されていた）

## 影響を受けたアカウント
- yurine~ (R: 木村)
- mariko~
- yuuko~
- tenma~
- hiromitsu~
- jyuna~
- karen~

## テスト結果
- ✅ 全アカウントでカレンダー送信成功
- ✅ 営業担当/後続担当のカレンダーに正しくイベントが作成される
- ✅ 文字化けなし
- ✅ 400エラーなし

## 関連ファイル
- `frontend/frontend/src/pages/CallModePage.tsx` - 売主訪問予約カレンダー送信
- `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` - 買主内覧カレンダー送信
- `.kiro/specs/visit-assignee-calendar-error-fix/` - バグ修正spec
- `backend/src/__tests__/visit-assignee-calendar-error-bug-exploration.test.ts` - バグ探索テスト
- `backend/src/__tests__/visit-assignee-calendar-error-preservation.test.ts` - 保存テスト

## コミット番号
- **ee918d58** - カレンダーURLの二重エンコード問題を修正
- **ab1de80c** - 売主訪問予約カレンダー送信を営担のカレンダーに直接作成
- **46a1e4fd** - 買主内覧カレンダー送信を後続担当のカレンダーに直接作成

## 教訓
1. `URLSearchParams`は自動的にエンコードするため、`encodeURIComponent()`は不要
2. `.replace(/%/g, '')`は絶対に使用しない（URLを壊す）
3. `srcParam`を使用して、特定のユーザーのカレンダーに直接イベントを作成できる
4. Vercelのデプロイが完全に反映されるまで、数分～10分程度かかることがある

---

**最終更新日**: 2026年4月8日
**作成理由**: カレンダー送信400エラーの修正記録
