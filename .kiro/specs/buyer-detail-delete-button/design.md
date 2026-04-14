# 設計ドキュメント：買主リスト詳細画面への削除ボタン追加

## 概要

買主リスト詳細画面（BuyerDetailPage）のヘッダーに物理削除ボタンを追加する機能です。

現在、BuyerDetailPageには論理削除（`deleted_at`フラグ更新）の削除ボタンが既に存在します。
本機能では、これを**物理削除（完全削除）**に変更します。

売主通話モード（CallModePage）の削除ボタンと同様のUI・UXを提供し、削除前に確認ダイアログを表示することで誤操作を防止します。

---

## アーキテクチャ

### 変更対象

| 層 | ファイル | 変更内容 |
|----|---------|---------|
| フロントエンド | `frontend/frontend/src/pages/BuyerDetailPage.tsx` | 削除ボタンのハンドラーを物理削除APIに変更、ダイアログメッセージを変更 |
| バックエンド（ルート） | `backend/src/routes/buyers.ts` | `/api/buyers/:id/permanent` エンドポイントを追加 |
| バックエンド（サービス） | `backend/src/services/BuyerService.ts` | `permanentDelete` メソッドを追加 |

### 変更しないもの

- `backend/api/` 以下のファイル（公開物件サイト用バックエンド）は一切変更しない
- 既存の論理削除エンドポイント `DELETE /api/buyers/:id` は維持する（他の機能が依存している可能性があるため）

---

## コンポーネントとインターフェース

### フロントエンド変更点

#### BuyerDetailPage.tsx

既存の削除ボタンとダイアログを物理削除用に変更します。

**変更前（論理削除）**:
```typescript
// ハンドラー
const handleDeleteBuyer = async () => {
  await api.delete(`/api/buyers/${buyer.buyer_id}`);
  navigate('/buyers');
};

// ダイアログメッセージ
// 「削除後も復元可能ですが、一覧から非表示になります。」
```

**変更後（物理削除）**:
```typescript
// ハンドラー
const handleDeleteBuyer = async () => {
  await api.delete(`/api/buyers/${buyer.buyer_id}/permanent`);
  navigate('/buyers');
};

// ダイアログメッセージ
// 「この買主ナンバーが完全に削除されます。スプシも１行削除忘れないように！！」
```

削除ボタン自体のUI（赤色・outlined・small・DeleteIcon・「削除」テキスト）は既存のものをそのまま維持します。

### バックエンド新規エンドポイント

```
DELETE /api/buyers/:id/permanent
```

| 項目 | 内容 |
|------|------|
| メソッド | DELETE |
| パス | `/api/buyers/:id/permanent` |
| 認証 | 既存の `authenticate` ミドルウェア（JWT認証） |
| パラメータ | `id`: 買主のUUID または 買主番号 |
| 成功レスポンス | `200 { success: true }` |
| エラーレスポンス | `404 { error: 'Buyer not found' }` / `500 { error: message }` |

### BuyerService.permanentDelete メソッド

```typescript
async permanentDelete(buyerId: string): Promise<void>
```

- `buyers` テーブルから `buyer_id` が一致するレコードを `DELETE` SQLで完全削除
- `deleted_at` の更新ではなく、物理的なレコード削除を実行

---

## データモデル

### 既存テーブル構造（変更なし）

```sql
-- buyers テーブル（既存）
buyer_id        UUID PRIMARY KEY
buyer_number    TEXT
deleted_at      TIMESTAMP  -- 論理削除フラグ（物理削除では使用しない）
...
```

### 物理削除の動作

```sql
-- 物理削除（permanentDelete）
DELETE FROM buyers WHERE buyer_id = $1;

-- 論理削除（既存のsoftDelete、変更なし）
UPDATE buyers SET deleted_at = NOW() WHERE buyer_id = $1;
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ 1: 物理削除後のレコード不存在

*任意の* 有効な買主IDに対して `permanentDelete` を実行した後、そのIDでレコードを検索すると（`deleted_at` を含む全フィールドを対象にしても）レコードが存在しないこと

**Validates: Requirements 3.1, 3.5**

### プロパティ 2: 物理削除は論理削除と異なる

*任意の* 有効な買主IDに対して `permanentDelete` を実行した後、`includeDeleted=true` オプションで検索してもレコードが見つからないこと（論理削除では `includeDeleted=true` で見つかるが、物理削除では見つからない）

**Validates: Requirements 3.5**

---

## エラーハンドリング

### バックエンド

| エラーケース | 対応 |
|------------|------|
| 買主が存在しない | `404 Not Found` を返す |
| DB削除エラー | `500 Internal Server Error` を返す |
| 認証エラー | 既存の `authenticate` ミドルウェアが `401` を返す |

### フロントエンド

| エラーケース | 対応 |
|------------|------|
| API呼び出し失敗 | スナックバーにエラーメッセージを表示（既存の `setSnackbar` を使用） |
| 削除処理中 | ボタンを無効化し「削除中...」テキストを表示（既存の `deleting` ステートを使用） |

---

## テスト戦略

### ユニットテスト

**BuyerService.permanentDelete**:
- 存在する買主IDを渡した場合、レコードが完全に削除されること
- 存在しない買主IDを渡した場合、エラーがスローされること

**BuyerDetailPage（削除ダイアログ）**:
- 削除ボタンクリックでダイアログが開くこと
- ダイアログに正しいメッセージが表示されること
- キャンセルボタンでダイアログが閉じること
- 削除成功後に `/buyers` へ遷移すること
- 削除失敗時にスナックバーが表示されること

### プロパティベーステスト

プロパティ 1 と プロパティ 2 は、ランダムな買主データを生成してテストします。

**使用ライブラリ**: `fast-check`（TypeScript向けプロパティベーステストライブラリ）

**設定**: 各プロパティテストは最低100回実行

**タグ形式**: `Feature: buyer-detail-delete-button, Property {番号}: {プロパティ内容}`

```typescript
// プロパティ 1 の実装例
import fc from 'fast-check';

test('Feature: buyer-detail-delete-button, Property 1: 物理削除後のレコード不存在', async () => {
  await fc.assert(
    fc.asyncProperty(fc.uuid(), async (buyerId) => {
      // テスト用レコードを作成
      await createTestBuyer(buyerId);
      // 物理削除を実行
      await buyerService.permanentDelete(buyerId);
      // レコードが存在しないことを確認（includeDeleted=trueでも）
      const result = await buyerService.getById(buyerId);
      return result === null;
    }),
    { numRuns: 100 }
  );
});
```

### 統合テスト

- `DELETE /api/buyers/:id/permanent` エンドポイントが正しく動作すること（1〜2件の代表的なケース）
- 認証なしでアクセスした場合に `401` が返ること

---

## 実装上の注意事項

1. **エンコーディング**: `BuyerDetailPage.tsx` は日本語を含むため、変更はPythonスクリプトでUTF-8書き込みを使用すること
2. **バックエンド分離**: `backend/api/` は触らず、`backend/src/` のみ変更すること
3. **既存エンドポイント維持**: `DELETE /api/buyers/:id`（論理削除）は削除しないこと
4. **スプシ対応**: 削除確認ダイアログのメッセージでスプレッドシートの手動削除を促すこと
