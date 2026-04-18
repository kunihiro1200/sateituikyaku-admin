# 設計ドキュメント: seller-registration-ui-enhancement

## 概要

売主リスト新規登録画面（`NewSellerPage.tsx`）のUI改善を行う。
具体的には以下の3点を実装する：

1. 各セクションの `Paper` コンポーネントに淡い背景色を適用し、視覚的な区別を強化する
2. 訪問査定情報セクションに「訪問査定取得者」フィールドを追加する
3. 「次電日」フィールドを強調表示する（黄色背景・太字赤ラベル・未入力時警告枠線）

対象ファイル: `frontend/frontend/src/pages/NewSellerPage.tsx`

---

## アーキテクチャ

本機能はフロントエンドのみの変更であり、バックエンドへの影響は最小限（`visitAcquirer` フィールドの追加のみ）。

```
frontend/frontend/src/pages/NewSellerPage.tsx
  ├── 各 Paper コンポーネント → backgroundColor を sx プロパティで設定
  ├── 訪問査定情報セクション → visitAcquirer state + Select コンポーネント追加
  └── 追客情報セクション → nextCallDate フィールドの強調スタイル適用
```

バックエンドへのリクエストペイロードに `visitAcquirer` フィールドを追加する。
バックエンド側（`backend/src/routes/sellers.ts` および `backend/src/services/SellerService.supabase.ts`）が既存の `visitAssignee` と同様のパターンで `visitAcquirer` を受け取れるかを確認する必要がある。

---

## コンポーネントとインターフェース

### 変更対象コンポーネント

**`NewSellerPage`** (`frontend/frontend/src/pages/NewSellerPage.tsx`)

#### 新規 State

```typescript
const [visitAcquirer, setVisitAcquirer] = useState('');
```

#### セクション背景色マッピング

| セクション | backgroundColor |
|-----------|----------------|
| 基本情報 | `#e3f2fd` |
| 反響情報 | `#f3e5f5` |
| 物件情報 | `#e8f5e9` |
| コメント | `#fff8e1` |
| ステータス情報 | `#fce4ec` |
| 査定情報 | `#e0f7fa` |
| 追客情報 | `#fff3e0` |
| 訪問査定情報 | `#f1f8e9` |

#### 訪問査定取得者フィールド

```tsx
<Grid item xs={12} sm={6}>
  <FormControl fullWidth>
    <InputLabel>訪問査定取得者</InputLabel>
    <Select
      value={visitAcquirer}
      label="訪問査定取得者"
      onChange={(e) => setVisitAcquirer(e.target.value)}
      sx={{ backgroundColor: '#ffffff' }}
    >
      <MenuItem value=""><em>未選択</em></MenuItem>
      {employees.map((emp) => {
        const initials = (emp as any).initials || emp.name || emp.email;
        return (
          <MenuItem key={(emp as any).id} value={initials}>
            {emp.name} ({initials})
          </MenuItem>
        );
      })}
    </Select>
  </FormControl>
</Grid>
```

配置位置: 「営担」（`visitAssignee`）フィールドの直後、「訪問時注意点」の前。

#### 次電日フィールドの強調スタイル

```tsx
<Grid item xs={12} sm={6} sx={{ backgroundColor: '#fff9c4', borderRadius: 1, p: 1 }}>
  <TextField
    fullWidth
    label="次電日"
    type="date"
    value={nextCallDate}
    onChange={(e) => setNextCallDate(e.target.value)}
    InputLabelProps={{
      shrink: true,
      style: { fontWeight: 'bold', color: '#d32f2f' }
    }}
    color={!nextCallDate ? 'warning' : undefined}
    focused={!nextCallDate ? true : undefined}
    InputProps={{ style: { backgroundColor: '#ffffff' } }}
  />
</Grid>
```

#### APIリクエストペイロードへの追加

```typescript
// 訪問査定情報
visitDate: visitDate || undefined,
visitTime: visitTime || undefined,
visitAssignee: visitAssignee || undefined,
visitAcquirer: visitAcquirer || undefined,  // 追加
visitNotes: visitNotes || undefined,
```

---

## データモデル

### フロントエンド State

```typescript
// 既存
const [visitAssignee, setVisitAssignee] = useState('');

// 追加
const [visitAcquirer, setVisitAcquirer] = useState('');
```

### APIリクエスト型（追加フィールド）

```typescript
{
  // ...既存フィールド...
  visitAcquirer?: string;  // 社員のイニシャル
}
```

### バックエンド対応

