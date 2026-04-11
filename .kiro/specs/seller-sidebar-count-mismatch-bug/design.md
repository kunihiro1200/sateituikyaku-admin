# 売主リストサイドバーカウント不一致バグ 設計ドキュメント

## Overview

サイドバーに表示されるカテゴリーカウント（`seller_sidebar_counts` テーブル）と、
そのカテゴリーをクリックしたときに実際に表示される件数（`getSellers()` の `statusCategory` フィルタ）が
複数カテゴリで一致しないバグ。

修正方針は「フィルタリングロジックをカウント計算ロジックに合わせる」こと。
カウント計算（`SellerSidebarCountsUpdateService`）が正とし、
`getSellers()` の `statusCategory` スイッチ文の条件を修正する。

影響カテゴリ：
- `todayCallAssigned`（当日TEL担当）
- `todayCallNotStarted`（当日TEL_未着手）
- `pinrichEmpty`（Pinrich空欄）

---

## Glossary

- **Bug_Condition (C)**: カウント計算とフィルタリングの条件が異なる状態
- **Property (P)**: カテゴリーのカウント数 = そのカテゴリーをクリックしたときの表示件数
- **Preservation**: 修正対象外カテゴリ（`visitDayBefore`, `visitCompleted`, `todayCall` 等）の動作が変わらないこと
- **SellerSidebarCountsUpdateService**: `seller_sidebar_counts` テーブルを更新するサービス（カウント計算の正）
- **getSellers()**: `SellerService.supabase.ts` 内の売主一覧取得メソッド（フィルタリングロジックを含む）
- **statusCategory**: `getSellers()` に渡されるサイドバーカテゴリーフィルターパラメータ
- **filteredTodayCallSellers**: カウント計算内で「追客中 OR 他決→追客」かつ「営担なし」の売主を指す中間集合

---

## Bug Details

### Bug Condition

カウント計算とフィルタリングの条件が異なるカテゴリーが存在する。
具体的には以下の3カテゴリーで不一致が発生している。

**Formal Specification:**
```
FUNCTION isBugCondition(category)
  INPUT: category of type string (statusCategory)
  OUTPUT: boolean

  IF category = 'todayCallAssigned'
    RETURN countCondition includes '.ilike(status, %追客中%)'
           AND filterCondition does NOT include '.ilike(status, %追客中%)'
  END IF

  IF category = 'todayCallNotStarted'
    RETURN countCondition includes sellers WHERE status = '他決→追客'
           AND filterCondition does NOT include sellers WHERE status = '他決→追客'
  END IF

  IF category = 'pinrichEmpty'
    RETURN countCondition includes sellers WHERE status = '他決→追客'
           AND filterCondition does NOT include sellers WHERE status = '他決→追客'
  END IF

  RETURN false
END FUNCTION
```

### Examples

**todayCallAssigned の不一致:**
- 売主A: `status = '追客中'`, `visit_assignee = 'TK'`, `next_call_date = 今日`
  - カウント: 含まれる（`.ilike('status', '%追客中%')` 条件あり）
  - フィルタ: 含まれる（`status` 条件なし → 含まれてしまう）
- 売主B: `status = '除外後追客中'`, `visit_assignee = 'TK'`, `next_call_date = 今日`
  - カウント: 含まれる（`%追客中%` にマッチ）
  - フィルタ: 含まれる（`status` 条件なし → 含まれてしまう）
- 売主C: `status = '専任媒介'`, `visit_assignee = 'TK'`, `next_call_date = 今日`
  - カウント: 除外される（`.ilike('%追客中%')` にマッチしない）
  - フィルタ: 含まれてしまう（`status` 条件なし、専任媒介除外はあるが追客中チェックなし）

