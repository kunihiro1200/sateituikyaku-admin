# 設計ドキュメント：viewing-result-chat-sent-popup

## 概要

内覧ページ（`BuyerViewingResultPage`）の「買付ハズレチャット送信」ボタン押下後、Chat送信APIが成功した際に、担当者へ「★最新状況」の更新を促すリマインダーポップアップ（`OfferFailedChatSentPopup`）を表示する機能。

OKボタン押下で買主詳細ページ（`/buyers/:buyer_number`）へ遷移する。

**変更範囲**: フロントエンドのみ（バックエンド変更なし）

---

## アーキテクチャ

```mermaid
graph TD
    A[BuyerViewingResultPage] -->|「買付ハズレチャット送信」ボタン押下| B[handleOfferChatSend]
    B -->|isOfferFailed() === true| C{API呼び出し}
    C -->|成功| D[offerFailedChatSentPopupOpen = true]
    C -->|失敗| E[スナックバーエラー表示]
    D --> F[OfferFailedChatSentPopup表示]
    F -->|「OK」ボタン押下| G[ポップアップを閉じる]
    G --> H[navigate to /buyers/:buyer_number]
    B -->|isOfferFailed() === false| I{API呼び出し}
    I -->|成功| J[スナックバー成功表示のみ]
```

### 変更ファイル一覧

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `frontend/frontend/src/components/OfferFailedChatSentPopup.tsx` | 新規作成 | リマインダーモーダルコンポーネント |
| `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` | 修正 | ポップアップ状態管理・表示ロジック追加 |

---

## コンポーネントとインターフェース

### OfferFailedChatSentPopup

新規作成するモーダルコンポーネント。`ChatNavigationPopup.tsx` と同様のパターンで MUI の `Dialog` を使用する。

```typescript
interface OfferFailedChatSentPopupProps {
  open: boolean;
  onOk: () => void; // 「OK」ボタン押下時
}
```

**UI仕様**:
- タイトル: なし（シンプルなメッセージのみ）
- メッセージ: 「正確な★最新状況を入力してください。注意！！ 『買付外れました』以外です！！」
- ボタン: 「OK」ボタン1つのみ（`variant="contained"` / `color="primary"`）
- `disableBackdropClick` / `disableEscapeKeyDown` は設定しない（デフォルト動作）

### BuyerViewingResultPage への変更

#### 追加する状態

```typescript
const [offerFailedChatSentPopupOpen, setOfferFailedChatSentPopupOpen] = useState(false);
```

#### handleOfferChatSend の変更箇所

既存の `handleOfferChatSend` 関数内、API成功時の処理に `isOfferFailed()` の判定を追加する。

```typescript
const handleOfferChatSend = async () => {
  // ... 既存のバリデーション処理 ...

  try {
    const response = await api.post(`/api/buyers/${buyer.buyer_number}/send-offer-chat`, {
      propertyNumber: linkedProperties[0].property_number,
      offerComment: buyer.offer_comment || '',
    });

    if (response.data.success) {
      // 【変更】買付ハズレの場合はポップアップを表示、通常の場合はスナックバーのみ
      if (isOfferFailed()) {
        setOfferFailedChatSentPopupOpen(true);
      } else {
        setSnackbar({
          open: true,
          message: 'Google Chatに送信しました',
          severity: 'success',
        });
      }
    } else {
      throw new Error(response.data.error || 'チャット送信に失敗しました');
    }
  } catch (error: any) {
    // ... 既存のエラー処理（変更なし） ...
  }
};
```

#### ナビゲーションハンドラー

```typescript
const handleOfferFailedChatSentPopupOk = () => {
  setOfferFailedChatSentPopupOpen(false);
  navigate(`/buyers/${buyer_number}`);
};
```

#### JSXへの追加

既存の `<Dialog>` や `<Snackbar>` と並べて追加する。

```tsx
<OfferFailedChatSentPopup
  open={offerFailedChatSentPopupOpen}
  onOk={handleOfferFailedChatSentPopupOk}
/>
```

