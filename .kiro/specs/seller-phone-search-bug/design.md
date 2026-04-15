# 売主電話番号・メールアドレス検索バグ Bugfix Design

## Overview

売主一覧の検索バーで電話番号・メールアドレスを入力してもヒットしないバグの修正設計。

電話番号・メールアドレスは AES-256-GCM で暗号化されているため DB での LIKE 検索が不可能。
現在の実装は全件スキャン（最新500件）後に復号して部分一致検索しているが、500件を超える売主は検索対象外になる。
`phone_number_hash` と `email_hash`（SHA-256）が DB に保存済みだが未活用。

修正方針：入力値を SHA-256 ハッシュ化して DB 検索し、ヒットしない場合のみ既存の全件スキャンにフォールバックする。

## Glossary

- **Bug_Condition (C)**: 電話番号またはメールアドレスとして解釈できる入力が `searchSellers` に渡されたとき、ハッシュ検索が行われずに全件スキャン（最新500件）のみで検索される状態
- **Property (P)**: ハッシュ検索により全件を対象に一致する売主が返される期待動作
- **Preservation**: 売主番号・名前・住所での既存検索動作が変わらないこと
- **searchSellers**: `backend/src/services/SellerService.supabase.ts` の検索メソッド。クエリ文字列を受け取り売主リストを返す
- **phone_number_hash**: `sellers` テーブルの SHA-256 ハッシュカラム。電話番号の正規化前の値をハッシュ化して保存
- **email_hash**: `sellers` テーブルの SHA-256 ハッシュカラム。メールアドレスをハッシュ化して保存
- **isPhoneBugCondition**: 入力が電話番号パターン（数字のみ7桁以上）に一致するかを判定する関数
- **isEmailBugCondition**: 入力がメールアドレスパターン（@含む）に一致するかを判定する関数

## Bug Details

### Bug Condition

`searchSellers` に電話番号またはメールアドレスが渡されたとき、`phone_number_hash` / `email_hash` による DB 検索が行われず、最新500件の全件スキャンのみで検索される。500件より古い売主は検索対象外になる。

**Formal Specification:**

```
FUNCTION isPhoneBugCondition(X)
  INPUT: X of type string (検索クエリ)
  OUTPUT: boolean

  RETURN X.matches(/^\d{7,}$/)
         AND phone_number_hash_search_not_performed(X)
END FUNCTION

FUNCTION isEmailBugCondition(X)
  INPUT: X of type string (検索クエリ)
  OUTPUT: boolean

  RETURN X.matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
         AND email_hash_search_not_performed(X)
END FUNCTION
```

### Examples

- `09012345678` を入力 → 売主番号の LIKE 検索にヒットせず全件スキャン（最新500件）に進む → 501件目以降の売主はヒットしない
- `tomoko.kunihiro@ifoo-oita.com` を入力 → 全件スキャン（最新500件）のみ → AA18 がヒットしない（実際に報告された事例）
- `0901234` を入力（7桁未満）→ 電話番号として扱わず全件スキャン → 既存動作のまま（バグ条件外）
- `test@` を入力（不完全なメール）→ メールアドレスとして扱わず全件スキャン → 既存動作のまま（バグ条件外）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 売主番号（AA12345 形式）での検索は引き続き `seller_number` の高速検索を実行する
- 名前・住所での検索は引き続き全件スキャン後に復号して部分一致検索を実行する
- 空クエリの場合は通常の売主一覧を表示する

**Scope:**
電話番号パターン（数字のみ7桁以上）またはメールアドレスパターン（@含む）に一致しない入力は、この修正の影響を受けない。具体的には：
- 売主番号（AA/FI/BB + 数字）
- 漢字・ひらがな等の名前
- 住所文字列
- 7桁未満の数字

## Hypothesized Root Cause

1. **ハッシュ検索パスの欠如**: `searchSellers` に電話番号・メールアドレス用の早期リターンパスが存在しない。売主番号（`/^[a-z]{2}\d+$/i`）と数字のみ（`/^\d+$/`）のパスはあるが、後者は `seller_number` の LIKE 検索であり `phone_number_hash` 検索ではない

