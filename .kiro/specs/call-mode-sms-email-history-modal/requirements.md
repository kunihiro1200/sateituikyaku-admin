# 要件ドキュメント

## はじめに

売主管理システムの通話モードページ（CallModePage）には、SMS・メール送信履歴を表示するサイドバーセクションがある。現在は履歴アイテムをクリックすると、その場（インライン）で本文が展開表示される。また、本文中の改行が `<BR>` という文字列のまま表示されており、視認性が低い。

本機能改善では、以下の2点を対応する：
1. 本文表示をインライン展開からモーダル（ポップアップ）表示に変更する
2. 本文中の `<BR>`（大文字・小文字問わず）を正しい改行として表示する

---

## 用語集

- **CallModePage**: 売主管理システムの通話モードページ（`frontend/frontend/src/pages/CallModePage.tsx`）
- **SMS・メール履歴セクション**: CallModePageのサイドバーに表示される「📋 メール・SMS履歴」セクション
- **Activity**: SMS送信またはメール送信の履歴レコード（`type: 'sms' | 'email'`）
- **本文モーダル**: 本機能で新たに追加するポップアップダイアログ
- **BR文字列**: 本文データ中に含まれる `<BR>` または `<br>` という文字列（HTMLタグではなくプレーンテキストとして保存されたもの）
- **History_Modal**: 本機能で追加するSMS・メール本文表示用モーダルコンポーネント

---

## 要件

### 要件1: 本文表示のモーダル化

**ユーザーストーリー:** 担当者として、SMS・メール送信履歴の本文をモーダルで確認したい。そうすることで、狭いサイドバー内でスクロールせずに本文全体を読みやすく確認できる。

#### 受け入れ基準

1. WHEN 履歴アイテムがクリックされる, THE CallModePage SHALL インライン展開パネルの代わりに本文モーダルを開く
2. THE History_Modal SHALL 送信種別（SMS または メール）をモーダルのタイトルに表示する
3. THE History_Modal SHALL 送信日時と送信者名をモーダル内に表示する
4. WHERE 送信種別がメールの場合, THE History_Modal SHALL 件名（subject）をモーダル内に表示する
5. THE History_Modal SHALL 本文をモーダル内に表示する
6. WHEN モーダルの閉じるボタンがクリックされる, THE History_Modal SHALL モーダルを閉じる
7. WHEN モーダル外の領域がクリックされる, THE History_Modal SHALL モーダルを閉じる
8. THE CallModePage SHALL インライン展開に使用していた `expandedActivityIds` 状態および `toggleActivityExpand` 関数を削除する
9. THE CallModePage SHALL 履歴アイテムの展開アイコン（ExpandMoreIcon / ExpandLessIcon）を削除する

### 要件2: BR文字列の改行変換

**ユーザーストーリー:** 担当者として、SMS・メール本文中の `<BR>` が正しく改行として表示されてほしい。そうすることで、送信した内容を正確に読み返すことができる。

#### 受け入れ基準

1. WHEN 本文データに `<BR>` または `<br>` が含まれる, THE History_Modal SHALL それらを改行（`\n`）に変換して表示する
2. THE History_Modal SHALL 変換後の本文を `whiteSpace: 'pre-wrap'` スタイルで表示し、改行を正しくレンダリングする
3. THE History_Modal SHALL メール本文（`activity.metadata?.body`）に対して BR変換を適用する
4. THE History_Modal SHALL SMS本文（`activity.content`）に対して BR変換を適用する
5. IF 本文データが null または undefined の場合, THEN THE History_Modal SHALL 「本文データなし（旧形式）」と表示する

### 要件3: モーダルの表示品質

**ユーザーストーリー:** 担当者として、モーダルが読みやすく使いやすい表示であってほしい。そうすることで、業務中にストレスなく履歴を確認できる。

#### 受け入れ基準

1. THE History_Modal SHALL 本文が長い場合にスクロール可能な領域内に表示する
2. THE History_Modal SHALL モバイル画面（sm ブレークポイント以下）でも正しく表示される
3. THE History_Modal SHALL SMS履歴と メール履歴で視覚的に区別できる色またはアイコンをタイトルに使用する
4. THE History_Modal SHALL MUI の `Dialog` コンポーネントを使用して実装する
