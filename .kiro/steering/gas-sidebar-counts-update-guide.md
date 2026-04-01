# GAS サイドバーカウント更新ガイド

## ⚠️ 重要：GASコードの更新手順

このドキュメントは、Google Apps Script（GAS）の `updateSidebarCounts_` 関数に新しいサイドバーカテゴリを追加する際の手順を説明します。

---

## 📋 背景

**問題**: サイドバーに新しいカテゴリを追加したが、表示されない

**根本原因**: GAS（Google Apps Script）が `seller_sidebar_counts` テーブルに新しいカテゴリを計算・挿入していない

**解決策**: GASコードの `updateSidebarCounts_` 関数に新しいカテゴリの計算ロジックを追加する

---

## 🚨 最重要：GASコードの更新は3ステップ

### ステップ1: `gas_complete_code.js` を更新

**ファイル**: `gas_complete_code.js`（プロジェクトルート）

**更新箇所**: `updateSidebarCounts_` 関数内の3箇所

1. **カウント変数の初期化**（`counts` オブジェクト）
2. **カテゴリ計算ロジック**（ループ内）
3. **Supabaseへの保存**（`upsertRows` 配列）

### ステップ2: Google Apps Scriptエディタにコピー＆ペースト

1. Google スプレッドシートを開く
2. 「拡張機能」→「Apps Script」を選択
3. `gas_complete_code.js` の内容を**全て**コピー
4. GASエディタに**全て**ペースト（既存コードを上書き）
5. 保存（Ctrl+S）

### ステップ3: 手動実行してテスト

1. GASエディタで `syncSellerList` 関数を選択
2. 「実行」ボタンをクリック
3. ログを確認（「実行ログ」タブ）
4. `seller_sidebar_counts` テーブルに新しいカテゴリが追加されたか確認

---

## 📝 実装例：3つの新カテゴリ（専任、一般、訪問後他決）

### 1. カウント変数の初期化

```javascript
var counts = {
  todayCall: 0, todayCallWithInfo: {}, todayCallAssigned: {},
  visitDayBefore: 0, visitCompleted: {}, visitAssigned: {}, unvaluated: 0,
  mailingPending: 0, todayCallNotStarted: 0, pinrichEmpty: 0,
  exclusive: 0,           // ← 新カテゴリ1: 専任
  general: 0,             // ← 新カテゴリ2: 一般
  visitOtherDecision: 0   // ← 新カテゴリ3: 訪問後他決
};
```

### 2. カテゴリ計算ロジック

```javascript
// 専任他決打合せカテゴリ（3つの新カテゴリ）
var exclusiveOtherDecisionMeeting = row['専任他決打合せ'] ? String(row['専任他決打合せ']) : '';
var contractYearMonth = formatDateToISO_(row['契約年月 他決は分かった時点']);

// 専任カテゴリ: 専任他決打合せ ≠ "完了" AND 次電日 ≠ 今日 AND 状況（当社） IN ("専任媒介", "他決→専任", "リースバック（専任）")
if (exclusiveOtherDecisionMeeting !== '完了' &&
    nextCallDate && nextCallDate !== todayStr &&
    (status === '専任媒介' || status === '他決→専任' || status === 'リースバック（専任）')) {
  counts.exclusive++;
}

// 一般カテゴリ: 専任他決打合せ ≠ "完了" AND 次電日 ≠ 今日 AND 状況（当社） = "一般媒介" AND 契約年月 >= "2025-06-23"
if (exclusiveOtherDecisionMeeting !== '完了' &&
    nextCallDate && nextCallDate !== todayStr &&
    status === '一般媒介' &&
    contractYearMonth && contractYearMonth >= generalCutoffDate) {
  counts.general++;
}

// 訪問後他決カテゴリ: 専任他決打合せ ≠ "完了" AND 次電日 ≠ 今日 AND 状況（当社） IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取") AND 営担 ≠ ""
if (exclusiveOtherDecisionMeeting !== '完了' &&
    nextCallDate && nextCallDate !== todayStr &&
    (status === '他決→追客' || status === '他決→追客不要' || status === '一般→他決' || status === '他社買取') &&
    isVisitAssigneeValid) {
  counts.visitOtherDecision++;
}
```

### 3. Supabaseへの保存