2. **数字のみパスの誤動作**: `lowerQuery.match(/^\d+$/)` が電話番号（例: `09012345678`）にもマッチするが、`seller_number` の LIKE 検索を行うため電話番号としてヒットしない。ヒットしない場合は全件スキャンにフォールバックするが、500件制限がある

3. **500件制限**: 全件スキャンが `updated_at` 降順で最新500件に制限されているため、古い売主が検索対象外になる

4. **メールアドレスの早期リターンなし**: メールアドレスは売主番号パターンにも数字のみパターンにもマッチしないため、常に全件スキャンに進む

## Correctness Properties

Property 1: Bug Condition - 電話番号ハッシュ検索

_For any_ 入力 X において `isPhoneBugCondition(X)` が true（数字のみ7桁以上）のとき、修正後の `searchSellers` は X を SHA-256 ハッシュ化して `phone_number_hash` カラムで DB 検索を行い、全件を対象に一致する売主を返す。

**Validates: Requirements 2.1, 2.3, 2.4**

Property 2: Bug Condition - メールアドレスハッシュ検索

_For any_ 入力 X において `isEmailBugCondition(X)` が true（@を含む有効なメールアドレス形式）のとき、修正後の `searchSellers` は X を SHA-256 ハッシュ化して `email_hash` カラムで DB 検索を行い、全件を対象に一致する売主を返す。

**Validates: Requirements 2.2, 2.3, 2.4**

Property 3: Preservation - 非ハッシュ検索入力の動作保持

