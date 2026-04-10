# 実装計画: 通話モードページ コメントクイックボタン追加

## 概要

`frontend/frontend/src/pages/CallModePage.tsx` の「不通」ボタン直後に「お客様います」「当社紹介」の2つのChipボタンを追加する。
既存の `handleQuickButtonClick`、`isButtonDisabled`、`getButtonState`、`appendBoldText` をそのまま利用し、新規の関数・フック・状態管理は不要。
日本語を含むファイルのため、Pythonスクリプトを使用してUTF-8で安全に書き込む。

## タスク

- [x] 1. 挿入位置の特定とPythonスクリプトの作成
  - `frontend/frontend/src/pages/CallModePage.tsx` の「不通」Chipボタン周辺のコードを確認し、挿入位置を特定する
  - `scripts/add_quick_buttons.py` を作成する（UTF-8安全書き込み）
  - 挿入対象の文字列（「不通」Chipの閉じタグ直後）を特定してスクリプトに組み込む
  - _要件: 3.1_

- [x] 2. 「お客様います」ボタンの実装
  - [x] 2.1 Pythonスクリプトで「お客様います」Chipを追加する
    - `label="お客様います"`、`size="small"`、`clickable`
    - `id` は `call-memo-has-customer`
    - `onClick`: `handleQuickButtonClick('call-memo-has-customer')` + `appendBoldText('お客様からこの辺で探していると問合せがあったときにご紹介は控えたほうが良いですよね？')`
    - `disabled={isButtonDisabled('call-memo-has-customer')}`
    - `sx`: 通常時 `#fce4ec`、pending時 `#fff9c4` + 取り消し線、persisted時 `#e0e0e0` + 取り消し線
    - _要件: 1.1, 1.2, 1.3, 1.4, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 2.2 「お客様います」ボタンの単体テストを作成する
    - ページレンダリング時にラベル「お客様います」のChipが存在すること
    - クリック時に `handleQuickButtonClick('call-memo-has-customer')` が呼ばれること
    - クリック時に `appendBoldText` が正しいテキストで呼ばれること
    - _要件: 1.1, 1.2, 1.3_

- [x] 3. 「当社紹介」ボタンの実装
  - [x] 3.1 Pythonスクリプトで「当社紹介」Chipを追加する
    - `label="当社紹介"`、`size="small"`、`clickable`
    - `id` は `call-memo-our-referral`
    - `onClick`: `handleQuickButtonClick('call-memo-our-referral')` + `appendBoldText('当社紹介済み')`
    - `disabled={isButtonDisabled('call-memo-our-referral')}`
    - `sx`: 通常時 `#fce4ec`、pending時 `#fff9c4` + 取り消し線、persisted時 `#e0e0e0` + 取り消し線
    - _要件: 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.2 「当社紹介」ボタンの単体テストを作成する
    - ページレンダリング時にラベル「当社紹介」のChipが存在すること
    - クリック時に `handleQuickButtonClick('call-memo-our-referral')` が呼ばれること
    - クリック時に `appendBoldText('当社紹介済み')` が呼ばれること
    - _要件: 2.1, 2.2, 2.3_

- [x] 4. チェックポイント - ビルドエラーがないことを確認する
  - Pythonスクリプトを実行してファイルを書き換える
  - BOMなしUTF-8であることを確認する（`python -c "with open(...,'rb') as f: print(repr(f.read()[:3]))"` で先頭バイトを確認）
  - `getDiagnostics` でTypeScriptエラーがないことを確認する
  - 問題があればユーザーに確認する

- [-] 5. Vercelへのデプロイ
  - [x] 5.1 フロントエンドをVercelにデプロイする
    - `cd frontend/frontend && vercel --prod` を実行する
    - デプロイ後、通話モードページで2つのボタンが表示されることを確認する
    - _要件: 1.1, 2.1_

## 注意事項

- `*` が付いたタスクはオプションであり、スキップ可能
- `strReplace` ツールは使用しない（日本語ファイルのShift-JIS変換リスクのため）
- 必ずPythonスクリプト経由でUTF-8書き込みを行う
- バックエンドの変更は不要
