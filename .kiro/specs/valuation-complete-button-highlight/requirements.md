# 要件定義書

## はじめに

売主リストの通話モードページにおいて、査定計算フィールドを編集した際に「完了」ボタンを視覚的に強調表示することで、ユーザーの保存忘れを防止する機能を追加します。

## 用語集

- **System**: 売主管理システム（通話モードページ）
- **User**: 営業担当者（売主データを編集するユーザー）
- **Valuation_Field**: 査定計算フィールド（査定額1、査定額2、査定額3、固定資産税路線価、査定担当、査定方法）
- **Complete_Button**: 査定計算セクションの「完了」ボタン
- **Highlight_State**: ボタンの強調表示状態（色、アニメーション、サイズなど）
- **Unsaved_Changes**: 保存されていない変更がある状態

## 要件

### 要件1: 査定計算フィールド編集時のボタン強調表示

**ユーザーストーリー**: 営業担当者として、査定計算フィールドを編集したら「完了」ボタンが光ることで、保存を忘れずに実行したい。

#### 受入基準

1. WHEN User が Valuation_Field を編集する、THEN THE System SHALL Complete_Button を Highlight_State に変更する
2. WHEN User が Complete_Button をクリックする、THEN THE System SHALL Highlight_State を解除する
3. WHEN User が編集した Valuation_Field を元の値に戻す、THEN THE System SHALL Highlight_State を解除する
4. WHILE Unsaved_Changes が存在する、THE System SHALL Complete_Button を Highlight_State に維持する
5. WHEN User がページを離れようとする AND Unsaved_Changes が存在する、THEN THE System SHALL 確認ダイアログを表示する

### 要件2: 視覚的な強調表示の実装

**ユーザーストーリー**: 営業担当者として、「完了」ボタンが目立つように光ることで、保存が必要であることを直感的に理解したい。

#### 受入基準

1. THE System SHALL Complete_Button の背景色を primary カラー（青）から warning カラー（オレンジ）に変更する
2. THE System SHALL Complete_Button にパルスアニメーション（脈打つような動き）を適用する
3. THE System SHALL Complete_Button のサイズを 10% 拡大する
4. THE System SHALL Complete_Button のテキストを「完了」から「保存して完了」に変更する
5. THE System SHALL アニメーションの周期を 1.5 秒に設定する

### 要件3: 対象フィールドの定義

**ユーザーストーリー**: 営業担当者として、どのフィールドを編集したら「完了」ボタンが光るのかを明確に理解したい。

#### 受入基準

1. THE System SHALL 以下の Valuation_Field を監視対象とする：
   - 査定額1（自動計算）
   - 査定額2（自動計算）
   - 査定額3（自動計算）
   - 手入力査定額1
   - 手入力査定額2
   - 手入力査定額3
   - 固定資産税路線価
   - 査定担当
   - 査定方法
2. THE System SHALL 上記以外のフィールド編集時は Highlight_State を変更しない
3. THE System SHALL 複数の Valuation_Field を編集した場合も Highlight_State を維持する

### 要件4: 保存完了後の状態リセット

**ユーザーストーリー**: 営業担当者として、「完了」ボタンをクリックして保存が成功したら、ボタンの強調表示が解除されることで、保存が完了したことを確認したい。

#### 受入基準

1. WHEN User が Complete_Button をクリックする AND 保存が成功する、THEN THE System SHALL Highlight_State を解除する
2. WHEN User が Complete_Button をクリックする AND 保存が失敗する、THEN THE System SHALL Highlight_State を維持する
3. WHEN 保存が成功する、THEN THE System SHALL スナックバーで「査定計算を保存しました」と表示する
4. WHEN 保存が失敗する、THEN THE System SHALL エラーメッセージを表示する

### 要件5: ページ離脱時の確認ダイアログ

**ユーザーストーリー**: 営業担当者として、査定計算を編集したまま保存せずにページを離れようとしたら、確認ダイアログが表示されることで、保存忘れを防ぎたい。

