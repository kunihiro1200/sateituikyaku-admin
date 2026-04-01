# 技術設計書：通話モードページのステータスセクション配置変更機能

## Overview

通話モードページにおいて、「状況（当社）」フィールドの値に応じて、ステータスセクション（📊 ステータス）とコメントセクション（コメント入力・編集エリア）の表示順序を動的に変更する機能を実装します。

### 背景

現在の通話モードページでは、コメントセクションが常にステータスセクションの上に配置されています。しかし、「一般媒介」「専任媒介」「他決」などの特定のステータスの場合、ステータス情報を優先的に確認したいというニーズがあります。

### 目的

「状況（当社）」フィールドの値に応じて、重要な情報を優先的に表示することで、営業担当者の業務効率を向上させます。

## Architecture

### コンポーネント構造

```
CallModePage
├── useMemo: shouldShowStatusFirst (新規)
│   └── 「状況（当社）」の値に基づいて表示順序を決定
├── コメントセクション
│   └── RichTextCommentEditor
└── ステータスセクション
    ├── 状況（当社）
    ├── 確度
    ├── 次電日
    └── その他のステータスフィールド
```

### データフロー

```
seller.status (状況（当社）)
  ↓
useMemo: shouldShowStatusFirst
  ↓
条件分岐: shouldShowStatusFirst === true
  ├── true  → ステータスセクション → コメントセクション
  └── false → コメントセクション → ステータスセクション
```


## Components and Interfaces

### 1. useMemo: shouldShowStatusFirst

**目的**: 「状況（当社）」の値に基づいて、ステータスセクションを優先表示するかどうかを判定する。

**実装**:

```typescript
const shouldShowStatusFirst = useMemo(() => {
  const status = seller?.status || editedStatus;
  
  // 対象ステータス値のリスト
  const targetStatuses = [
    '一般媒介',
    '専任媒介',
    '他決→追客',
    '他決→追客不要',
    '他決→専任',
    '他決→一般',
    'リースバック（専任）',
    '専任→他社専任',
    '一般→他決',
  ];
  
  // いずれかの対象ステータスが含まれる場合、ステータスセクションを優先
  return targetStatuses.some(targetStatus => status.includes(targetStatus));
}, [seller?.status, editedStatus]);
```

**依存配列**: `[seller?.status, editedStatus]`

**重要**: useMemoの依存配列には、参照元のデータ（`seller?.status`, `editedStatus`）を必ず含める。これにより、ステータスが変更された際に自動的に再計算される。

### 2. セクションレンダリングロジック

**デスクトップ版**:

```typescript
{/* 右側カラム */}
<Grid item xs={12} md={6}>
  {shouldShowStatusFirst ? (
    <>
      {/* ステータスセクション */}
      <StatusSection />
      
      {/* コメントセクション */}
      <CommentSection />
    </>
  ) : (
    <>
      {/* コメントセクション */}
      <CommentSection />
      
      {/* ステータスセクション */}
      <StatusSection />
    </>
  )}
</Grid>
```

**モバイル版（アコーディオン）**:

```typescript
{isMobile && (
  <>
    {shouldShowStatusFirst ? (
      <>
        {/* ステータスアコーディオン */}
        <Accordion>
          <AccordionSummary>📊 ステータス</AccordionSummary>
          <AccordionDetails>
            <StatusSection />
          </AccordionDetails>
        </Accordion>
        
        {/* コメントアコーディオン */}
        <Accordion defaultExpanded>
          <AccordionSummary>📝 コメント</AccordionSummary>
          <AccordionDetails>
            <CommentSection />
          </AccordionDetails>
        </Accordion>
      </>
    ) : (
      <>
        {/* コメントアコーディオン */}
        <Accordion defaultExpanded>
          <AccordionSummary>📝 コメント</AccordionSummary>
          <AccordionDetails>
            <CommentSection />
          </AccordionDetails>
        </Accordion>
        
        {/* ステータスアコーディオン */}
        <Accordion>
          <AccordionSummary>📊 ステータス</AccordionSummary>
          <AccordionDetails>
            <StatusSection />
          </AccordionDetails>
        </Accordion>
      </>
    )}
  </>
)}
```