```javascript
var upsertRows = [];
var now = new Date().toISOString();
upsertRows.push({ category: 'todayCall', count: counts.todayCall, label: null, assignee: null, updated_at: now });
upsertRows.push({ category: 'visitDayBefore', count: counts.visitDayBefore, label: null, assignee: null, updated_at: now });
upsertRows.push({ category: 'unvaluated', count: counts.unvaluated, label: null, assignee: null, updated_at: now });
upsertRows.push({ category: 'mailingPending', count: counts.mailingPending, label: null, assignee: null, updated_at: now });
upsertRows.push({ category: 'todayCallNotStarted', count: counts.todayCallNotStarted, label: null, assignee: null, updated_at: now });
upsertRows.push({ category: 'pinrichEmpty', count: counts.pinrichEmpty, label: null, assignee: null, updated_at: now });
upsertRows.push({ category: 'exclusive', count: counts.exclusive, label: null, assignee: null, updated_at: now });           // ← 新カテゴリ1
upsertRows.push({ category: 'general', count: counts.general, label: null, assignee: null, updated_at: now });               // ← 新カテゴリ2
upsertRows.push({ category: 'visitOtherDecision', count: counts.visitOtherDecision, label: null, assignee: null, updated_at: now }); // ← 新カテゴリ3
```

---

## 🔍 カテゴリ条件の定義

### 専任カテゴリ (`exclusive`)

**条件**:
- `専任他決打合せ ≠ "完了"`
- `次電日 ≠ 今日`
- `状況（当社） IN ("専任媒介", "他決→専任", "リースバック（専任）")`

**GASコード**:
```javascript
if (exclusiveOtherDecisionMeeting !== '完了' &&
    nextCallDate && nextCallDate !== todayStr &&
    (status === '専任媒介' || status === '他決→専任' || status === 'リースバック（専任）')) {
  counts.exclusive++;
}
```

---

### 一般カテゴリ (`general`)

**条件**:
- `専任他決打合せ ≠ "完了"`
- `次電日 ≠ 今日`
- `状況（当社） = "一般媒介"`
- `契約年月 >= "2025-06-23"`

**GASコード**:
```javascript
if (exclusiveOtherDecisionMeeting !== '完了' &&
    nextCallDate && nextCallDate !== todayStr &&
    status === '一般媒介' &&
    contractYearMonth && contractYearMonth >= generalCutoffDate) {
  counts.general++;
}
```

**注意**: `generalCutoffDate` は `'2025-06-23'` として定義されています。

---

### 訪問後他決カテゴリ (`visitOtherDecision`)

**条件**:
- `専任他決打合せ ≠ "完了"`
- `次電日 ≠ 今日`
- `状況（当社） IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取")`
- `営担 ≠ ""`（かつ `営担 ≠ "外す"`）

**GASコード**:
```javascript
if (exclusiveOtherDecisionMeeting !== '完了' &&
    nextCallDate && nextCallDate !== todayStr &&
    (status === '他決→追客' || status === '他決→追客不要' || status === '一般→他決' || status === '他社買取') &&
    isVisitAssigneeValid) {
  counts.visitOtherDecision++;
}
```

**注意**: `isVisitAssigneeValid` は `visitAssignee && visitAssignee !== '外す'` として定義されています。

---

## 📊 テスト手順

### 1. GASエディタで手動実行

```
1. GASエディタを開く
2. 関数選択: syncSellerList
3. 「実行」ボタンをクリック
4. ログを確認
```

**期待されるログ**:
```
📊 サイドバーカウント更新開始...
✅ seller_sidebar_counts INSERT成功: XX件
📊 サイドバーカウント更新完了: 合計 XX行
```

### 2. データベースを確認

```bash
# backend/check-sidebar-counts-table.ts を実行
npx ts-node backend/check-sidebar-counts-table.ts
```

**期待される出力**:
```
✅ exclusive: 5 records
✅ general: 3 records
✅ visitOtherDecision: 2 records
```

### 3. フロントエンドで確認

```
1. ブラウザで売主リストページを開く
2. サイドバーに「専任」「一般」「訪問後他決」が表示されることを確認
3. カウント数が正しいことを確認
```

---

## 🚨 よくある間違い

### ❌ 間違い1: GASコードの一部だけを更新

```javascript
// ❌ 間違い（カウント変数を初期化したが、計算ロジックを追加していない）
var counts = {
  exclusive: 0,
  general: 0,
  visitOtherDecision: 0
};

// 計算ロジックがない → カウントは常に0
```