#### 受入基準

1. WHEN User がページを離れようとする AND Unsaved_Changes が存在する、THEN THE System SHALL 確認ダイアログを表示する
2. THE System SHALL 確認ダイアログに「保存されていない変更があります。ページを離れますか？」と表示する
3. WHEN User が「キャンセル」をクリックする、THEN THE System SHALL ページ遷移をキャンセルする
4. WHEN User が「離れる」をクリックする、THEN THE System SHALL ページ遷移を許可する
5. WHEN User が Complete_Button をクリックして保存が成功する、THEN THE System SHALL 確認ダイアログを表示しない

### 要件6: 初期状態の判定

**ユーザーストーリー**: 営業担当者として、ページを開いた時点で査定計算フィールドに値が入っている場合、編集していない状態では「完了」ボタンが光らないことを確認したい。

#### 受入基準

1. WHEN User がページを開く、THEN THE System SHALL 初期値を記録する
2. WHEN User が Valuation_Field を編集する AND 編集後の値が初期値と異なる、THEN THE System SHALL Highlight_State に変更する
3. WHEN User が Valuation_Field を編集する AND 編集後の値が初期値と同じ、THEN THE System SHALL Highlight_State を解除する
4. THE System SHALL 空文字列と null を同じ値として扱う
5. THE System SHALL 数値フィールドの場合、文字列比較ではなく数値比較を行う

### 要件7: 複数ユーザーによる同時編集の考慮

**ユーザーストーリー**: 営業担当者として、他のユーザーが同じ売主の査定計算を編集している場合でも、自分の編集状態が正しく反映されることを確認したい。

#### 受入基準

1. THE System SHALL 各ユーザーのブラウザで独立して Unsaved_Changes を管理する
2. WHEN User が Complete_Button をクリックする、THEN THE System SHALL 最新のデータベース値を取得してから保存する
3. WHEN 保存時に競合が発生する、THEN THE System SHALL エラーメッセージを表示する
4. THE System SHALL 競合エラー時に「他のユーザーがデータを更新しました。ページを再読み込みしてください」と表示する

### 要件8: アクセシビリティ対応

**ユーザーストーリー**: 視覚障害のあるユーザーとして、スクリーンリーダーで「完了」ボタンの状態変化を認識したい。

#### 受入基準

1. THE System SHALL Complete_Button に aria-label 属性を追加する
2. WHEN Unsaved_Changes が存在する、THEN THE System SHALL aria-label を「保存して完了（未保存の変更があります）」に設定する
3. WHEN Unsaved_Changes が存在しない、THEN THE System SHALL aria-label を「完了」に設定する
4. THE System SHALL Complete_Button に role="button" 属性を設定する

### 要件9: パフォーマンス要件

**ユーザーストーリー**: 営業担当者として、査定計算フィールドを編集した際に、ボタンの強調表示が即座に反映されることを期待する。

#### 受入基準

1. THE System SHALL Valuation_Field の変更を 100ms 以内に検知する
2. THE System SHALL Highlight_State の変更を 50ms 以内に適用する
3. THE System SHALL アニメーションを GPU アクセラレーションで実行する（transform プロパティを使用）
4. THE System SHALL 不要な再レンダリングを防ぐために React.memo を使用する

### 要件10: テスト可能性

**ユーザーストーリー**: 開発者として、この機能が正しく動作することを自動テストで検証したい。

#### 受入基準

1. THE System SHALL 各 Valuation_Field に data-testid 属性を設定する
2. THE System SHALL Complete_Button に data-testid="valuation-complete-button" 属性を設定する
3. THE System SHALL Highlight_State を data-highlight="true" 属性で表現する
4. THE System SHALL 確認ダイアログに data-testid="unsaved-changes-dialog" 属性を設定する
5. THE System SHALL テストコードで Highlight_State の変化を検証できるようにする

---

**最終更新日**: 2026年4月2日  
**作成者**: Kiro AI  
**承認者**: （未承認）
