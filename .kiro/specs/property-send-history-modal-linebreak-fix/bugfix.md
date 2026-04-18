# Bugfix Requirements Document

## Introduction

物件リストの詳細ページにある「売主・物件の送信履歴」モーダルにおいて、メール本文の改行が正しく表示されない問題を修正する。
具体的には、メール本文中の `<br>` タグがHTMLとして解釈されず、プレーンテキストとしてそのまま画面に表示されてしまっている。
実際のメール送信は正常に行われており、モーダル上の表示のみが影響を受けている。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 「売主・物件の送信履歴」モーダルでメール本文を表示する THEN システムは `<br>` タグをHTMLとして解釈せず、`村尾和彦様<br><br>お世話になっております。<br>株式会社いふうです。` のようにタグ文字列がそのまま表示される

### Expected Behavior (Correct)

2.1 WHEN 「売主・物件の送信履歴」モーダルでメール本文を表示する THEN システムは SHALL `<br>` タグをHTMLとして解釈し、改行として正しくレンダリングする（例: 「村尾和彦様」の後に改行が入り、「お世話になっております。」が次の行に表示される）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 「売主・物件の送信履歴」モーダルでメール本文を表示する THEN システムは SHALL CONTINUE TO メール本文のテキスト内容（宛名・本文・署名など）を正確に表示する
3.2 WHEN 実際にメールを送信する THEN システムは SHALL CONTINUE TO メールを正常に送信する（送信機能は影響を受けない）
3.3 WHEN 「売主・物件の送信履歴」モーダルを開く THEN システムは SHALL CONTINUE TO 送信日時・件名・送信先などのメタ情報を正しく表示する
3.4 WHEN メール本文に `<br>` 以外のHTMLタグが含まれる THEN システムは SHALL CONTINUE TO XSSリスクを防ぐため、スクリプトタグなど危険なタグはサニタイズして表示する
