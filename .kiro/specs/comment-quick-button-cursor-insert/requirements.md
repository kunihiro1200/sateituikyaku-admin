# 要件ドキュメント

## はじめに

売主リスト（通話モードページ）のコメントセクションには、よく使うフレーズをワンクリックで挿入できる「クイックボタン」機能がある。現状の実装では、ボタンを押すとテキストが常にコメントテキストエリアの先頭（一番上）に挿入される。この機能を改善し、テキストエリアのカーソル位置（キャレット位置）にテキストを挿入するよう変更する。

## 用語集

- **System**: 売主管理システム（社内管理システム）のフロントエンド
- **CallModePage**: 通話モードページ（`frontend/frontend/src/pages/CallModePage.tsx`）
- **RichTextCommentEditor**: コメント入力用のリッチテキストエディタコンポーネント（`frontend/frontend/src/components/RichTextCommentEditor.tsx`）
- **クイックボタン**: コメントセクションに配置された、定型文をワンクリックで挿入するためのChipボタン群
- **カーソル位置（キャレット位置）**: テキストエリア内でユーザーが最後にクリックまたは入力した位置
- **appendBoldText**: 現在クイックボタンのクリック時に呼ばれる、テキストを先頭に挿入する関数

## 要件

### 要件1：カーソル位置へのテキスト挿入

**ユーザーストーリー：** 社内スタッフとして、クイックボタンを押したとき、コメントテキストエリアの現在のカーソル位置にテキストが挿入されることを望む。そうすることで、コメントの任意の位置に素早く定型文を追加できる。

#### 受け入れ基準

1. WHEN クイックボタンがクリックされ、かつ RichTextCommentEditor にフォーカスがある場合、THE System SHALL カーソル位置（キャレット位置）に太字テキストを挿入する
2. WHEN クイックボタンがクリックされ、かつ RichTextCommentEditor にフォーカスがない場合（カーソル位置が未設定の場合）、THE System SHALL テキストをコメントの先頭に追加する
3. WHEN テキストが挿入された後、THE System SHALL カーソルを挿入されたテキストの直後に移動する
4. THE RichTextCommentEditor SHALL カーソル位置への挿入を実行するための `insertAtCursor` メソッドを外部から呼び出せるよう `ref` 経由で公開する
5. WHEN `insertAtCursor` が呼び出された場合、THE RichTextCommentEditor SHALL `document.execCommand` または Selection API を使用してカーソル位置にHTMLテキストを挿入する

### 要件2：既存機能の維持

**ユーザーストーリー：** 社内スタッフとして、クイックボタンの無効化・視覚的フィードバック機能が引き続き正常に動作することを望む。そうすることで、既存のワークフローが壊れない。

#### 受け入れ基準

1. THE System SHALL クイックボタンの `pending`・`persisted` 状態管理（`useCallModeQuickButtonState`）を変更後も維持する
2. THE System SHALL クイックボタンの視覚的フィードバック（黄色ハイライト・取り消し線）を変更後も維持する
3. THE System SHALL 太字（`<b>`タグ）でテキストを挿入する既存の書式を維持する