_For any_ 入力 X において `isPhoneBugCondition(X)` も `isEmailBugCondition(X)` も false のとき、修正後の `searchSellers` は修正前と同じ結果を返し、売主番号・名前・住所での既存検索動作を保持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/SellerService.supabase.ts`

**Function**: `searchSellers`

**Specific Changes:**

1. **電話番号パターン判定の追加**: 数字のみパス（`/^\d+$/`）の前に、7桁以上の数字を電話番号として判定するパスを追加する
   - パターン: `/^\d{7,}$/`
   - 既存の数字のみパス（`seller_number` LIKE 検索）より先に評価する

2. **電話番号ハッシュ検索の実装**: 電話番号パターンにマッチした場合、`crypto.createHash('sha256').update(lowerQuery).digest('hex')` でハッシュ化し、`phone_number_hash` カラムで完全一致検索する

3. **メールアドレスパターン判定の追加**: 売主番号パターンの後、全件スキャンの前に、メールアドレスパターン（`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`）を判定するパスを追加する

4. **メールアドレスハッシュ検索の実装**: メールアドレスパターンにマッチした場合、`crypto.createHash('sha256').update(lowerQuery).digest('hex')` でハッシュ化し、`email_hash` カラムで完全一致検索する

5. **フォールバック動作の維持**: ハッシュ検索でヒットしない場合は既存の全件スキャンにフォールバックする（名前・住所での部分一致検索も引き続き機能させる）

**実装イメージ（電話番号）:**

```typescript
// 電話番号パターン（数字のみ7桁以上）→ phone_number_hash で検索
if (lowerQuery.match(/^\d{7,}$/)) {
  console.log('🚀 Fast path: Searching by phone_number_hash in database');
  const phoneHash = crypto.createHash('sha256').update(lowerQuery).digest('hex');
  let hashQuery = this.table('sellers')
    .select('*')
    .eq('phone_number_hash', phoneHash);
  if (!includeDeleted) {
    hashQuery = hashQuery.is('deleted_at', null);
  }
  const { data: hashSellers, error: hashError } = await hashQuery;
  if (hashError) throw new Error(`Failed to search by phone hash: ${hashError.message}`);
  if (hashSellers && hashSellers.length > 0) {
    const decryptedSellers = await Promise.all(hashSellers.map(s => this.decryptSeller(s)));
    return await this._attachLastCalledAt(decryptedSellers);
  }
  // ヒットしない場合は全件スキャンにフォールバック
}
```

**注意点:**
- `crypto` モジュールは既にファイル先頭で `import * as crypto from 'crypto'` されているため追加不要
- 電話番号ハッシュ検索パスは既存の「数字のみ → seller_number LIKE 検索」パスより前に配置する
- ハッシュ検索でヒットしない場合は既存の全件スキャンに自然にフォールバックする

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず未修正コードでバグを再現するカウンターサンプルを確認し、次に修正後の動作とリグレッションがないことを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認または反証する。

**Test Plan**: 電話番号・メールアドレスで `searchSellers` を呼び出し、500件目以降の売主がヒットしないことを確認する。未修正コードで実行してバグを観察する。

**Test Cases:**
1. **電話番号検索テスト**: `searchSellers('09012345678')` を呼び出し、501件目以降の売主がヒットしないことを確認（未修正コードで失敗）
2. **メールアドレス検索テスト**: `searchSellers('tomoko.kunihiro@ifoo-oita.com')` を呼び出し、AA18 がヒットしないことを確認（未修正コードで失敗）
3. **7桁未満の数字テスト**: `searchSellers('090123')` を呼び出し、seller_number LIKE 検索が実行されることを確認
4. **不完全メールテスト**: `searchSellers('test@')` を呼び出し、全件スキャンにフォールバックすることを確認

**Expected Counterexamples:**
- 電話番号入力が `seller_number` LIKE 検索にヒットせず、全件スキャン（最新500件）のみで処理される
- メールアドレス入力が全件スキャン（最新500件）のみで処理される
- 501件目以降の売主は検索対象外になる

### Fix Checking

**Goal**: バグ条件が成立する全入力に対して、修正後の関数が期待動作を返すことを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isPhoneBugCondition(X) DO
  hash := SHA256(X)
  result := searchSellers_fixed(X)
  ASSERT all sellers with phone_number_hash = hash are included in result
END FOR

FOR ALL X WHERE isEmailBugCondition(X) DO
  hash := SHA256(X)
  result := searchSellers_fixed(X)
  ASSERT all sellers with email_hash = hash are included in result
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正後の関数が修正前と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isPhoneBugCondition(X) AND NOT isEmailBugCondition(X) DO
  ASSERT searchSellers_original(X) = searchSellers_fixed(X)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。理由：
- 売主番号・名前・住所など多様な入力パターンを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 非バグ入力全体にわたって動作が変わらないことを強く保証できる

**Test Cases:**
1. **売主番号検索の保持**: `searchSellers('AA12345')` が修正前後で同じ結果を返すことを確認
2. **名前検索の保持**: `searchSellers('山田太郎')` が修正前後で同じ結果を返すことを確認
3. **住所検索の保持**: `searchSellers('大分市')` が修正前後で同じ結果を返すことを確認
4. **7桁未満数字の保持**: `searchSellers('12345')` が修正前後で同じ結果を返すことを確認

### Unit Tests

- 電話番号パターン（7桁以上）でハッシュ検索が実行されることを確認
- メールアドレスパターンでハッシュ検索が実行されることを確認
- ハッシュ検索でヒットしない場合に全件スキャンにフォールバックすることを確認
- 7桁未満の数字は電話番号として扱わないことを確認
- 不完全なメールアドレスはメールとして扱わないことを確認

### Property-Based Tests

- ランダムな電話番号（7桁以上の数字）を生成し、対応する `phone_number_hash` を持つ売主が必ず返されることを検証
- ランダムなメールアドレスを生成し、対応する `email_hash` を持つ売主が必ず返されることを検証
- 売主番号・名前・住所などの非ハッシュ入力を生成し、修正前後で同じ結果が返されることを検証

### Integration Tests

- 実際の DB に対して電話番号で検索し、500件目以降の売主がヒットすることを確認
- 実際の DB に対してメールアドレスで検索し、対応する売主がヒットすることを確認（AA18 の `tomoko.kunihiro@ifoo-oita.com` など）
- 売主番号・名前・住所での既存検索が引き続き正常に動作することを確認