---

## データモデル

本機能はフロントエンドのUI状態のみを扱う。新規DBカラム・APIエンドポイントの追加は不要。

| 状態変数 | 型 | 初期値 | 説明 |
|---------|-----|--------|------|
| `offerFailedChatSentPopupOpen` | `boolean` | `false` | ポップアップの表示/非表示 |

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において真であるべき特性・振る舞いのことです。プロパティは人間が読める仕様と機械検証可能な正確性保証の橋渡しをします。*

### プロパティ1: API成功時のポップアップ表示条件

*任意の* 買主番号・物件番号に対して、`isOfferFailed()` が `true` の状態で Chat送信APIが成功した場合、`offerFailedChatSentPopupOpen` は `true` になる。

**Validates: 要件1.1, 1.4, 1.5**

### プロパティ2: OKボタン押下時のナビゲーション先

*任意の* 買主番号（`buyer_number`）に対して、「OK」ボタン押下時のナビゲーション先は必ず `/buyers/{buyer_number}` となる。

**Validates: 要件2.1, 2.2**

---

## エラーハンドリング

| ケース | 対応 |
|--------|------|
| Chat送信APIが失敗した場合 | 既存の `.catch` でスナックバーにエラー表示。ポップアップは表示しない（要件1.4） |
| `navigate` 失敗 | React Router の標準エラーハンドリングに委ねる |
| `buyer_number` が `undefined` | `navigate` 呼び出し前に `buyer_number` が存在することを前提とする（ページ自体が `buyer_number` を必須パラメータとして持つため） |

---

## テスト戦略

### ユニットテスト（例ベース）

- `OfferFailedChatSentPopup` コンポーネントのレンダリングテスト
  - `open=true` のとき、指定メッセージが表示される
  - `open=true` のとき、「OK」ボタンが1つだけ表示される
  - `open=false` のとき、ダイアログが表示されない
  - 「OK」ボタンをクリックすると `onOk` が呼ばれる

- `handleOfferChatSend` のロジックテスト
  - `isOfferFailed()` が `false` のとき、API成功後にポップアップが開かない
  - API失敗時にポップアップが開かない

### プロパティベーステスト

本機能の中核ロジックはポップアップ表示条件とナビゲーション先の決定であり、PBTが適用可能。

**使用ライブラリ**: `fast-check`（プロジェクトのTypeScript/Vite環境に適合）

**プロパティテスト1: API成功時のポップアップ表示条件**
- *任意の* 買主番号・物件番号に対して、`isOfferFailed()` が `true` かつ API成功の場合のみポップアップが開く
- ジェネレーター: `fc.string()` で任意の買主番号・物件番号を生成
- 最低100回実行
- タグ: `Feature: viewing-result-chat-sent-popup, Property 1: API成功時のポップアップ表示条件`

**プロパティテスト2: OKボタン押下時のナビゲーション先**
- *任意の* 買主番号に対して、OKボタン押下時のナビゲーション先が `/buyers/{buyer_number}` であることを確認
- ジェネレーター: `fc.string()` で任意の買主番号を生成
- 最低100回実行
- タグ: `Feature: viewing-result-chat-sent-popup, Property 2: OKボタン押下時のナビゲーション先`

### 手動確認項目

1. `isOfferFailed()` が `true`（`isOfferFailedFlag=true`）の状態で「送信」ボタンを押す → Chat送信成功後にポップアップが表示される
2. `isOfferFailed()` が `false` の状態で「送信」ボタンを押す → ポップアップが表示されず、スナックバーのみ表示される
3. Chat送信APIが失敗した場合 → ポップアップが表示されない
4. ポップアップで「OK」を押す → ポップアップが閉じ、`/buyers/:buyer_number` に遷移する
5. ポップアップ表示中はバックグラウンドの操作が無効（MUI Dialogのデフォルトモーダル動作）