**todayCallNotStarted の不一致:**
- 売主D: `status = '他決→追客'`, `next_call_date = 今日`, `visit_assignee = null`, コミュニケーション情報なし, `unreachable_status = null`, `confidence_level = null`, `exclusion_date = null`, `inquiry_date = '2026-03-01'`
  - カウント: 含まれる（`filteredTodayCallSellers` は「追客中 OR 他決→追客」を含む）
  - フィルタ: 除外される（`.ilike('status', '%追客中%')` のみ → `他決→追客` は完全一致しない）

**pinrichEmpty の不一致:**
- 売主D（上記と同じ条件）: `pinrich_status = null`
  - カウント: 含まれる（`filteredTodayCallSellers` から派生）
  - フィルタ: 除外される（`.ilike('status', '%追客中%')` のみ）

---

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- `visitDayBefore`（訪問日前日）のフィルタリングロジックは変更しない
- `visitCompleted`（訪問済み）のフィルタリングロジックは変更しない
- `todayCall`（当日TEL分）のフィルタリングロジックは変更しない
- `unvaluated`（未査定）のフィルタリングロジックは変更しない
- `mailingPending`（査定郵送）のフィルタリングロジックは変更しない
- `visitAssigned:xxx`（担当者別）のフィルタリングロジックは変更しない
- `exclusive`, `general`, `visitOtherDecision`, `unvisitedOtherDecision` のフィルタリングロジックは変更しない

**スコープ:**
修正対象は `getSellers()` の `statusCategory` スイッチ文における
`todayCallAssigned`, `todayCallNotStarted`, `pinrichEmpty` の3ケースのみ。

---

## Hypothesized Root Cause

コードの差異を直接確認した結果、以下の3点が根本原因として特定された。

1. **todayCallAssigned の `追客中` チェック漏れ**
   - カウント計算（クエリ3）: `.ilike('status', '%追客中%')` を含む
   - フィルタ（スイッチ文）: `status` に関する `ilike` 条件がない
   - 結果: 追客中以外のステータス（例: 専任媒介、一般媒介以外の任意ステータス）の売主がフィルタに含まれてしまう

2. **todayCallNotStarted の `他決→追客` 除外**
   - カウント計算: `filteredTodayCallSellers`（追客中 OR 他決→追客）から派生するため `他決→追客` を含む
   - フィルタ: `.ilike('status', '%追客中%')` のみ → `他決→追客` は `%追客中%` にマッチしない
   - 結果: `他決→追客` の売主がカウントに含まれるがフィルタ結果に含まれない

3. **pinrichEmpty の `他決→追客` 除外**
   - 2と同様の原因。`filteredTodayCallSellers` から派生するため `他決→追客` を含むべきだが、フィルタは `%追客中%` のみ

---

## Correctness Properties

Property 1: Bug Condition - todayCallAssigned カウントとフィルタの一致

_For any_ 売主データにおいて `todayCallAssigned` の bug condition が成立する（`isBugCondition('todayCallAssigned')` が true）場合、
修正後の `getSellers({ statusCategory: 'todayCallAssigned' })` が返す件数は
`seller_sidebar_counts` テーブルの `todayCallAssigned` カウントと SHALL 一致する。

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - todayCallNotStarted カウントとフィルタの一致

_For any_ 売主データにおいて `todayCallNotStarted` の bug condition が成立する場合、
修正後の `getSellers({ statusCategory: 'todayCallNotStarted' })` が返す件数は
`seller_sidebar_counts` テーブルの `todayCallNotStarted` カウントと SHALL 一致する。

**Validates: Requirements 2.1, 2.3**

Property 3: Bug Condition - pinrichEmpty カウントとフィルタの一致

_For any_ 売主データにおいて `pinrichEmpty` の bug condition が成立する場合、
修正後の `getSellers({ statusCategory: 'pinrichEmpty' })` が返す件数は
`seller_sidebar_counts` テーブルの `pinrichEmpty` カウントと SHALL 一致する。

**Validates: Requirements 2.1, 2.4**

Property 4: Preservation - 修正対象外カテゴリの動作保持

