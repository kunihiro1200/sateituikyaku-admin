# 実装計画: seller-presence

## 概要

Supabase Realtime Presence を使用して、売主一覧ページにプレゼンスバッジを表示する機能を実装する。
`useSellerPresence.ts` フックを新規作成し、`SellerDetailPage.tsx`・`CallModePage.tsx` でトラッキングを開始、`SellersPage.tsx` でバッジを表示する。

## タスク

- [x] 1. `useSellerPresence.ts` フックの実装
  - [x] 1.1 型定義と定数を定義する
    - `PresenceRecord`、`PresenceState`、`UseSellerPresenceSubscribeResult`、`UseSellerPresenceTrackResult` インターフェースを定義
    - `CHANNEL_NAME = 'seller-presence'`、`STALE_THRESHOLD_MS = 30 * 60 * 1000` を定義
    - `frontend/frontend/src/hooks/useSellerPresence.ts` を新規作成
    - _要件: 1.1, 1.3, 4.1_

  - [x] 1.2 `filterStaleRecords` 関数を実装する
    - `entered_at` から30分以上経過したレコードを除外するフィルタリング関数を実装
    - `export` してテスト可能にする
    - _要件: 4.1, 4.2_

  - [ ]* 1.3 `filterStaleRecords` のプロパティベーステストを書く
    - **Property 4: Staleレコードのフィルタリング**
    - **Validates: 要件 4.1, 4.2**
    - `fast-check` を使用し、31分〜24時間前の `entered_at` を持つレコードが全て除外されることを検証（100回実行）

  - [x] 1.4 `formatPresenceLabel` 関数を実装する
    - `filterStaleRecords` を呼び出してアクティブなレコードのみ対象にする
    - 「〇〇が入っています」形式のラベルを生成する
    - 複数ユーザーは「、」区切りで結合する
    - `export` してテスト可能にする
    - _要件: 3.2, 3.3_

  - [ ]* 1.5 `formatPresenceLabel` のプロパティベーステストを書く
    - **Property 3: 複数ユーザーのラベル生成**
    - **Validates: 要件 3.2, 3.3**
    - `fast-check` を使用し、任意のユーザー名リスト（1件以上）に対して全ユーザー名が含まれ「が入っています」で終わることを検証（100回実行）

  - [x] 1.6 `useSellerPresenceSubscribe` フックを実装する
    - Supabase チャンネル `seller-presence` に参加し `presence sync` イベントを購読
    - `presenceState`（`PresenceState`）と `isConnected`（`boolean`）を返す
    - `useEffect` のクリーンアップで `supabase.removeChannel()` を呼び出す
    - 接続失敗時は `console.error` でログ記録（要件5.2）
    - _要件: 2.1, 2.2, 2.3, 5.1, 5.2, 5.3_

  - [x] 1.7 `useSellerPresenceTrack` フックを実装する
    - `useAuthStore` から `employee.name` を取得
    - `sellerNumber` または `employee?.name` が未取得の場合は早期リターン（要件1.4）
    - チャンネルに参加し `track({ user_name, entered_at })` でプレゼンスを登録
    - アンマウント時に `untrack().finally(() => removeChannel())` でクリーンアップ
    - _要件: 1.1, 1.2, 1.3, 1.4, 5.3, 6.1, 6.2_

- [x] 2. チェックポイント - テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 3. `SellerDetailPage.tsx` への `useSellerPresenceTrack` 追加
  - [x] 3.1 `useSellerPresenceTrack` をインポートして呼び出す
    - `frontend/frontend/src/pages/SellerDetailPage.tsx` を修正
    - `useSellerPresenceTrack` をインポート
    - `seller?.sellerNumber` を引数として `useSellerPresenceTrack` を呼び出す
    - _要件: 1.1, 1.2, 1.3, 1.4_

- [x] 4. `CallModePage.tsx` への `useSellerPresenceTrack` 追加
  - [x] 4.1 `useSellerPresenceTrack` をインポートして呼び出す
    - `frontend/frontend/src/pages/CallModePage.tsx` を修正
    - `useSellerPresenceTrack` をインポート
    - `seller?.sellerNumber` を引数として `useSellerPresenceTrack` を呼び出す
    - _要件: 6.1, 6.2, 6.3_

- [x] 5. `SellersPage.tsx` へのプレゼンスバッジ表示追加
  - [x] 5.1 `useSellerPresenceSubscribe` と `formatPresenceLabel` をインポートして使用する
    - `frontend/frontend/src/pages/SellersPage.tsx` を修正
    - `useSellerPresenceSubscribe`、`formatPresenceLabel` をインポート
    - コンポーネント内で `const { presenceState } = useSellerPresenceSubscribe()` を呼び出す
    - _要件: 2.1, 5.1_

  - [x] 5.2 テーブル行にプレゼンスバッジ（MUI `Chip`）を追加する
    - `seller_number` 列の近くに `Chip` コンポーネントを追加
    - `presenceState[seller.sellerNumber]` が存在し `formatPresenceLabel` が空でない場合のみ表示
    - `color="warning"` と `size="small"` を設定
    - _要件: 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたサブタスクはオプションであり、スキップ可能
- プロパティベーステストには `fast-check` ライブラリを使用する
- 各タスクは要件の特定の受け入れ基準を参照している
- プレゼンス機能は既存の売主一覧の表示速度に影響しないよう非同期で実装する