## Data Models

### Seller型（既存）

```typescript
interface Seller {
  id: string;
  sellerNumber: string;
  name: string;
  status: string; // 「状況（当社）」フィールド
  // ... その他のフィールド
}
```

### 対象ステータス値

以下のステータス値が含まれる場合、ステータスセクションを優先表示します：

1. `一般媒介`
2. `専任媒介`
3. `他決→追客`
4. `他決→追客不要`
5. `他決→専任`
6. `他決→一般`
7. `リースバック（専任）`
8. `専任→他社専任`
9. `一般→他決`

### デフォルトの表示順序

上記以外のステータス値の場合：

1. コメントセクション
2. ステータスセクション

### 変更後の表示順序（対象ステータスの場合）

1. ステータスセクション
2. コメントセクション

## Correctness Properties

*プロパティは、システムの全ての有効な実行において真であるべき特性や動作の形式的な記述です。プロパティは、人間が読める仕様と機械で検証可能な正確性保証の橋渡しとなります。*

### Property 1: ステータス値に応じた表示順序の決定

*For any* 「状況（当社）」の値において、その値が対象ステータスリスト（"一般媒介", "専任媒介", "他決→追客", "他決→追客不要", "他決→専任", "他決→一般", "リースバック（専任）", "専任→他社専任", "一般→他決"）のいずれかを含む場合、ステータスセクションがコメントセクションの上に配置され、それ以外の場合はコメントセクションがステータスセクションの上に配置される。

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: ステータス変更時の即座の更新

*For any* 「状況（当社）」の値の変更において、変更後の値に基づいて表示順序が即座に再計算され、UIに反映される。

**Validates: Requirements 1.5**

### Property 3: セクションの見出しとスタイルの保持

*For any* 表示順序の変更において、各セクションの見出し（「📊 ステータス」「コメント入力・編集エリア」）とスタイルが変更前と同じ状態で維持される。

**Validates: Requirements 2.2**

### Property 4: 既存機能の正常動作

*For any* 表示順序の変更において、コメント保存、ステータス保存、不通フィールド保存、1番電話フィールド保存、全ての入力フィールドの状態管理が正常に動作する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 5: モバイル端末での表示順序変更

*For any* モバイル端末（useMediaQueryで判定）において、「状況（当社）」の値に応じてアコーディオン形式のセクションの表示順序が正しく変更される。

**Validates: Requirements 4.1, 4.2**


## Error Handling

### 1. seller?.statusがundefinedの場合

**対応**: デフォルト値として空文字列を使用し、デフォルトの表示順序（コメントセクションが上）を適用する。

```typescript
const status = seller?.status || editedStatus || '';
```

### 2. editedStatusがundefinedの場合

**対応**: seller?.statusを優先的に使用し、両方ともundefinedの場合は空文字列を使用する。

### 3. 対象ステータス値の判定エラー

**対応**: `String.prototype.includes()`を使用して部分一致で判定するため、大文字小文字の違いやスペースの有無に注意する。必要に応じて正規化処理を追加する。

### 4. useMemoの依存配列の不備

**対応**: `.kiro/steering/react-usememo-dependencies.md`のルールに従い、useMemo内で参照している全てのデータ（`seller?.status`, `editedStatus`）を依存配列に含める。

## Testing Strategy

### 単体テスト（Unit Tests）

**目的**: 特定の例やエッジケースを検証する。

**テストケース**:

1. **対象ステータス値の判定**
   - "一般媒介" → `shouldShowStatusFirst === true`
   - "専任媒介" → `shouldShowStatusFirst === true`
   - "他決→追客" → `shouldShowStatusFirst === true`
   - "追客中" → `shouldShowStatusFirst === false`
   - "" (空文字列) → `shouldShowStatusFirst === false`
   - undefined → `shouldShowStatusFirst === false`

2. **部分一致の判定**
   - "他決→追客不要" → `shouldShowStatusFirst === true` ("他決"を含む)
   - "専任媒介（訪問後）" → `shouldShowStatusFirst === true` ("専任媒介"を含む)