_For any_ 売主データにおいて bug condition が成立しないカテゴリ（`visitDayBefore`, `visitCompleted`, `todayCall`, `unvaluated`, `mailingPending`, `exclusive`, `general`, `visitOtherDecision`, `unvisitedOtherDecision`, `visitAssigned:xxx`）に対して、
修正後の `getSellers()` は修正前と SHALL 同一の結果を返す。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

---

## Fix Implementation

### Changes Required

**File**: `backend/src/services/SellerService.supabase.ts`

**Function**: `getSellers()` 内の `statusCategory` スイッチ文

#### 変更1: `todayCallAssigned` に `追客中` チェックを追加

**現在のコード:**
```typescript
case 'todayCallAssigned':
  query = query
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .lte('next_call_date', todayJST)
    .not('status', 'ilike', '%追客不要%')
    .not('status', 'ilike', '%専任媒介%')
    .not('status', 'ilike', '%一般媒介%');
  break;
```

**修正後のコード:**
```typescript
case 'todayCallAssigned':
  query = query
    .not('visit_assignee', 'is', null)
    .neq('visit_assignee', '')
    .lte('next_call_date', todayJST)
    .ilike('status', '%追客中%')           // ← 追加: カウント計算と一致させる
    .not('status', 'ilike', '%追客不要%')
    .not('status', 'ilike', '%専任媒介%')
    .not('status', 'ilike', '%一般媒介%')
    .not('status', 'ilike', '%他社買取%'); // ← 追加: カウント計算と一致させる
  break;
```

#### 変更2: `todayCallNotStarted` に `他決→追客` を含める

**現在のコード:**
```typescript
case 'todayCallNotStarted':
  query = query
    .ilike('status', '%追客中%')
    .lte('next_call_date', todayJST)
    .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
    .or('phone_contact_person.is.null,phone_contact_person.eq.')
    .or('preferred_contact_time.is.null,preferred_contact_time.eq.')
    .or('contact_method.is.null,contact_method.eq.')
    .or('unreachable_status.is.null,unreachable_status.eq.')
    .gte('inquiry_date', '2026-01-01');
  break;
```

**修正後のコード:**
カウント計算は `filteredTodayCallSellers`（追客中 OR 他決→追客）から派生するため、
全件取得してJSでフィルタする方式に変更する。

```typescript
case 'todayCallNotStarted': {
  // カウント計算と同じロジック: 追客中 OR 他決→追客 の両方を含む
  let notStartedCandidates: any[] = [];
  let nsPage = 0;
  const nsPageSize = 1000;

  while (true) {
    const { data, error } = await this.table('sellers')
      .select('id, status, next_call_date, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, unreachable_status, confidence_level, exclusion_date, inquiry_date')
      .is('deleted_at', null)
      .not('next_call_date', 'is', null)
      .lte('next_call_date', todayJST)
      .range(nsPage * nsPageSize, (nsPage + 1) * nsPageSize - 1);

    if (error || !data || data.length === 0) break;
    notStartedCandidates = notStartedCandidates.concat(data);
    if (data.length < nsPageSize) break;
    nsPage++;
  }

  const notStartedIds = notStartedCandidates.filter(s => {
    const status = s.status || '';
    // 追客中 OR 他決→追客（カウント計算の filteredTodayCallSellers と同じ）
    const isFollowingUp = status.includes('追客中') || status === '他決→追客';
    if (!isFollowingUp) return false;
    if (status.includes('追客不要') || status.includes('専任媒介') || status.includes('一般媒介')) return false;

    // 営担が空または「外す」
    const visitAssignee = s.visit_assignee || '';
    if (visitAssignee && visitAssignee.trim() !== '' && visitAssignee.trim() !== '外す') return false;

    // コミュニケーション情報が全て空
    const hasInfo = (s.phone_contact_person?.trim()) ||
                    (s.preferred_contact_time?.trim()) ||
                    (s.contact_method?.trim());
    if (hasInfo) return false;

    // 当日TEL_未着手の追加条件（カウント計算の todayCallNotStartedCount と同じ）
    if (status !== '追客中') return false; // 他決→追客は未着手カウントに含まれない
    const unreachable = s.unreachable_status || '';
    if (unreachable && unreachable.trim() !== '') return false;
    const confidence = s.confidence_level || '';
    if (confidence === 'ダブり' || confidence === 'D' || confidence === 'AI査定') return false;
    const exclusionDate = s.exclusion_date || '';
    if (exclusionDate && exclusionDate.trim() !== '') return false;
    const inquiryDate = s.inquiry_date || '';
    return inquiryDate >= '2026-01-01';
  }).map(s => s.id);

  query = notStartedIds.length === 0
    ? query.in('id', ['__no_match__'])
    : query.in('id', notStartedIds);
  break;
}
```

