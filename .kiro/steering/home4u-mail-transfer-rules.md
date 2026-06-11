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

- ✅ `[HOME4U] 査定依頼 -- <大分県> 大分市`
- ✅ `[HOME4U] 査定依頼 -- <大分県> 別府市`
- ✅ `[HOME4U] 査定依頼 -- <福岡県> 福岡市早良区`
- ✅ `[HOME4U] 査定依頼 -- <大分県> 中津市`（新しい地域も自動対応）

**地域ごとに件名を列挙する方式は廃止。絶対に戻さない。**

---

### 2. 本文に「HOME4Uログアウト」が含まれることが絶対条件

HOME4Uメールを転記する前に、**必ず本文に `HOME4Uログアウト` が含まれているか確認する。**

- ✅ 含まれている → `home4u-transfer` APIを呼び出す
- ❌ 含まれていない → スキップ（転記しない）

この条件は**2箇所**でチェックされている：
1. `mail_notify_server.py`（メール監視サーバー側）
2. `backend/src/routes/home4u-transfer.ts`（バックエンド側）

**どちらか一方を削除・変更してはいけない。二重チェックが安全性の担保。**

---

### 3. phone_number_hash / email_hash は必ず登録する（重複検出に必須）

`home4u-transfer.ts` の `insertData` に以下が**必ず含まれていること**：

```typescript
phone_number_hash: tel ? crypto.createHash('sha256').update(tel).digest('hex') : null,
email_hash: email ? crypto.createHash('sha256').update(email).digest('hex') : null,
```

**これがないと重複検出エンドポイント（`GET /:id/duplicates`）が一切機能しない。**
重複検出はハッシュ比較に依存しており、ハッシュが `null` だと即座に空配列を返す。

---

### 4. extractMemo（スタッフコメント抽出）の正しい実装

「HOME4Uログアウト」の直後の行にあるスタッフメモをコメントとして取得する。

**正しい実装**：
```typescript
const extractMemo = (text: string): string => {
  // cleanedBodyは既に行頭の「> 」を除去済みなので再処理不要
  const afterLogout = text.split('HOME4Uログアウト')[1];
  if (!afterLogout) return '';
  // 「査定依頼」が現れる手前までを取得
  const beforeSateiIrai = afterLogout.split(/査定依頼/)[0];
  return beforeSateiIrai.trim();
};
```

**❌ やってはいけない（過去の間違い）**：
```typescript
// cleanedBodyを受け取っているのに、さらに内部でcleanedを作ると
// \sが改行を含むため「HOME4Uログアウト」の前後が変形してsplitがマッチしなくなる
const cleaned = text.replace(/^[>\s]*/gm, '');
```

---

## 🔴🔴 繰り返し発生したトラブルの全経緯（2026年6月）

**この経緯を把握せずにhome4u-transfer.tsを修正してはいけない。**
過去に以下の失敗サイクルが繰り返された。

### サイクルの説明

**① 同一案件がDBに2件重複登録される**
- HOME4Uは1つの査定依頼を複数社に同時配信する
- 数秒〜数分以内に同じ内容のメールが複数届く
- 重複チェックが甘いと2件登録される

**② コメントが取得できない**
- 1通目（コメントなし）が先に登録される
- 2通目（コメントあり：スタッフが「HOME4Uログアウト」の下に書いたメモ）が重複チェックでスキップされる
- 結果：DBにコメントなしのレコードが残る

**③ 重複解消を試みると今度はコメントなしの1通だけが来る**
- 重複を防ぐためにチェックを厳しくすると、コメント入りの通が取れなくなる

**④ 重複チェックのphone_number_hashをnullにしたことで本来の重複が検出されなくなる**
- FI496とFI459のように、同一人物が異なるタイミングで申し込んだ本当の重複が、
  重複マークとして表示されなくなった
- 原因：`insertData`に `phone_number_hash` が含まれていなかった（2026年6月12日修正済み）

---

## ✅ 2026年6月12日時点の修正済み状態