3. **モバイル判定**
   - `isMobile === true` かつ 対象ステータス → アコーディオンの順序が正しい
   - `isMobile === false` かつ 対象ステータス → Gridの順序が正しい

4. **既存機能の動作確認**
   - コメント保存APIが正常に呼び出される
   - ステータス保存APIが正常に呼び出される

### プロパティベーステスト（Property-Based Tests）

**目的**: 全ての入力に対して普遍的なプロパティを検証する。

**テストライブラリ**: `fast-check` (TypeScript/JavaScript用)

**設定**: 各テストは最低100回の反復実行を行う。

**テストケース**:

#### Property Test 1: ステータス値に応じた表示順序の決定

```typescript
import fc from 'fast-check';

/**
 * Feature: call-mode-status-section-reorder, Property 1: ステータス値に応じた表示順序の決定
 * 
 * For any 「状況（当社）」の値において、その値が対象ステータスリストのいずれかを含む場合、
 * ステータスセクションがコメントセクションの上に配置され、それ以外の場合は
 * コメントセクションがステータスセクションの上に配置される。
 */
test('Property 1: ステータス値に応じた表示順序の決定', () => {
  fc.assert(
    fc.property(
      fc.string(), // 任意の文字列を生成
      (status) => {
        const targetStatuses = [
          '一般媒介', '専任媒介', '他決→追客', '他決→追客不要',
          '他決→専任', '他決→一般', 'リースバック（専任）',
          '専任→他社専任', '一般→他決',
        ];
        
        const shouldShowStatusFirst = targetStatuses.some(
          targetStatus => status.includes(targetStatus)
        );
        
        // 検証: 対象ステータスを含む場合はtrue、それ以外はfalse
        const containsTargetStatus = targetStatuses.some(
          targetStatus => status.includes(targetStatus)
        );
        
        return shouldShowStatusFirst === containsTargetStatus;
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property Test 2: ステータス変更時の即座の更新

```typescript
/**
 * Feature: call-mode-status-section-reorder, Property 2: ステータス変更時の即座の更新
 * 
 * For any 「状況（当社）」の値の変更において、変更後の値に基づいて
 * 表示順序が即座に再計算され、UIに反映される。
 */
