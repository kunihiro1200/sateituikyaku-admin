---
inclusion: manual
---

# GAS rowToObject関数の時刻列処理ルール（絶対に守るべきルール）

## ⚠️ 重要：時刻列のDate型処理

GASの `rowToObject` 関数でスプレッドシートのデータを読み取る際、**時刻列（●時間等）のDate型の値を日付文字列に変換してはいけません**。

**このルールを守らないと、時刻データが失われます。**

---

## 🚨 過去の問題（2026年4月5日）

### 問題の症状

買主7282の内覧時間（14:30:00）がデータベースに同期されず、ブラウザUIで表示されない。

### 根本原因

`rowToObject` 関数がDate型の値を**全て**日付文字列（YYYY/MM/DD）に変換していたため、時刻データ（14:30:00）が「1899/12/30」という日付文字列に変換されてしまった。

**間違っていたコード**:
```javascript
function rowToObject(headers, rowData) {
  var obj = {};
  for (var j = 0; j < headers.length; j++) {
    var headerName = String(headers[j]).trim();
    if (headerName === '') continue;
    var val = rowData[j];
    if (val instanceof Date) {
      if (val.getTime() === 0) {
        obj[headerName] = '';
      } else {
        // ❌ 間違い: 全てのDate型を日付文字列に変換
        obj[headerName] = val.getFullYear() + '/' +
          String(val.getMonth() + 1).padStart(2, '0') + '/' +
          String(val.getDate()).padStart(2, '0');
      }
    }
  }
  return obj;
}
```

**問題のデータフロー**:
```
スプレッドシートBP列（Date型: 1899/12/30 14:30:00）
  ↓
rowToObject関数で日付文字列に変換
  ↓
"1899/12/30" （時刻情報が失われる）
  ↓
時間変換ロジックで日付形式を検出
  ↓
null （日付形式は無視される）
  ↓
データベースに保存されない
```

### 影響

- 買主の内覧時間がデータベースに保存されない
- ブラウザUIで内覧時間が表示されない（プレースホルダー「例: 14:30」が表示される）
- GASの定期同期で時間データが削除される

---

## ✅ 正しい実装

### 修正後のコード

```javascript
function rowToObject(headers, rowData) {
  var obj = {};
  for (var j = 0; j < headers.length; j++) {
    var headerName = String(headers[j]).trim();
    if (headerName === '') continue;
    var val = rowData[j];
    if (val instanceof Date) {
      if (val.getTime() === 0) {
        obj[headerName] = '';
      } else {
        // 🚨 重要: ●時間列の場合は時刻部分のみを抽出（HH:MM:SS形式）
        if (headerName === '●時間') {
          var hours = val.getHours();
          var minutes = val.getMinutes();
          var seconds = val.getSeconds();
          obj[headerName] = String(hours).padStart(2, '0') + ':' + 
                           String(minutes).padStart(2, '0') + ':' + 
                           String(seconds).padStart(2, '0');
        } else {
          // 日付列の場合は日付部分のみを抽出（YYYY/MM/DD形式）
          obj[headerName] = val.getFullYear() + '/' +
            String(val.getMonth() + 1).padStart(2, '0') + '/' +
            String(val.getDate()).padStart(2, '0');
        }
      }
    } else {
      // 買主番号は必ず文字列型に変換
      if (headerName === '買主番号' && val !== null && val !== undefined && val !== '') {
        obj[headerName] = String(val);
      } else {
        obj[headerName] = val;
      }
    }
  }
  return obj;
}
```

**正しいデータフロー**:
```
スプレッドシートBP列（Date型: 1899/12/30 14:30:00）
  ↓
rowToObject関数で時刻部分のみを抽出
  ↓
"14:30:00" （HH:MM:SS形式の文字列）
  ↓
時間変換ロジックで秒を削除
  ↓
"14:30" （HH:MM形式）
  ↓
データベースに保存（viewing_time列）
```

---

## 📋 絶対に守るべきルール

### ルール1: 時刻列のDate型は時刻部分のみを抽出

**時刻列の例**:
- `●時間` （買主リスト）
- `訪問時間` （売主リスト）

**処理方法**:
```javascript
if (headerName === '●時間' || headerName === '訪問時間') {
  var hours = val.getHours();
  var minutes = val.getMinutes();
  var seconds = val.getSeconds();
  obj[headerName] = String(hours).padStart(2, '0') + ':' + 
                   String(minutes).padStart(2, '0') + ':' + 
                   String(seconds).padStart(2, '0');
}
```

### ルール2: 日付列のDate型は日付部分のみを抽出