**正解**: 3箇所全てを更新する（初期化、計算ロジック、保存）

---

### ❌ 間違い2: `gas_complete_code.js` を更新したが、GASエディタにコピーしていない

```
gas_complete_code.js を更新 ✅
↓
GASエディタにコピー ❌ ← これを忘れた
↓
結果: サイドバーに表示されない
```

**正解**: `gas_complete_code.js` を更新したら、必ずGASエディタにコピー＆ペーストする

---

### ❌ 間違い3: 日付比較の形式が間違っている

```javascript
// ❌ 間違い（文字列比較ではなく、Date型で比較している）
if (nextCallDate !== today) { ... }

// ✅ 正しい（YYYY-MM-DD形式の文字列で比較）
if (nextCallDate !== todayStr) { ... }
```

---

## 📝 チェックリスト

新しいカテゴリを追加する前に、以下を確認してください：

- [ ] カテゴリの条件を明確に定義した
- [ ] `gas_complete_code.js` の3箇所を更新した
  - [ ] カウント変数の初期化
  - [ ] カテゴリ計算ロジック
  - [ ] Supabaseへの保存
- [ ] GASエディタにコピー＆ペーストした
- [ ] 手動実行してログを確認した
- [ ] データベースに新しいカテゴリが追加されたか確認した
- [ ] フロントエンドで表示されることを確認した

---

## 🚨 2026年4月2日の修正：次電日条件とvisitAssigned除外条件

### 問題1: 専任・一般・訪問後他決カテゴリのカウント不一致

**症状**: サイドバーのカウント数が一覧より2件少ない

**根本原因**: GASコードが `nextCallDate && nextCallDate !== todayStr` という条件を使用していたため、次電日が空の売主を除外していた

**修正内容**:
```javascript
// ❌ 変更前（次電日が空の売主を除外）
if (exclusiveOtherDecisionMeeting !== '完了' &&
    nextCallDate && nextCallDate !== todayStr &&
    ...) {
  counts.exclusive++;
}

// ✅ 変更後（次電日が空 OR 次電日≠今日）
if (exclusiveOtherDecisionMeeting !== '完了' &&
    (!nextCallDate || nextCallDate !== todayStr) &&
    ...) {
  counts.exclusive++;
}
```

**適用カテゴリ**: 専任、一般、訪問後他決の3カテゴリ全て

---

### 問題2: 担当(イニシャル)親カテゴリのカウント不一致

**症状**: サイドバーの「担当(Y)」等のカウント数が一覧と異なる

**根本原因**: GASコードが「他社買取」を除外していなかったが、フロントエンドは除外していた

**修正内容**:
```javascript
// ❌ 変更前（他社買取を除外していない）
if (isVisitAssigneeValid && 
    status.indexOf('一般媒介') === -1 && 
    status.indexOf('専任媒介') === -1 && 
    status.indexOf('追客不要') === -1) {
  counts.visitAssigned[vaKey] = (counts.visitAssigned[vaKey] || 0) + 1;
}

// ✅ 変更後（他社買取も除外）
if (isVisitAssigneeValid && 
    status.indexOf('一般媒介') === -1 && 
    status.indexOf('専任媒介') === -1 && 
    status.indexOf('追客不要') === -1 && 
    status.indexOf('他社買取') === -1) {
  counts.visitAssigned[vaKey] = (counts.visitAssigned[vaKey] || 0) + 1;
}
```

---

## 🎯 まとめ

**GASコードの更新は3ステップ**:

1. **`gas_complete_code.js` を更新**（3箇所）
2. **GASエディタにコピー＆ペースト**
3. **手動実行してテスト**

**絶対に忘れないこと**:
- ✅ 3箇所全てを更新する
- ✅ GASエディタにコピー＆ペーストする
- ✅ 手動実行してテストする

**このガイドを徹底することで、サイドバーカテゴリの追加を確実に行えます。**

---

**最終更新日**: 2026年4月2日  
**作成理由**: GASコードの更新手順を明確化し、同じ間違いを繰り返さないため
**更新履歴**:
- 2026年3月26日: 初版作成
- 2026年4月2日: 次電日条件の修正（次電日が空 OR 次電日≠今日）とvisitAssigned除外条件の修正（他社買取を追加）を追記

