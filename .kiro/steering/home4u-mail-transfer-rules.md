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
2. `backend/src/routes/sellers.ts` の `/api/sellers/home4u-transfer`（バックエンド側）

**どちらか一方を削除・変更してはいけない。二重チェックが安全性の担保。**

---

## 📁 関連ファイル

| ファイル | 役割 |
|---------|------|
| `mail_notify_server.py` | メール監視・HOME4U検知・API呼び出し |
| `backend/src/routes/sellers.ts` | `/api/sellers/home4u-transfer` エンドポイント |

---

## ✅ 正しい実装（mail_notify_server.py）

```python
# HOME4Uは件名部分一致で検知
HOME4U_SUBJECT_PREFIX = "[HOME4U] 査定依頼"

# SUBJECT_KEYWORDSにも部分一致キーワードとして登録
SUBJECT_KEYWORDS = [
    "【イエウール】不動産査定依頼のお知らせ",
    "[HOME4U] 査定依頼",  # 部分一致
    "【すまいステップ 反響通知メール】",
    ...
]

# subject_matches関数での部分一致処理
def subject_matches(subject, keyword):
    if keyword == "【すまいステップ 反響通知メール】":
        return subject.startswith(keyword)
    if keyword == "[HOME4U] 査定依頼":
        return keyword in subject  # 部分一致
    return subject == keyword

# 転記前に本文チェック
elif HOME4U_SUBJECT_PREFIX in subject:
    if 'HOME4Uログアウト' in body:
        trigger_home4u_transfer(body)
    else:
        logging.info("スキップ: HOME4Uだが本文に「HOME4Uログアウト」なし")
```

---

## ❌ 絶対にやってはいけないこと

```python
# ❌ 地域ごとに件名を列挙する方式（廃止済み）
HOME4U_SUBJECTS = [
    "[HOME4U] 査定依頼 -- <大分県> 別府市",
    "[HOME4U] 査定依頼 -- <大分県> 大分市",
    "[HOME4U] 査定依頼 -- <福岡県> 福岡市東区",
    ...  # 新しい地域が来るたびに追加が必要 → 転記漏れの原因
]

# ❌ 本文チェックなしで転記する
elif HOME4U_SUBJECT_PREFIX in subject:
    trigger_home4u_transfer(body)  # HOME4Uログアウトチェックなし → 誤転記の危険
```

---

## 🔧 過去の問題と修正履歴

| 日付 | 問題 | 原因 | 修正 |
|------|------|------|------|
| 2026年5月30日 | HOME4Uメールが届いてもDBに転記されない | `HOME4U_SUBJECTS`リストに存在しない地域の件名が来た | 件名の完全一致リストを廃止し、`[HOME4U] 査定依頼` の部分一致に変更 |

---

## まとめ

1. **HOME4U検知 = 件名に `[HOME4U] 査定依頼` が含まれる（部分一致）**
2. **転記条件 = 本文に `HOME4Uログアウト` が含まれる（絶対条件）**
3. **地域ごとの件名リストは廃止。絶対に復活させない。**

---

**最終更新日**: 2026年5月30日  
**作成理由**: HOME4Uメール転記漏れ（地域リスト未登録）の再発防止
