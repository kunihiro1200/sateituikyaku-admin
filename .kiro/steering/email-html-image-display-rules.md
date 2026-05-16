---
inclusion: auto
---

# メールHTML画像表示ルール（絶対に守ること）

## ⚠️ 最重要：sendBuyerEmail は絶対に書き直さない

`backend/src/services/EmailService.ts` の `sendBuyerEmail` メソッドは、**画像付きHTMLメールが正しく表示されるよう精密に調整されています。**
**このメソッドに手を加える場合は、以下のルールを全て守ること。**

---

## 🚨 2026年5月16日の事故

### 何が起きたか

1. 「他社物件新着配信」でメール本文に画像が表示されず、`<img src="...">` タグが**文字としてそのまま表示**された
2. KIROが原因を「`Content-Transfer-Encoding: quoted-printable`」と誤判断し、修正しようとした
3. その過程で**昨日動いていた重要なロジックを2つ削除**してしまった
4. 結果として問題がさらに悪化した

### 本当の原因（2つのロジックが必要）

#### ① `<img>` タグ検出ロジック（削除禁止）

```typescript
// 構造的なHTMLが含まれている場合はそのまま使用（改行変換しない）
const containsStructuralHtml = /<img|<div|<p|<span|<table|<td|<!DOCTYPE/i.test(linkedBody);
let htmlBody: string;
if (containsStructuralHtml) {
  htmlBody = linkedBody; // <img>等があればそのまま使う（改行変換すると壊れる）
} else {
  htmlBody = linkedBody.replace(/\n/g, '<br>');
}
```

**なぜ必要か**: `<img src="https://...">` を含む本文に `.replace(/\n/g, '<br>')` をかけると、タグの途中に `<br>` が挿入されてHTMLが破壊される。

#### ② `urlToLink` のタグ属性値内スキップ（削除禁止）

```typescript
// <img src="..."> など属性値の中にあるURLはスキップ
const lastTagOpen = before.lastIndexOf('<');
const lastTagClose = before.lastIndexOf('>');
if (lastTagOpen > lastTagClose) {
  return url; // タグの属性値の中にあるのでそのまま返す
}
```

**なぜ必要か**: `urlToLink` 関数がURLを `<a href="URL">URL</a>` に変換する際、`<img src="URL">` の `URL` 部分も変換してしまう。そうすると `src` 属性が壊れて画像が表示されなくなる。

---

## ✅ 動作確認済みの完全な sendBuyerEmail 実装（2026年5月16日）

以下が正しく動作するコード。**この構造を絶対に変えないこと。**

```typescript
async sendBuyerEmail(params: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  attachments?: Express.Multer.File[];
}): Promise<{ messageId: string; success: boolean; error?: string }> {

  const fromRaw = params.from || 'tenant@ifoo-oita.com';

  // ① From ヘッダーに会社名をRFC 2047エンコードで付加
  const encodeFromHeader = (f: string): string => { ... };
  const from = encodeFromHeader(fromRaw);

  // ② urlToLink: <a>タグ・<img>タグ属性値の中のURLはスキップ（削除禁止）
  const urlToLink = (inputText: string): string =>
    inputText.replace(/(https?:\/\/...)/g, (url, _group1, offset) => {
      const before = inputText.slice(0, offset);
      // <a>タグの中はスキップ
      if (before.lastIndexOf('<a ') > before.lastIndexOf('</a>')) return url;
      // タグ属性値の中はスキップ（<img src="...">, <a href="..."> など）
      if (before.lastIndexOf('<') > before.lastIndexOf('>')) return url;
      return `<a href="${url}">${url}</a>`;
    });

  const linkedBody = urlToLink(params.body);

  // ③ <img>等の構造的HTMLがあれば改行変換しない（削除禁止）
  const containsStructuralHtml = /<img|<div|<p|<span|<table|<td|<!DOCTYPE/i.test(linkedBody);
  const htmlBody = containsStructuralHtml
    ? linkedBody
    : linkedBody.replace(/\n/g, '<br>');

  // ④ base64エンコード（RFC 2045準拠: 76文字ごとに改行）
  const htmlBodyBase64 = Buffer.from(htmlBody, 'utf-8').toString('base64')
    .replace(/(.{76})/g, '$1\r\n');

  // ⑤ RFC 2822準拠: CRLFで結合、Content-Type: text/html
  const CRLF = '\r\n';
  const messageParts = [
    `From: ${from}`,
    `To: ${params.to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    htmlBodyBase64,
  ];
  rawMessage = messageParts.join(CRLF);
}
```

---

## 🚫 絶対にやってはいけないこと

### ❌ 禁止1: `containsStructuralHtml` チェックを削除する

```typescript
// ❌ これを削除すると <img> タグが壊れる
const htmlBody = linkedBody.replace(/\n/g, '<br>'); // ← <img>があると破壊される
```

### ❌ 禁止2: `urlToLink` のタグ属性値スキップを削除する

```typescript
// ❌ これを削除すると <img src="URL"> の URL が <a> タグに変換されて壊れる
const urlToLink = (text: string): string =>
  text.replace(/(https?:\/\/...)/g, (url) => `<a href="${url}">${url}</a>`);
  // ↑ スキップ処理なし → 属性値内のURLも変換されてしまう