**注意**: カウント計算の `todayCallNotStartedCount` は `status === '追客中'` のみをカウントしている（`他決→追客` は `filteredTodayCallSellers` に含まれるが `todayCallNotStartedCount` のフィルタで除外される）。フィルタも同様に `status === '追客中'` のみを対象とする。

#### 変更3: `pinrichEmpty` に `他決→追客` を含める

**現在のコード:**
```typescript
case 'pinrichEmpty':
  query = query
    .ilike('status', '%追客中%')
    .lte('next_call_date', todayJST)
    .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
    .or('phone_contact_person.is.null,phone_contact_person.eq.')
    .or('preferred_contact_time.is.null,preferred_contact_time.eq.')
    .or('contact_method.is.null,contact_method.eq.')
    .or('pinrich_status.is.null,pinrich_status.eq.');
  break;
```

**修正後のコード:**
カウント計算と同様に `filteredTodayCallSellers`（追客中 OR 他決→追客）から派生させる。

```typescript
case 'pinrichEmpty': {
  let pinrichCandidates: any[] = [];
  let prPage = 0;
  const prPageSize = 1000;

  while (true) {
    const { data, error } = await this.table('sellers')
      .select('id, status, next_call_date, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, pinrich_status')
      .is('deleted_at', null)
      .not('next_call_date', 'is', null)
      .lte('next_call_date', todayJST)
      .range(prPage * prPageSize, (prPage + 1) * prPageSize - 1);

    if (error || !data || data.length === 0) break;
    pinrichCandidates = pinrichCandidates.concat(data);
    if (data.length < prPageSize) break;
    prPage++;
  }

  const pinrichIds = pinrichCandidates.filter(s => {
    const status = s.status || '';
    // 追客中 OR 他決→追客（カウント計算の filteredTodayCallSellers と同じ）
    const isFollowingUp = status.includes('追客中') || status === '他決→追客';
    if (!isFollowingUp) return false;
    if (status.includes('追客不要') || status.includes('専任媒介') || status.includes('一般媒介')) return false;

    // 営担が空または「外す」
    const visitAssignee = s.visit_assignee || '';
    if (visitAssignee && visitAssignee.trim() !== '' && visitAssignee.trim() !== '外す') return false;

    // コミュニケーション情報が全て空
    const hasInfo = (s.phone_contact_person?.trim()) ||
                    (s.preferred_contact_time?.trim()) ||
                    (s.contact_method?.trim());
    if (hasInfo) return false;

    // Pinrichが空欄（カウント計算の pinrichEmptyCount と同じ）
    const pinrich = s.pinrich_status || '';
    return !pinrich || pinrich.trim() === '';
  }).map(s => s.id);

  query = pinrichIds.length === 0
    ? query.in('id', ['__no_match__'])
    : query.in('id', pinrichIds);
  break;
}
```

---

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：
1. 未修正コードでバグを再現するテストを書き、失敗を確認する（探索的チェック）
2. 修正後にテストが通ることを確認し、既存カテゴリの動作が変わらないことを検証する（保存チェック）

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: 各カテゴリーについて、カウント計算とフィルタリングの結果が異なることを示すテストデータを用意し、両者の差異を確認する。

