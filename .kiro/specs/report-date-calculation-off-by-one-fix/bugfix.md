# バグ修正要件定義書：報告日計算の1日ずれ

## Introduction

物件番号AA12497で「報告日設定」フィールドを「する」に設定した際、「報告日」が本日+14日で自動計算されるべきだが、実際には13日後になっている。本日が2026年3月31日の場合、期待値は2026年4月14日だが、実際には2026年4月13日が設定される。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 「報告日設定」フィールドで「する」を選択し、本日が2026年3月31日の場合 THEN システムは報告日を2026年4月13日（本日+13日）に設定する

1.2 WHEN 報告日の自動計算が実行される THEN システムは本日+13日を計算している（本来は+14日であるべき）

### Expected Behavior (Correct)

2.1 WHEN 「報告日設定」フィールドで「する」を選択し、本日が2026年3月31日の場合 THEN システムは報告日を2026年4月14日（本日+14日）に正確に設定する

2.2 WHEN 報告日の自動計算が実行される THEN システムは本日+14日を正確に計算する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 「報告日設定」フィールドで「しない」を選択した場合 THEN システムは報告日を自動計算せず、手動入力を継続して受け付ける

3.2 WHEN 報告日が手動で入力された場合 THEN システムはその値を継続して保持する

3.3 WHEN 「報告日設定」以外のフィールドを操作した場合 THEN システムは報告日の値を継続して変更しない

---

## Bug Condition and Property

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ReportDateCalculationInput
  OUTPUT: boolean
  
  // X.reportDateSetting = "する" かつ 計算結果が本日+13日の場合
  RETURN X.reportDateSetting = "する" AND 
         X.calculatedDate = addDays(today(), 13)
END FUNCTION
```

### Property Specification (Fix Checking)

```pascal
// Property: Fix Checking - 報告日が本日+14日で正確に計算される
FOR ALL X WHERE isBugCondition(X) DO
  result ← calculateReportDate'(X)
  ASSERT result = addDays(today(), 14) AND 
         NOT (result = addDays(today(), 13))
END FOR
```

### Preservation Goal (Preservation Checking)

```pascal
// Property: Preservation Checking - 他の動作は変更されない
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT calculateReportDate(X) = calculateReportDate'(X)
END FOR
```

**Key Definitions:**
- **calculateReportDate**: 修正前の報告日計算関数（+13日を返す）
- **calculateReportDate'**: 修正後の報告日計算関数（+14日を返す）

---

## Technical Context

### 計算場所の可能性

1. **スプレッドシートのGAS（Google Apps Script）** - 最も可能性が高い
   - 物件リストスプレッドシートに数式またはGAS関数が存在する可能性
   - 「報告日設定」列と「報告日」列の関係を確認する必要がある

2. **バックエンドの同期処理** - 可能性あり
   - `backend/src/services/PropertyListingSyncService.ts`
   - スプレッドシートからデータベースへの同期時に計算している可能性

3. **フロントエンド** - 可能性低い
   - `frontend/frontend/src/pages/ReinsRegistrationPage.tsx`（「報告日設定」フィールド）
   - `frontend/frontend/src/pages/PropertyReportPage.tsx`（「報告日」フィールド）
   - 現在は実装されていない

### 関連ファイル

- フロントエンド: `frontend/frontend/src/pages/ReinsRegistrationPage.tsx`
- フロントエンド: `frontend/frontend/src/pages/PropertyReportPage.tsx`
- バックエンド: `backend/src/services/PropertyListingSyncService.ts`
- カラムマッピング: `backend/src/config/property-listing-column-mapping.json`
- GAS: `gas/property-listing-sync/PropertyListingSync.gs`（報告日計算ロジックは未確認）

---

## Counterexample

**物件番号**: AA12497

**入力**:
- 本日: 2026年3月31日
- 「報告日設定」: 「する」

**現在の出力（バグ）**:
- 報告日: 2026年4月13日（本日+13日）

**期待される出力（修正後）**:
- 報告日: 2026年4月14日（本日+14日）

---

## Root Cause Analysis

### 確定した根本原因: Glideアプリの「報告日」カラム設定が間違っている

**場所**: Glideアプリの「報告日」カラム設定

**現在の設定**:
- **Reset on edit**: `[報告日設定] <> [_THISROW_BEFORE].[報告日設定], [報告完了] <> [_THISROW_BEFORE].[報告完了]`
- **Initial value**: `IF(ISNOTBLANK([_THISROW_BEFORE].[報告日]), [_THISROW_BEFORE].[報告日] + 14, TODAY() + 14)`

**問題点**:
- `[_THISROW_BEFORE].[報告日] + 14` は**前回の報告日に14日を足す**計算になっている
- AA12497の場合、本来は空欄だったが、何らかの理由で古い値（3月31日）が入っていた
- その結果、3月31日 + 14日 = 4月14日ではなく、3月31日 - 1日 + 14日 = 4月13日になった（推測）
- **重要な事実**: 前回の報告日は存在しない（本来は空欄）
- 「報告日設定」で「する」を選択した時点で本日+14日（4月14日）に設定されるべきだった

**修正方法**:
Glideアプリの「報告日」カラムのInitial valueを以下に変更:
```
TODAY() + 14
```

これで常に本日+14日が設定されます。前回の報告日を参照しないため、古い値の影響を受けません。

---

## Next Steps

1. **Glideアプリの「報告日」カラム設定を修正**（最優先・ユーザー作業）
   - Glideアプリを開く
   - 「報告日」カラムの設定を開く
   - Initial valueを `TODAY() + 14` に変更（前回の報告日を参照しないようにする）
   - 保存

2. **AA12497の報告日を手動で修正**（ユーザー作業）
   - 現在の間違った値（4月13日）を削除または正しい値（4月14日）に修正
   - または、「報告日設定」を一度「しない」に変更してから「する」に戻して再計算させる

3. **動作確認**
   - AA12497で「報告日設定」を「する」に設定
   - 報告日が本日+14日（4月14日）になることを確認

4. **テスト実行**（tasks.mdに記載）
   - バグ条件探索テスト作成・実行
   - 保存プロパティテスト作成・実行
   - 修正後の検証