**日付列の例**:
- `●内覧日(最新）` （買主リスト）
- `訪問日 Y/M/D` （売主リスト）
- `受付日` （買主リスト）

**処理方法**:
```javascript
else {
  // 日付列の場合は日付部分のみを抽出（YYYY/MM/DD形式）
  obj[headerName] = val.getFullYear() + '/' +
    String(val.getMonth() + 1).padStart(2, '0') + '/' +
    String(val.getDate()).padStart(2, '0');
}
```

### ルール3: 新しい時刻列を追加する際は必ず条件分岐を追加

**例**: 売主リストに「訪問時間」列を追加する場合

```javascript
// ✅ 正しい
if (headerName === '●時間' || headerName === '訪問時間') {
  // 時刻部分のみを抽出
}

// ❌ 間違い（条件分岐を追加しない）
if (headerName === '●時間') {
  // 時刻部分のみを抽出
}
// → 「訪問時間」が日付文字列に変換されてしまう
```

---

## 🚨 よくある間違い

### ❌ 間違い1: 全てのDate型を日付文字列に変換

```javascript
// ❌ 間違い
if (val instanceof Date) {
  obj[headerName] = val.getFullYear() + '/' +
    String(val.getMonth() + 1).padStart(2, '0') + '/' +
    String(val.getDate()).padStart(2, '0');
}
```

**問題**: 時刻列も日付文字列に変換されてしまう

---

### ❌ 間違い2: 時刻列の条件分岐を忘れる

```javascript
// ❌ 間違い
if (val instanceof Date) {
  if (val.getTime() === 0) {
    obj[headerName] = '';
  } else {
    // 時刻列の条件分岐がない
    obj[headerName] = val.getFullYear() + '/' +
      String(val.getMonth() + 1).padStart(2, '0') + '/' +
      String(val.getDate()).padStart(2, '0');
  }
}
```

**問題**: 時刻列が日付文字列に変換されてしまう

---

### ❌ 間違い3: 新しい時刻列を追加する際に条件分岐を追加しない

```javascript
// ❌ 間違い（「訪問時間」列を追加したが、条件分岐を追加していない）
if (headerName === '●時間') {
  // 時刻部分のみを抽出
} else {
  // 日付部分のみを抽出
  obj[headerName] = val.getFullYear() + '/' + ...;
}
```

**問題**: 「訪問時間」列が日付文字列に変換されてしまう

**正解**:
```javascript
// ✅ 正しい
if (headerName === '●時間' || headerName === '訪問時間') {
  // 時刻部分のみを抽出
} else {
  // 日付部分のみを抽出
}
```

---

## 📝 チェックリスト

`rowToObject` 関数を編集する前に、以下を確認してください：

- [ ] 時刻列（●時間、訪問時間等）の条件分岐が含まれているか？
- [ ] 時刻列のDate型は時刻部分のみを抽出しているか？（HH:MM:SS形式）
- [ ] 日付列のDate型は日付部分のみを抽出しているか？（YYYY/MM/DD形式）
- [ ] 新しい時刻列を追加する場合、条件分岐を追加したか？

---

## 🔍 デバッグ方法

### 症状：時刻データがデータベースに保存されない

**確認手順**:

1. **GASの実行ログを確認**
   ```
   [DEBUG] 時間（生データ）: 1899/12/30  ← ❌ 日付文字列になっている
   [DEBUG] 時間（変換後）: null          ← ❌ nullに変換されている
   ```

2. **`rowToObject` 関数を確認**
   - 時刻列の条件分岐が含まれているか？
   - 時刻部分のみを抽出しているか？

3. **修正**
   - 時刻列の条件分岐を追加
   - 時刻部分のみを抽出するロジックを追加

---

## 🎯 まとめ

**`rowToObject` 関数でDate型の値を処理する際の鉄則**:

1. **時刻列の場合**: 時刻部分のみを抽出（HH:MM:SS形式）
2. **日付列の場合**: 日付部分のみを抽出（YYYY/MM/DD形式）
3. **新しい時刻列を追加する場合**: 必ず条件分岐を追加

**このルールを徹底することで、時刻データが失われる問題を完全に防止できます。**

---

**最終更新日**: 2026年4月5日  
**作成理由**: 買主内覧時間同期問題の再発防止  
**関連ファイル**: 
- `gas_buyer_complete_code.js` - 買主リスト用GAS
- `gas_complete_code.js` - 売主リスト用GAS
- `.kiro/specs/buyer-viewing-date-immediate-sync-fix/` - Specファイル