| 問題 | 修正内容 | ファイル |
|------|---------|---------|
| 重複マークが出ない | `phone_number_hash`/`email_hash` を `insertData` に追加 | `home4u-transfer.ts` |
| 既存レコードのハッシュがnull | バックフィルスクリプトで1000件補完（16件修正） | スクリプト実行済み |
| コメント抽出の失敗 | `extractMemo`内の二重クリーン処理を削除 | `home4u-transfer.ts` |
| extractData2の全角スペース対応 | `[\s　]*` に変更 | `home4u-transfer.ts` |

---

## ✅ コメント（スタッフメモ）取得の仕組み

メール本文の構造：
```
HOME4Uログアウト
林5/26　不通・留守×        ← ここがスタッフメモ（extractMemoで取得）
査定依頼 株式会社威風...
■物件所在地 ...
```

`extractMemo` は「HOME4Uログアウト」と「査定依頼」の間の文字列をメモとして取得する。
スタッフメモがない場合は空文字になり、コメント欄は自動転記情報のみになる。

---

## ✅ 重複スキップ時のコメント補完仕組み

1通目（コメントなし）が登録済みで、2通目（コメントあり）が重複スキップされる場合、
スキップ処理の中でコメントを既存レコードに書き込む：

```typescript
// 既存commentsが「\n【以下自動転記（HOME4U）】」で始まっている場合のみメモを先頭に追加
const updatedComments = existingComments.startsWith('\n【以下自動転記')
  ? memoForUpdate + existingComments
  : existingComments; // 既にメモがある場合は上書きしない
```

**この仕組みを削除・変更してはいけない。**

---

## 📁 関連ファイル

| ファイル | 役割 |
|---------|------|
| `mail_notify_server.py` | メール監視・HOME4U検知・API呼び出し（Railwayで稼働） |
| `backend/src/routes/home4u-transfer.ts` | DB転記・重複チェック・コメント抽出 |

---

## ✅ 正しい実装（mail_notify_server.py）

```python
# HOME4Uは件名部分一致で検知
HOME4U_SUBJECT_PREFIX = "[HOME4U] 査定依頼"

# 転記前に本文チェック
elif HOME4U_SUBJECT_PREFIX in subject:
    if 'HOME4Uログアウト' in body:
        trigger_home4u_transfer(body)
    else:
        logging.info("スキップ: HOME4Uだが本文に「HOME4Uログアウト」なし")
```

---

## ❌ 絶対にやってはいけないこと

- **地域ごとに件名を列挙する方式に戻さない**（転記漏れの原因）
- **`phone_number_hash`/`email_hash` を `insertData` から削除しない**（重複検出が壊れる）
- **`extractMemo` 内で `cleanedBody` を再クリーンしない**（コメントが取れなくなる）
- **重複スキップ時のコメント補完処理を削除しない**（コメントなしレコードが残る）

---

## 🔧 問題・修正履歴

| 日付 | 問題 | 原因 | 修正 |
|------|------|------|------|
| 2026年5月30日 | HOME4Uメールが届いてもDBに転記されない | `HOME4U_SUBJECTS`リストに存在しない地域の件名が来た | 件名の完全一致リストを廃止し、`[HOME4U] 査定依頼` の部分一致に変更 |
| 2026年6月12日 | FI496・FI459の重複マークが出ない | `insertData`に `phone_number_hash`/`email_hash` がなくハッシュがnull | `home4u-transfer.ts`に `crypto.createHash` でハッシュを追加、既存1000件をバックフィル |
| 2026年6月12日 | HOME4Uログアウト直後のスタッフコメントが取得できない | `extractMemo`内で `^[>\s]*` の二重クリーンを行い `HOME4Uログアウト` 前後が変形 | 内部の `cleaned` 処理を削除し `cleanedBody` をそのまま使用 |
| 2026年6月12日 | 査定理由等の全角スペース区切り項目が空になる | `extractData2` の `\s*` が全角スペース `　` にマッチしない | `[\s　]*` に変更 |

---

**最終更新日**: 2026年6月12日
**作成理由**: HOME4Uメール転記の繰り返しトラブルの全経緯を記録し、毎回最初から説明しなくて済むようにするため