`visitAcquirer` フィールドはバックエンドの `sellers` テーブルに対応するカラムが必要。
既存の `visit_assignee` カラムと同様のパターンで `visit_acquirer` カラムを追加するか、
バックエンドのルートハンドラで受け取れるよう確認が必要。

> **注意**: バックエンドのDBスキーマ変更が必要な場合は別途マイグレーションが必要。
> 本設計では `visitAcquirer` をAPIリクエストに含めることのみを対象とし、
> バックエンドの実装詳細は既存の `visitAssignee` パターンに準拠する。

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

本機能はUIレンダリングとフォーム送信ロジックが主体であり、ほとんどの受け入れ基準はスナップショットテストや例ベーステストで対応する。
ただし、以下の2点はプロパティベーステストが適用可能。

### プロパティ1: visitAcquirer のフォーム送信ラウンドトリップ

*任意の* 社員（`employees` リスト内）を「訪問査定取得者」として選択してフォームを送信した場合、APIリクエストのペイロードに含まれる `visitAcquirer` フィールドの値は、選択した社員のイニシャルと一致しなければならない。

**Validates: Requirements 2.4**

### プロパティ2: 次電日未入力時の警告スタイル適用

*任意の* `nextCallDate` の値について、値が空文字列の場合は `color='warning'` が適用され、空でない場合は適用されない。

**Validates: Requirements 3.3**

---

## エラーハンドリング

### セクション背景色

- MUI の `sx` プロパティは静的な値のため、エラーは発生しない
- テキストフィールドの `InputProps.style.backgroundColor` を `#ffffff` に設定することで、背景色との視認性を確保する

### 訪問査定取得者フィールド

- `employees` リストが空の場合: 「未選択」のみ表示される（既存の `visitAssignee` と同様の挙動）
- 未選択のまま送信: `visitAcquirer` は `undefined` としてAPIに送信される（任意フィールド）

### 次電日強調表示

- `nextCallDate` が空の場合: `color='warning'` と `focused={true}` を適用して警告枠線を表示
- `nextCallDate` に値がある場合: 通常スタイルに戻る
- 既存の「次電日未入力確認ダイアログ」との連携: 強調表示はあくまで視覚的なヒントであり、送信時の確認ダイアログは既存ロジックを維持する

---

## テスト戦略

### 単体テスト（例ベース）

以下の項目は例ベーステストで確認する：

1. **セクション背景色の適用**
   - 各 `Paper` コンポーネントに正しい `backgroundColor` が設定されているか
   - テキストフィールドの `InputProps.style.backgroundColor` が `#ffffff` か

2. **訪問査定取得者フィールドの表示**
   - フィールドが訪問査定情報セクションに存在するか
   - 社員リストのオプションが正しく表示されるか
   - 「営担」フィールドの直後に配置されているか

3. **次電日フィールドの強調スタイル**
   - Grid item に `backgroundColor: '#fff9c4'` が設定されているか
   - `InputLabelProps.style` に `fontWeight: 'bold'` と `color: '#d32f2f'` が設定されているか

### プロパティベーステスト

PBTライブラリ: `fast-check`（TypeScript/React プロジェクトに適合）

各プロパティテストは最低100回のイテレーションで実行する。

#### プロパティ1: visitAcquirer ラウンドトリップ

```typescript
// Feature: seller-registration-ui-enhancement, Property 1: visitAcquirer round-trip
it('任意の社員を選択してフォーム送信すると visitAcquirer がAPIリクエストに含まれる', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...mockEmployees),
      (employee) => {
        // 社員を選択してフォームを送信
        // APIリクエストのvisitAcquirerが選択した社員のイニシャルと一致することを確認
      }
    ),
    { numRuns: 100 }
  );
});
```

#### プロパティ2: 次電日未入力時の警告スタイル

```typescript
// Feature: seller-registration-ui-enhancement, Property 2: nextCallDate warning style
it('nextCallDateが空の場合はwarningスタイルが適用される', () => {
  fc.assert(
    fc.property(
      fc.oneof(fc.constant(''), fc.date().map(d => d.toISOString().split('T')[0])),
      (dateValue) => {
        // dateValueが空の場合はcolor='warning'が適用される
        // dateValueが空でない場合はcolor='warning'が適用されない
      }
    ),
    { numRuns: 100 }
  );
});
```

### スナップショットテスト

- コンポーネント全体のスナップショットを取得し、スタイル変更が意図しない箇所に影響していないことを確認

### 統合テスト

- フォーム送信時のAPIリクエストペイロードに `visitAcquirer` が含まれることを確認（モックAPIを使用）
