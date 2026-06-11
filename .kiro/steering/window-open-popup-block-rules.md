---
inclusion: manual
---



# window.open ポップアップブロック防止ルール

## ⚠️ 絶対に守るべきルール

**`window.open` は `await` より前に呼ぶこと。**

---

## 🔴 問題の背景（2026年5月30日）

通話モードページの訪問予約「保存」ボタンを押すと、Googleカレンダーが開かなくなった。

### 原因

ブラウザは `async/await` 関数の中で `await` を挟んだ後に呼ばれる `window.open` を  
**「ユーザー操作から切り離された処理」** と判断してポップアップブロックする。

```typescript
// ❌ 絶対にやってはいけない（ポップアップブロックされる）
async function handleSave() {
  await api.put('/api/...')   // ← ここで「ユーザー操作」が切れる
  window.open(calendarUrl, '_blank')  // ← ブロックされる
}

// ❌ これもNG（awaitが挟まる）
async function handleSave() {
  const freshEmployees = await getActiveEmployees()  // ← awaitが挟まる
  window.open(calendarUrl, '_blank')  // ← ブロックされる
}
```

```typescript
// ✅ 正しい（awaitより前にwindow.openを呼ぶ）
async function handleSave() {
  window.open(calendarUrl, '_blank')  // ← await前なのでブロックされない
  await api.put('/api/...')           // ← その後で保存
}
```

---

## 📋 具体的なルール

### ルール1: window.open は async 関数内の最初の await より前に呼ぶ

```typescript
// ✅ 正しいパターン
const handleSaveAppointment = async () => {
  // 1. まず同期的な処理でURLを生成
  const calendarUrl = buildCalendarUrl(...)

  // 2. window.open を先に呼ぶ（awaitより前）
  if (calendarUrl) {
    window.open(calendarUrl, '_blank')
  }

  // 3. その後でawaitを使った保存処理
  await api.put('/api/sellers/...', data)
}
```

### ルール2: window.open の前に await を使う処理が必要な場合は分離する

```typescript
// ✅ 正しいパターン（データ取得が必要な場合）
const handleSaveAppointment = async () => {
  // employees はページロード時に取得済みのステートを使う（awaitしない）
  const empList = employees.length > 0 ? employees : (() => {
    try {
      const c = localStorage.getItem('employees_cache_v2')
      return c ? JSON.parse(c).data || [] : []
    } catch { return [] }
  })()

  // window.open を先に呼ぶ
  window.open(calendarUrl, '_blank')

  // その後でawait
  await api.put(...)
}
```

### ルール3: anchor.click() は window.open の代替にならない

```typescript
// ❌ これもポップアップブロックされる（awaitの後だから）
const link = document.createElement('a')
link.href = calendarUrl
link.target = '_blank'
document.body.appendChild(link)
link.click()  // ← awaitの後なのでブロックされる
document.body.removeChild(link)
```

---

## 🔍 チェックリスト

`window.open` を使うコードを書く・修正する前に確認：

- [ ] `window.open` の前に `await` が1つでもあるか？
  - ある → `window.open` を `await` より前に移動する
- [ ] `window.open` の前に `await getActiveEmployees()` などの非同期取得があるか？
  - ある → `employees` ステートまたは `localStorage` キャッシュから同期的に取得する
- [ ] `loadAllData()` を呼んだ後に `window.open` を呼んでいるか？
  - ある → `loadAllData()` より前に `window.open` を移動する

---

## 📍 現在の実装（CallModePage.tsx）

`handleSaveAppointment` 関数の冒頭（`await api.put` より前）でカレンダーを開く：

```typescript
const handleSaveAppointment = async (keepEditing: boolean = false) => {
  // ...前処理（awaitなし）...

  // ===== カレンダーを先に開く（await より前）=====
  if (visitDateTimeStr && assignedToSnapshot) {
    window.open(calendarUrl, '_blank')  // ← ここ
  }
  // ===== カレンダーここまで =====

  // その後でawaitを使った保存処理
  const updateResponse = await api.put(`/api/sellers/${id}`, { ... })
  // ...
}
```

---

## 🚫 やってはいけない変更

以下の変更を行うと再びカレンダーが開かなくなる：

1. `window.open` を `await api.put` の後に移動する
2. `window.open` の前に `await getActiveEmployees()` を追加する
3. `window.open` の前に `await loadAllData()` を追加する
4. `window.open` を `anchor.click()` に置き換える（awaitの後なら同じ問題が起きる）

---

## 📝 変更履歴

| 日付 | 問題 | 原因 | 修正 |
|------|------|------|------|
| 2026年5月30日 | 訪問予約保存後にカレンダーが開かない | `await api.put` の後に `window.open` を呼んでいた | `window.open` を `await` より前に移動 |
| 2026年5月30日 | 同上（再発） | `await getActiveEmployees()` を `window.open` の前に追加した | `await` を除去してキャッシュから同期取得に変更 |

---

**最終更新日**: 2026年5月30日  
**作成理由**: 訪問予約保存後のGoogleカレンダー自動オープンが繰り返し壊れた問題の再発防止
