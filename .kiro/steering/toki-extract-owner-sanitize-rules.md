# 謄本読み取り（TokiExtract）所有者情報サニタイズルール

## ⚠️ 重要：AIの謄本OCRは所有者情報を誤って混入させることがある

Claude等のAIが登記簿謄本を読み取る際、`owner_address` と `owner_name` に余分な文字列が混入するケースがある。
**プロンプトだけでは防げないため、必ずバックエンドの後処理（sanitizeOwnerInfo）で対応すること。**

---

## 🚨 過去の障害

**発生日**: 2026年8月  
**症状**:
- A81（所有者住所）に氏名と「権利部」が混入: `山口市葵二丁目7番40号（シャーメゾンATTENDERⅡ棟201号）安平賢太郎権利部`
- C81（所有者氏名）に `（` の1文字だけが入る

**原因**: Claudeが登記簿のセクション見出し「権利部」を氏名の一部として認識し、住所フィールドに住所＋氏名＋見出しをすべて詰め込んでしまった

**修正**: `TokiExtractService.sanitizeOwnerInfo()` メソッドを追加し、全extractメソッドの返却前に適用

---

## 🔧 sanitizeOwnerInfo の仕様

**ファイル**: `backend/src/services/TokiExtractService.ts`

**処理内容**:
1. `owner_name` / `owner_address` から「権利部」「甲区」「乙区」等のセクション見出しを除去
2. `owner_name` が無効（空、1文字、括弧のみ等）の場合、`owner_address` の末尾から氏名を分離
   - マンション名の閉じ括弧 `）` の後に続く文字列を氏名として分離
   - 番地・号の後のスペース区切りで続く文字列を氏名として分離

**適用箇所（全4メソッド）**:
- `extractFromImages()` — マンション・区分所有（画像版）
- `extractFromPdf()` — マンション・区分所有（PDF版）
- `extractFromImagesForKodate()` 相当 — 戸建て版
- `extractFromImagesForTochi()` 相当 — 土地版

---

## 📋 除去されるセクション見出し一覧

```
権利部 / 甲区 / 乙区 / 表題部
所有権に関する事項 / 所有権以外の権利に関する事項
敷地権の目的である土地の表示 / 一棟の建物の表示 / 専有部分の建物の表示
```

---

## ⚠️ 注意：sanitizeOwnerInfo を削除・変更しないこと

- このメソッドはAIの出力ミスに対するセーフティネット
- プロンプトを改善しても `sanitizeOwnerInfo` は残しておくこと
- 新しいextractメソッドを追加する場合は必ず `sanitizeOwnerInfo` を呼び出すこと

---

**最終更新日**: 2026年8月  
**関連ファイル**: `backend/src/services/TokiExtractService.ts`
