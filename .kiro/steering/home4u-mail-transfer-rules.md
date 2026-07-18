---
inclusion: manual
---

# HOME4Uメール自動転記ルール

## 概要

HOME4Uからの査定依頼メールを検知してDBに自動転記する仕組みのルールです。

---

## 🔴 絶対に守るべきルール

### 1. HOME4Uメール検知は「件名部分一致」

**件名に `[HOME4U] 査定依頼` が含まれていれば全て対象。**

**地域ごとに件名を列挙する方式は廃止。絶対に戻さない。**

---

### 2. 転記条件（3つ全て必須）

1. 件名に `Re:` が付いている
2. 送信者が `tenant@ifoo-oita.com`（自分）
3. 本文に `HOME4Uログアウト` が含まれている

この3条件を満たすのはスタッフが手動でReplyしたメール1通のみ。
元のHOME4U通知メール（Re:なし・送信元=HOME4U）は転記しない。

---

### 3. phone_number_hash / email_hash は必ず登録する（重複検出に必須）

```typescript
phone_number_hash: tel ? crypto.createHash('sha256').update(tel).digest('hex') : null,
email_hash: email ? crypto.createHash('sha256').update(email).digest('hex') : null,
```

---

### 4. extractMemo（スタッフコメント抽出）の正しい実装

メール本文の構造：
```
HOME4Uログアウト
K 査定額によって訪問考える   ← スタッフメモ（この行を取得したい）
査定依頼
株式会社威風 担当者様
...
```

**正しい実装**：
```typescript
const extractMemo = (text: string): string => {
  // HOME4Uログアウトは本文中に複数回出現する場合があるので最後の出現を使う
  const parts = text.split('HOME4Uログアウト');
  if (parts.length < 2) return '';
  const afterLogout = parts[parts.length - 1]; // 最後の出現箇所の後
  // 「査定依頼」が現れる手前までを取得
  const beforeSateiIrai = afterLogout.split(/査定依頼/)[0];
  return beforeSateiIrai.trim();
};
```

**なぜ `[1]` ではなく `[-1]`（最後）か：**
- 元のHOME4Uメール本文にも `HOME4Uログアウト` リンクが含まれている
- Gmailのパートは古い順（元メール→返信）に並ぶ
- `split()[1]` は元メールのパートを返してしまいコメントが取れない
- `split()[-1]`（最後）は自分の返信パートを返す

---

### 5. mail_notify_server.py でのコメント事前確認（重要）

メール送信直後はGmailのパートがまだ揃っていない場合がある。
コメントが取れていない状態でINSERTするとコメントなしのレコードが登録される。

**対策：コメントが取れていない場合はスレッドを処理済みにせず次回チェックに委ねる。**

```python
# HOME4Uログアウトの最後の出現箇所を探す
logout_indices = [i for i, l in enumerate(body_lines) if 'HOME4Uログアウト' in l]
if logout_indices:
    last_logout_idx = logout_indices[-1]
    # HOME4Uログアウトの次の行から査定依頼までの間にコメントがあるか確認
    for line in body_lines[last_logout_idx+1:]:
        stripped = line.strip().lstrip('>').strip()
        if '査定依頼' in stripped:
            break
        if stripped:
            memo_found = True
            break

if not memo_found:
    # 処理済みにせず次回チェック（10秒後）に委ねる
    notified_ids.discard(msg_id)
    continue
```

**この処理を削除・変更してはいけない。**

---

### 6. decode_body の正しい実装

```python
# HOME4Uログアウトを含むパートが複数ある場合は最後のもの（自分の返信）を使う
home4u_parts = [p for p in collected if 'HOME4Uログアウト' in p]
if home4u_parts:
    return home4u_parts[-1]  # 最後（最新の返信）を返す
```

**なぜ最後か：** 元のHOME4Uメールにも `HOME4Uログアウト` が含まれるため、
最初のパートを使うと元メールの本文が返されコメントが取れない。

---

### 7. 重複スキップ時のコメント補完

スキップされた場合でも `memo` が取れていれば既存レコードに書き込む：

```typescript
const updatedComments = existingComments.includes(memo)
  ? existingComments          // 既にある → そのまま
  : memo + '\n' + existingComments;  // なければ先頭に追加
```

---

## 📁 関連ファイル

| ファイル | 役割 |
|---------|------|
| `mail_notify_server.py`（`sateituikyaku-mail-server` リポジトリ） | メール監視・HOME4U検知・API呼び出し（Railwayで稼働） |
| `backend/src/routes/home4u-transfer.ts` | DB転記・重複チェック・コメント抽出 |

⚠️ **`sateituikyaku-admin` だけにプッシュしてもRailwayには反映されない。**
必ず `sateituikyaku-mail-server` にもコピーしてプッシュすること。

---

## 🔧 問題・修正履歴

| 日付 | 問題 | 原因 | 修正 |
|------|------|------|------|
| 2026年5月30日 | HOME4Uメールが届いてもDBに転記されない | 件名完全一致リストに存在しない地域が来た | 件名部分一致に変更 |
| 2026年6月12日 | 重複マークが出ない | `insertData`に `phone_number_hash`/`email_hash` がなくnull | ハッシュを追加、既存1000件バックフィル |
| 2026年6月12日 | コメントが取得できない | `extractMemo`内で二重クリーン処理 | 内部の `cleaned` 処理を削除 |
| 2026年6月12日 | 全角スペース区切り項目が空 | `extractData2` の `\s*` が全角スペースにマッチしない | `[\s　]*` に変更 |
| 2026年6月24日 | コメントが取得できない（再発） | `split('HOME4Uログアウト')[1]` が元メールのパートを返していた（Gmailパートは古い順） | `split()[-1]`（最後のパート）を使うよう変更 |
| 2026年6月24日 | コメントが取得できない（再発） | メール送信直後はGmailパートが揃っておらずコメントなしでINSERTされる | コメントが取れない場合は処理済みにせず次回10秒チェックに委ねる |
| 2026年6月24日 | 重複スキップ時のコメント補完が動かない | `startsWith('\n【以下自動転記')` 条件が誤り（memoありの場合は先頭が違う） | `includes(memo)` で判定するよう変更 |

---

**最終更新日**: 2026年6月24日