**Test Cases**:
1. **todayCallAssigned 不一致テスト**: `status = '専任媒介'` かつ `visit_assignee = 'TK'` かつ `next_call_date = 今日` の売主を作成し、カウントには含まれないがフィルタには含まれることを確認（未修正コードで失敗）
2. **todayCallNotStarted 不一致テスト**: `status = '他決→追客'` かつ未着手条件を満たす売主を作成し、カウントには含まれるがフィルタには含まれないことを確認（未修正コードで失敗）
3. **pinrichEmpty 不一致テスト**: `status = '他決→追客'` かつ `pinrich_status = null` の売主を作成し、カウントには含まれるがフィルタには含まれないことを確認（未修正コードで失敗）

**Expected Counterexamples**:
- `todayCallAssigned`: フィルタ件数 > カウント（追客中以外のステータスが混入）
- `todayCallNotStarted`: フィルタ件数 < カウント（他決→追客が除外される）
- `pinrichEmpty`: フィルタ件数 < カウント（他決→追客が除外される）

### Fix Checking

**Goal**: 修正後、全カテゴリーでカウントとフィルタ件数が一致することを確認する。

**Pseudocode:**
```
FOR ALL category IN ['todayCallAssigned', 'todayCallNotStarted', 'pinrichEmpty'] DO
  FOR ALL sellerDataSet WHERE isBugCondition(category) DO
    filterCount := getSellers({ statusCategory: category }).total
    sidebarCount := seller_sidebar_counts[category].count
    ASSERT filterCount = sidebarCount
  END FOR
END FOR
```

### Preservation Checking

**Goal**: 修正対象外カテゴリーの動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL category NOT IN ['todayCallAssigned', 'todayCallNotStarted', 'pinrichEmpty'] DO
  FOR ALL sellerDataSet DO
    ASSERT getSellers_original({ statusCategory: category })
         = getSellers_fixed({ statusCategory: category })
  END FOR
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。多様なステータス・日付・担当者の組み合わせを自動生成し、修正前後の結果が一致することを検証する。

**Test Cases**:
1. **visitDayBefore 保存テスト**: 訪問日前日の売主が修正前後で同じ結果を返すことを確認
2. **visitCompleted 保存テスト**: 訪問済みの売主が修正前後で同じ結果を返すことを確認
3. **exclusive/general/visitOtherDecision/unvisitedOtherDecision 保存テスト**: 各カテゴリーが修正前後で同じ結果を返すことを確認

### Unit Tests

- `todayCallAssigned`: `追客中` を含む売主のみが返されることを確認
- `todayCallAssigned`: `他社買取` の売主が除外されることを確認
- `todayCallNotStarted`: `他決→追客` の売主が含まれないことを確認（カウント計算の `todayCallNotStartedCount` は `status === '追客中'` のみ）
- `pinrichEmpty`: `他決→追客` かつ `pinrich_status = null` の売主が含まれることを確認
- 各カテゴリーで境界値（`next_call_date = 今日`, `next_call_date = 明日`）のテスト

### Property-Based Tests

- ランダムな売主データセットを生成し、`todayCallAssigned` のカウントとフィルタ件数が一致することを検証
- ランダムな売主データセットを生成し、`todayCallNotStarted` のカウントとフィルタ件数が一致することを検証
- ランダムな売主データセットを生成し、`pinrichEmpty` のカウントとフィルタ件数が一致することを検証
- 修正対象外カテゴリーについて、修正前後で結果が変わらないことを検証

### Integration Tests

- 実際のDBデータを使用して、全カテゴリーのカウントとフィルタ件数が一致することを確認
- `SellerSidebarCountsUpdateService.updateSellerSidebarCounts()` 実行後に各カテゴリーをクリックし、表示件数が一致することを確認
- 売主データを変更後にカウントが更新され、フィルタ件数と一致し続けることを確認