```

### ❌ 禁止3: `Content-Transfer-Encoding: quoted-printable` に戻す

```typescript
// ❌ quoted-printableと宣言してもエンコードしなければ = を含むURLが壊れる
'Content-Transfer-Encoding: quoted-printable',
htmlBody, // ← エンコードせずそのまま → ?width=800&height=600 が文字化け
```

### ❌ 禁止4: 行区切りを `\n` に戻す

```typescript
// ❌ RFC 2822はCRLF必須。\nだとContent-Typeヘッダーが認識されずプレーンテキスト扱いになる
rawMessage = messageParts.join('\n');
```

### ❌ 禁止5: sendBuyerEmail を「参照せずに」書き直す

- このメソッドを変更する前に必ず現在のコードを全て読む
- 変更後は `containsStructuralHtml` チェックと `urlToLink` スキップが残っているか確認する

---

## 📋 sendBuyerEmail 変更時のチェックリスト

- [ ] `containsStructuralHtml` チェックが残っているか？
- [ ] `urlToLink` にタグ属性値スキップ（`lastTagOpen > lastTagClose`）が残っているか？
- [ ] `Content-Transfer-Encoding: base64` になっているか？（`quoted-printable` ではない）
- [ ] 行区切りが `\r\n`（CRLF）になっているか？（`\n` ではない）
- [ ] `htmlBodyBase64` が `.replace(/(.{76})/g, '$1\r\n')` で76文字改行されているか？
- [ ] テスト送信して画像が正しく表示されるか確認したか？

---

## 🔴 画像が文字で表示される症状が出たら

### まず確認すること

1. `sendBuyerEmail` の `containsStructuralHtml` チェックが消えていないか？
2. `urlToLink` のタグ属性値スキップが消えていないか？
3. `Content-Transfer-Encoding` が `base64` になっているか？
4. 行区切りが `\r\n` になっているか？

### 正しいコミットに戻す場合

```bash
# 動作確認済みのコミット
git checkout 14a88752 -- backend/src/services/EmailService.ts
```

---

## 📊 関連コミット履歴

| コミット | 内容 | 結果 |
|---------|------|------|
| `866e4383` | `urlToLink` にタグ属性値スキップを追加 | ✅ 画像表示成功 |
| `7848dfc0` | `quoted-printable` → `base64` に変更（KIROミス: 重要ロジック削除） | ❌ 画像文字化け悪化 |
| `4158cc79` | CRLF・76文字改行を追加（KIROミス: 重要ロジックまだ削除中） | ❌ まだ壊れている |
| `14a88752` | 削除されたロジックを復元 + CRLF/base64/76文字改行を維持 | ✅ 完全に正常動作 |

---

**最終更新日**: 2026年5月16日
**作成理由**: sendBuyerEmailの重要ロジック削除による画像文字化け事故の再発防止
**動作確認済みコミット**: `14a88752`
