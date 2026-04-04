# GAS修正時の安全ルール（絶対に守るべきルール）

## ⚠️ 最重要：既存の動作しているコードは絶対に触らない

**このルールを守らないと、以前機能していたものが壊れます。**

---

## 🚨 絶対に守るべきルール

### ルール1: 追加・修正箇所だけを触る

**❌ 間違ったアプローチ**:
```javascript
// 全体を書き直す
function syncBuyerList() {
  // 既存のコードを全て削除して、新しいコードを書く
  // ...
}
```

**✅ 正しいアプローチ**:
```javascript
// 既存のコードはそのまま残して、必要な箇所だけを追加・修正
function syncBuyerList() {
  // 既存のコード（触らない）
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('買主リスト');
  var data = sheet.getDataRange().getValues();
  
  // 既存のコード（触らない）
  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    var buyerNumber = row['買主番号'];
    
    // 既存のコード（触らない）
    var updateData = {};
    var needsUpdate = false;
    
    // 既存のフィールド処理（触らない）
    var sheetViewingMobile = row['内覧形態'] ? String(row['内覧形態']) : null;
    // ...
    
    // ✅ 新しいフィールド処理を追加（既存コードの後に追加）
    var sheetViewingTypeGeneral = row['内覧形態_一般媒介'] ? String(row['内覧形態_一般媒介']) : null;
    var normalizedSheetViewingTypeGeneral = normalizeValue(sheetViewingTypeGeneral);
    var normalizedDbViewingTypeGeneral = normalizeValue(dbBuyer.viewing_type_general);
    if (normalizedSheetViewingTypeGeneral !== normalizedDbViewingTypeGeneral) {
      updateData.viewing_type_general = normalizedSheetViewingTypeGeneral;
      needsUpdate = true;
    }
  }
}
```

---

### ルール2: 既存のロジックを変更しない

**❌ 間違い**:
```javascript
// 既存のロジックを「改善」しようとする
// 変更前
var sheetViewingMobile = row['内覧形態'] ? String(row['内覧形態']) : null;

// 変更後（❌ 既存のロジックを変更）
var sheetViewingMobile = row['内覧形態'] ? row['内覧形態'].trim() : null;
```

**✅ 正しい**:
```javascript
// 既存のロジックはそのまま残す
var sheetViewingMobile = row['内覧形態'] ? String(row['内覧形態']) : null;

// 新しいフィールドは新しいロジックで追加
var sheetViewingTypeGeneral = row['内覧形態_一般媒介'] ? String(row['内覧形態_一般媒介']) : null;
```

---

### ルール3: 既存の変数名を変更しない

**❌ 間違い**:
```javascript
// 変数名を「わかりやすく」変更
// 変更前
var sheetViewingMobile = row['内覧形態'];

// 変更後（❌ 変数名を変更）
var sheetViewingFormat = row['内覧形態'];
```

**✅ 正しい**:
```javascript
// 既存の変数名はそのまま
var sheetViewingMobile = row['内覧形態'];

// 新しいフィールドは新しい変数名で追加
var sheetViewingTypeGeneral = row['内覧形態_一般媒介'];
```

---

### ルール4: 既存の関数を変更しない

**❌ 間違い**:
```javascript
// 既存の関数を「改善」しようとする
function normalizeValue(value) {
  // 既存のロジックを変更
  if (value === null || value === undefined || value === '' || value === 'null') {
    return null;
  }
  return String(value).trim().toLowerCase(); // ❌ trim()とtoLowerCase()を追加
}
```

**✅ 正しい**:
```javascript
// 既存の関数はそのまま
function normalizeValue(value) {
  if (value === null || value === undefined || value === '' || value === 'null') {
    return null;
  }
  return String(value);
}

// 新しい関数が必要な場合は、新しい関数を作成
function normalizeValueTrimmed(value) {
  if (value === null || value === undefined || value === '' || value === 'null') {
    return null;
  }
  return String(value).trim();
}
```

---

### ルール5: 既存のコメントを削除しない

**❌ 間違い**:
```javascript
// 既存のコメントを削除
var sheetViewingMobile = row['内覧形態'] ? String(row['内覧形態']) : null;
```

**✅ 正しい**:
```javascript
// 内覧形態（既存のコメントを残す）
var sheetViewingMobile = row['内覧形態'] ? String(row['内覧形態']) : null;
```

---

## 📋 GAS修正時のチェックリスト

GASコードを修正する前に、以下を確認してください：

- [ ] 既存の動作しているコードを変更していないか？
- [ ] 追加・修正箇所だけを触っているか？
- [ ] 既存のロジックを変更していないか？
- [ ] 既存の変数名を変更していないか？
- [ ] 既存の関数を変更していないか？
- [ ] 既存のコメントを削除していないか？

**全てのチェックがOKの場合のみ、修正を進めてください。**

---

## 🎯 正しい修正手順

### ステップ1: 追加箇所を特定

**質問**:
- どのフィールドを追加するか？
- どこに追加するか？（既存のどのフィールドの後に追加するか？）

**例**:
- フィールド: `内覧形態_一般媒介`
- 追加箇所: `内覧形態`の処理の直後

---

### ステップ2: 既存のコードパターンをコピー

**既存のコードパターン**:
```javascript
// 内覧形態
var sheetViewingMobile = row['内覧形態'] ? String(row['内覧形態']) : null;
var normalizedSheetViewingMobile = normalizeValue(sheetViewingMobile);
var normalizedDbViewingMobile = normalizeValue(dbBuyer.viewing_mobile);
if (normalizedSheetViewingMobile !== normalizedDbViewingMobile) {
  updateData.viewing_mobile = normalizedSheetViewingMobile;
  needsUpdate = true;
  if (normalizedSheetViewingMobile === null && normalizedDbViewingMobile !== null) {
    Logger.log('  🗑️ ' + buyerNumber + ': 内覧形態を削除 (旧値: ' + normalizedDbViewingMobile + ')');
  }
}
```