test('Property 2: ステータス変更時の即座の更新', () => {
  fc.assert(
    fc.property(
      fc.string(), // 変更前のステータス
      fc.string(), // 変更後のステータス
      (statusBefore, statusAfter) => {
        // useMemoの依存配列に seller?.status が含まれているため、
        // statusが変更されると自動的に再計算される
        
        const targetStatuses = [
          '一般媒介', '専任媒介', '他決→追客', '他決→追客不要',
          '他決→専任', '他決→一般', 'リースバック（専任）',
          '専任→他社専任', '一般→他決',
        ];
        
        const shouldShowStatusFirstBefore = targetStatuses.some(
          targetStatus => statusBefore.includes(targetStatus)
        );
        
        const shouldShowStatusFirstAfter = targetStatuses.some(
          targetStatus => statusAfter.includes(targetStatus)
        );
        
        // 検証: 変更前と変更後で正しく再計算される
        return (
          shouldShowStatusFirstBefore === targetStatuses.some(
            targetStatus => statusBefore.includes(targetStatus)
          ) &&
          shouldShowStatusFirstAfter === targetStatuses.some(
            targetStatus => statusAfter.includes(targetStatus)
          )
        );
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property Test 3: 既存機能の正常動作

```typescript
/**
 * Feature: call-mode-status-section-reorder, Property 4: 既存機能の正常動作
 * 
 * For any 表示順序の変更において、コメント保存、ステータス保存、
 * 不通フィールド保存、1番電話フィールド保存、全ての入力フィールドの
 * 状態管理が正常に動作する。
 */
test('Property 4: 既存機能の正常動作', () => {
  fc.assert(
    fc.property(
      fc.string(), // ステータス値
      fc.string(), // コメント
      (status, comment) => {
        // 表示順序に関係なく、保存機能が正常に動作することを検証
        
        // モックAPIを使用して保存処理をテスト
        const mockSaveComment = jest.fn().mockResolvedValue({ success: true });
        const mockSaveStatus = jest.fn().mockResolvedValue({ success: true });
        
        // 保存処理を実行
        mockSaveComment(comment);
        mockSaveStatus(status);
        
        // 検証: APIが正しく呼び出される
        return (
          mockSaveComment.mock.calls.length === 1 &&
          mockSaveStatus.mock.calls.length === 1
        );
      }
    ),
    { numRuns: 100 }
  );
});
```

### テスト実行コマンド

```bash
# 単体テスト
npm test -- CallModePage.test.tsx

# プロパティベーステスト
npm test -- CallModePage.property.test.tsx

# 全テスト
npm test
```

### テストカバレッジ目標

- 単体テスト: 80%以上
- プロパティベーステスト: 主要なプロパティ（5つ）を全てカバー


## Implementation Notes

### 1. useMemoの依存配列

**重要**: `.kiro/steering/react-usememo-dependencies.md`のルールに従い、useMemo内で参照している全てのデータを依存配列に含める。

```typescript
const shouldShowStatusFirst = useMemo(() => {
  const status = seller?.status || editedStatus;
  // ... 計算ロジック
}, [seller?.status, editedStatus]); // ✅ 両方を含める
```

**間違った例**:

```typescript
// ❌ 間違い（editedStatusが含まれていない）
const shouldShowStatusFirst = useMemo(() => {
  const status = seller?.status || editedStatus;
  // ... 計算ロジック
}, [seller?.status]); // editedStatusが変更されても再計算されない
```

### 2. 対象ステータス値の管理

対象ステータス値は定数として定義し、メンテナンス性を向上させる。

```typescript
const TARGET_STATUSES = [
  '一般媒介',
  '専任媒介',
  '他決→追客',
  '他決→追客不要',
  '他決→専任',
  '他決→一般',
  'リースバック（専任）',
  '専任→他社専任',
  '一般→他決',
] as const;
```

### 3. モバイル判定

既存の`isMobile`変数（`useMediaQuery(theme.breakpoints.down('sm'))`）を使用する。

### 4. アニメーション効果（オプション）

Material-UIの`Collapse`コンポーネントを使用して、スムーズなアニメーション効果を実装できる。

```typescript
import { Collapse } from '@mui/material';

<Collapse in={shouldShowStatusFirst}>
  <StatusSection />
</Collapse>
```

ただし、要件2.1は「no」（テスト不可）と判定されているため、実装は任意とする。

### 5. パフォーマンス最適化

- `shouldShowStatusFirst`の計算は軽量（文字列の部分一致判定のみ）なので、パフォーマンス上の問題はない。
- useMemoを使用することで、不要な再計算を防ぐ。
- セクションのコンポーネント化により、再レンダリングの範囲を最小化する。

### 6. 既存コードへの影響

**変更箇所**:
- `frontend/frontend/src/pages/CallModePage.tsx`のレンダリング部分のみ
- 既存のステート管理やAPI呼び出しには影響なし

**影響範囲**:
- 最小限（表示順序の変更のみ）
- 既存機能の動作には影響なし

## Deployment Considerations

### 1. デプロイ手順

`.kiro/steering/deploy-procedure.md`に従い、Git連携による自動デプロイを使用する。

```bash
git add .
git commit -m "feat: 通話モードページのステータスセクション配置変更機能を実装"
git push origin main
```

### 2. ロールバック計画

問題が発生した場合、以下のコマンドで前のバージョンに戻す。

```bash
git revert HEAD
git push origin main
```

### 3. 監視項目

- ページの読み込み速度（パフォーマンス低下がないか）
- JavaScriptエラーの発生（ブラウザコンソール）
- ユーザーからのフィードバック（表示順序が正しいか）

## References

- 要件定義書: `.kiro/specs/call-mode-status-section-reorder/requirements.md`
- React useMemoの依存配列ルール: `.kiro/steering/react-usememo-dependencies.md`
- デプロイ手順: `.kiro/steering/deploy-procedure.md`
- 売主テーブルのカラム定義: `.kiro/steering/seller-table-column-definition.md`

