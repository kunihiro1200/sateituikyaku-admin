# Bugfix Requirements Document

## Introduction

売主一覧画面の検索バーで電話番号またはメールアドレスを入力してもヒットしないバグ。
電話番号・メールアドレスはいずれも `sellers` テーブルで AES-256-GCM 暗号化されて保存されているため、DB 側での LIKE 検索ができない。
現在の実装では全件スキャン（最新500件）後に復号して部分一致検索しているが、売主が500件を超えると古い売主が検索対象外になる。
`phone_number_hash` および `email_hash`（SHA-256）が既に DB に保存されているにもかかわらず活用されていない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが売主一覧の検索バーに電話番号（数字のみ）を入力して検索する THEN システムは `seller_number` の LIKE 検索を実行し、0件の場合のみ全件スキャン（最新500件）に進む

1.2 WHEN ユーザーが売主一覧の検索バーにメールアドレスを入力して検索する THEN システムは全件スキャン（最新500件）のみを実行し、`email_hash` による DB 検索を行わない

1.3 WHEN 全件スキャンが実行される THEN システムは `updated_at` 降順で最新500件のみを取得するため、500件より古い売主の電話番号・メールアドレスは検索対象外になる

1.4 WHEN 電話番号またはメールアドレスが検索対象外の売主を検索する THEN システムは0件を返し、実際に存在する売主がヒットしない（例: `tomoko.kunihiro@ifoo-oita.com` で検索しても AA18 がヒットしない）

### Expected Behavior (Correct)

2.1 WHEN ユーザーが売主一覧の検索バーに電話番号を入力して検索する THEN システムは入力値を SHA-256 ハッシュ化し、`phone_number_hash` カラムで DB 検索を行い、全件を対象に一致する売主を返す

2.2 WHEN ユーザーが売主一覧の検索バーにメールアドレスを入力して検索する THEN システムは入力値を SHA-256 ハッシュ化し、`email_hash` カラムで DB 検索を行い、全件を対象に一致する売主を返す

2.3 WHEN `phone_number_hash` または `email_hash` による検索で売主が見つかる THEN システムは該当売主を復号して返す

2.4 WHEN `phone_number_hash` または `email_hash` による検索で売主が見つからない THEN システムは全件スキャンにフォールバックして名前・住所等で検索する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが売主番号（AA12345 形式）で検索する THEN システムは CONTINUE TO `seller_number` の高速検索を実行して該当売主を返す

3.2 WHEN ユーザーが売主名（漢字・ひらがな等）で検索する THEN システムは CONTINUE TO 全件スキャン後に復号して部分一致検索を実行する

3.3 WHEN ユーザーが住所で検索する THEN システムは CONTINUE TO 全件スキャン後に復号して部分一致検索を実行する

3.4 WHEN 検索クエリが空の場合 THEN システムは CONTINUE TO 通常の売主一覧を表示する

---

## Bug Condition (Pseudocode)

```pascal
FUNCTION isPhoneBugCondition(X)
  INPUT: X of type SearchQuery (string)
  OUTPUT: boolean

  // 電話番号として解釈できる入力（数字のみ、7桁以上）
  RETURN X.matches(/^\d{7,}$/)
END FUNCTION

FUNCTION isEmailBugCondition(X)
  INPUT: X of type SearchQuery (string)
  OUTPUT: boolean

  // メールアドレスとして解釈できる入力
  RETURN X.matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
END FUNCTION
```

```pascal
// Property: Fix Checking - Phone Number Hash Search
FOR ALL X WHERE isPhoneBugCondition(X) DO
  hash ← SHA256(X)
  result ← searchByPhoneNumberHash'(hash)
  ASSERT result.length >= 0 AND all_matching_sellers_included(result)
END FOR

// Property: Fix Checking - Email Hash Search
FOR ALL X WHERE isEmailBugCondition(X) DO
  hash ← SHA256(X)
  result ← searchByEmailHash'(hash)
  ASSERT result.length >= 0 AND all_matching_sellers_included(result)
END FOR
```

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isPhoneBugCondition(X) AND NOT isEmailBugCondition(X) DO
  ASSERT searchSellers(X) = searchSellers'(X)
END FOR
```