**新しいコードパターン**（既存のパターンをコピーして変数名だけ変更）:
```javascript
// 内覧形態_一般媒介
var sheetViewingTypeGeneral = row['内覧形態_一般媒介'] ? String(row['内覧形態_一般媒介']) : null;
var normalizedSheetViewingTypeGeneral = normalizeValue(sheetViewingTypeGeneral);
var normalizedDbViewingTypeGeneral = normalizeValue(dbBuyer.viewing_type_general);
if (normalizedSheetViewingTypeGeneral !== normalizedDbViewingTypeGeneral) {
  updateData.viewing_type_general = normalizedSheetViewingTypeGeneral;
  needsUpdate = true;
  if (normalizedSheetViewingTypeGeneral === null && normalizedDbViewingTypeGeneral !== null) {
    Logger.log('  🗑️ ' + buyerNumber + ': 内覧形態_一般媒介を削除 (旧値: ' + normalizedDbViewingTypeGeneral + ')');
  }
}
```

---

### ステップ3: 既存のコードの直後に追加

**❌ 間違い**:
```javascript
// 既存のコードを削除して、新しいコードを追加
// 内覧形態_一般媒介
var sheetViewingTypeGeneral = row['内覧形態_一般媒介'] ? String(row['内覧形態_一般媒介']) : null;
// ...
```

**✅ 正しい**:
```javascript
// 既存のコード（そのまま残す）
// 内覧形態
var sheetViewingMobile = row['内覧形態'] ? String(row['内覧形態']) : null;
// ...

// 新しいコード（既存のコードの直後に追加）
// 内覧形態_一般媒介
var sheetViewingTypeGeneral = row['内覧形態_一般媒介'] ? String(row['内覧形態_一般媒介']) : null;
// ...
```

---

### ステップ4: テスト

**テスト手順**:
1. GASエディタに修正したコードをコピー＆ペースト
2. `syncBuyerList`関数を手動実行
3. 実行ログを確認
4. データベースを確認
5. ブラウザUIを確認

**確認ポイント**:
- [ ] 既存のフィールドが正しく同期されているか？
- [ ] 新しいフィールドが正しく同期されているか？
- [ ] エラーが発生していないか？

---

## 🚨 過去の失敗例

### 失敗例1: 既存のロジックを変更してしまった

**問題**: 内覧日の同期ロジックを「改善」しようとして、既存の動作を壊した

**原因**: 既存のロジックを変更した

**教訓**: 既存のロジックは絶対に変更しない

---

### 失敗例2: 既存の変数名を変更してしまった

**問題**: 変数名を「わかりやすく」変更したら、他の箇所でエラーが発生した

**原因**: 既存の変数名を変更した

**教訓**: 既存の変数名は絶対に変更しない

---

### 失敗例3: 既存の関数を変更してしまった

**問題**: `normalizeValue`関数を「改善」しようとして、全てのフィールドの同期が壊れた

**原因**: 既存の関数を変更した

**教訓**: 既存の関数は絶対に変更しない

---

## 💡 ベストプラクティス

### 1. 最小限の変更

**原則**: 必要最小限の変更だけを行う

**例**:
- ✅ 新しいフィールドを1つ追加する
- ❌ 既存のコードを全て書き直す

---

### 2. 既存のパターンを踏襲

**原則**: 既存のコードパターンをコピーして、変数名だけ変更する

**例**:
```javascript
// 既存のパターン
var sheetViewingMobile = row['内覧形態'] ? String(row['内覧形態']) : null;

// 新しいパターン（既存のパターンをコピー）
var sheetViewingTypeGeneral = row['内覧形態_一般媒介'] ? String(row['内覧形態_一般媒介']) : null;
```

---

### 3. コメントを追加

**原則**: 新しいコードには必ずコメントを追加する

**例**:
```javascript
// 内覧形態_一般媒介（2026年4月5日追加）
var sheetViewingTypeGeneral = row['内覧形態_一般媒介'] ? String(row['内覧形態_一般媒介']) : null;
```

---

### 4. デバッグログを追加

**原則**: 新しいフィールドにはデバッグログを追加する

**例**:
```javascript
if (normalizedSheetViewingTypeGeneral !== normalizedDbViewingTypeGeneral) {
  updateData.viewing_type_general = normalizedSheetViewingTypeGeneral;
  needsUpdate = true;
  Logger.log('  ✅ ' + buyerNumber + ': 内覧形態_一般媒介を更新 (' + normalizedDbViewingTypeGeneral + ' → ' + normalizedSheetViewingTypeGeneral + ')');
}
```

---

## 🎓 まとめ

**GAS修正時の鉄則**:

1. **既存の動作しているコードは絶対に触らない**
2. **追加・修正箇所だけを触る**
3. **既存のパターンをコピーして、変数名だけ変更する**
4. **最小限の変更だけを行う**
5. **テストを必ず実行する**

**このルールを徹底することで、既存の機能を壊さずに新しい機能を追加できます。**

---

**最終更新日**: 2026年4月5日  
**作成理由**: GAS修正時に既存の機能を壊してしまう問題が繰り返し発生しているため  
**関連ファイル**: 
- `gas_buyer_complete_code.js` - 買主リスト用GAS
- `gas_complete_code.js` - 売主リスト用GAS
