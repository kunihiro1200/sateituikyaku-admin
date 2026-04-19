# 要件ドキュメント

## はじめに

業務リスト（業務依頼）の詳細画面（`WorkTaskDetailModal`）に、買主詳細画面（`BuyerDetailPage`）と同様のヘッダーナビゲーションバーを追加する機能の要件を定義する。

現在、`WorkTaskDetailModal`の`DialogTitle`には「業務一覧」ボタンのみが存在し、他の主要画面（売主リスト・買主リスト・物件リスト・共有・公開物件サイト）へのナビゲーションが提供されていない。本機能により、業務詳細画面からワンクリックで各主要画面へ遷移できるようになる。

## 用語集

- **WorkTaskDetailModal**: 業務リスト（業務依頼）の詳細を表示するフルスクリーンダイアログコンポーネント（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）
- **PageNavigation**: 売主リスト・買主リスト・物件リスト・業務依頼・共有・公開物件サイトへのナビゲーションボタンを横並びで表示するコンポーネント（`frontend/frontend/src/components/PageNavigation.tsx`）
- **BuyerDetailPage**: 買主詳細画面。`PageNavigation`をstickyヘッダーバーとして実装している参照実装（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **DialogTitle**: MUI（Material UI）の`Dialog`コンポーネントのタイトル領域
- **Header_Navigation_Bar**: `WorkTaskDetailModal`の`DialogTitle`内に追加するナビゲーションバー領域
- **Nav_Item**: ナビゲーションバー内の各ナビゲーションボタン（売主リスト・買主リスト・物件リスト・業務依頼・共有・公開物件サイト）

## 要件

### 要件1: ヘッダーナビゲーションバーの表示

**ユーザーストーリー:** 業務担当者として、業務詳細画面を開いたまま他の主要画面（売主リスト・買主リスト・物件リスト等）へ素早く移動したい。そうすることで、業務詳細を確認しながら関連する売主・買主・物件情報へシームレスに遷移できる。

#### 受け入れ基準

1. WHEN `WorkTaskDetailModal`が開かれる, THE `Header_Navigation_Bar` SHALL `PageNavigation`コンポーネントを`DialogTitle`内に表示する
2. THE `Header_Navigation_Bar` SHALL 既存の「業務一覧」ボタン・物件番号・物件情報バッジと同一行に横並びで表示される
3. THE `Header_Navigation_Bar` SHALL デスクトップ表示時に売主リスト・買主リスト・物件リスト・業務依頼・共有の5つのNav_Itemを横並びボタンとして表示する
4. THE `Header_Navigation_Bar` SHALL 公開物件サイトへのリンクボタンを表示する
5. WHILE 業務依頼画面が現在のページである場合, THE `Nav_Item`（業務依頼）SHALL アクティブ状態（紫背景）で表示される

### 要件2: ナビゲーション動作

**ユーザーストーリー:** 業務担当者として、業務詳細画面のナビゲーションボタンをクリックして対象画面へ遷移したい。そうすることで、モーダルを閉じる操作なしに直接目的の画面へ移動できる。

#### 受け入れ基準

1. WHEN `Nav_Item`（売主リスト）がクリックされる, THE `WorkTaskDetailModal` SHALL モーダルを閉じてから`/`（売主リスト）へ遷移する
2. WHEN `Nav_Item`（買主リスト）がクリックされる, THE `WorkTaskDetailModal` SHALL モーダルを閉じてから`/buyers`（買主リスト）へ遷移する
3. WHEN `Nav_Item`（物件リスト）がクリックされる, THE `WorkTaskDetailModal` SHALL モーダルを閉じてから`/property-listings`（物件リスト）へ遷移する
4. WHEN `Nav_Item`（業務依頼）がクリックされる, THE `WorkTaskDetailModal` SHALL モーダルを閉じてから`/work-tasks`（業務依頼一覧）へ遷移する
5. WHEN `Nav_Item`（共有）がクリックされる, THE `WorkTaskDetailModal` SHALL モーダルを閉じてから`/shared-items`（共有）へ遷移する
6. WHEN `Nav_Item`（公開物件サイト）がクリックされる, THE `WorkTaskDetailModal` SHALL 新しいタブで`/public/properties`を開く（モーダルは閉じない）

### 要件3: モバイル対応

**ユーザーストーリー:** スマートフォンを使用する業務担当者として、モバイル画面でも主要画面へのナビゲーションを利用したい。そうすることで、デバイスに関わらず一貫した操作体験を得られる。

#### 受け入れ基準

1. WHILE モバイル画面幅（`sm`ブレークポイント以下）である場合, THE `Header_Navigation_Bar` SHALL ハンバーガーアイコンボタンを表示する
2. WHEN ハンバーガーアイコンがクリックされる, THE `Header_Navigation_Bar` SHALL ドロワーメニューを開いて全Nav_Itemを縦並びで表示する
3. WHEN ドロワーメニュー内のNav_Itemがクリックされる, THE `WorkTaskDetailModal` SHALL ドロワーを閉じてからナビゲーションを実行する

### 要件4: 既存UIとの整合性

**ユーザーストーリー:** 開発者として、既存の`PageNavigation`コンポーネントを再利用して実装したい。そうすることで、コードの重複を避け、ナビゲーションの見た目・動作を全画面で統一できる。

#### 受け入れ基準

1. THE `WorkTaskDetailModal` SHALL 既存の`PageNavigation`コンポーネントをインポートして使用する（新規実装は行わない）
2. THE `Header_Navigation_Bar` SHALL `BuyerDetailPage`の`PageNavigation`実装と同等のスタイル・動作を持つ
3. THE `Header_Navigation_Bar` SHALL 既存の「業務一覧」ボタン・物件番号コピー機能・物件情報バッジの表示を維持する
4. IF `PageNavigation`の`onNavigate`プロパティが提供される場合, THEN THE `Header_Navigation_Bar` SHALL そのコールバックを通じてナビゲーションを実行する
