# ENCRYPTION_KEY 保護ルール（絶対に守るべきルール）

## ⚠️ 最重要：ENCRYPTION_KEYは絶対に変更しない

**ENCRYPTION_KEYを変更すると、データベースに保存されている全ての暗号化データが復号できなくなります。**

---

## 🚨 絶対に禁止

- ❌ **ENCRYPTION_KEYの文字を追加・削除・変更してはいけない**
- ❌ **「32文字にするため」などの理由でキーを変更してはいけない**
- ❌ **ユーザーにENRYPTION_KEYの変更を指示してはいけない**

---

## 📋 仕様

**ファイル**: `backend/src/utils/encryption.ts`

**アルゴリズム**: AES-256-GCM

**キー長**: 正確に **32文字**（UTF-8）

```typescript
const KEY_LENGTH = 32;

if (key.length !== KEY_LENGTH) {
  throw new Error(`ENCRYPTION_KEY must be exactly ${KEY_LENGTH} characters`);
}
```

**暗号化対象フィールド**（売主テーブル）:
- `name`（名前）
- `phone_number`（電話番号）
- `email`（メールアドレス）

---

## 🔴 過去の失敗事例（2026年2月）

**何が起きたか**:
- KIROがユーザーに「ENCRYPTION_KEYのUを削除してください」と誤って指示した
- ユーザーが `1rJEtoCusAIMzyR86P6TQr0ND600D/dU` → `1rJEtoCusAIMzyR86P6TQr0ND600D/d` に変更
- 全売主の名前・電話番号・メールが文字化け（暗号化されたBase64文字列がそのまま表示）

**影響**:
- 売主リストの名前が `acLCZeMGRDaf/DM8rFZBircz+...` のような文字列で表示された
- 全データが読めない状態になった

**解決方法**:
- Vercelの環境変数で `ENCRYPTION_KEY` を元の値（`U` を含む32文字）に戻す
- Redeployするだけで復旧（データ自体は壊れていない）

---

## ✅ 正しい対応

ENCRYPTION_KEYに関する問題が発生した場合：

1. **絶対にキーを変更しない**
2. 現在のキーが正しく設定されているか確認する
3. Vercelの環境変数に正確に設定されているか確認する
4. キーの前後に余分なスペースがないか確認する（`.trim()` は実装済み）

---

## まとめ

**ENCRYPTION_KEYは一度設定したら永久に変更しない。**

変更した瞬間に全暗号化データが読めなくなる。

---

**最終更新日**: 2026年2月28日
**作成理由**: KIROが誤ってENRYPTION_KEYの変更を指示し、全売主データが文字化けした事故を防ぐため
