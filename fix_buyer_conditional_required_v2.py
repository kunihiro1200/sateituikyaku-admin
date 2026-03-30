# -*- coding: utf-8 -*-
"""
buyer-conditional-required-fix タスク3.1
owned_home_hearing_result ボタン選択解除時のコールバックを修正する。

バグ: isHomeHearingResultRequired を確認せずに next.add('owned_home_hearing_result') を実行
修正: isHomeHearingResultRequired(buyer) が true の場合のみ add を実行する

ルール: 日本語を含むファイルの編集は open('rb') + open('wb') + encode('utf-8') で行う
"""

import sys

FILE_PATH = 'frontend/frontend/src/pages/BuyerDetailPage.tsx'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# バグ箇所の修正
# ボタン選択解除時のコールバックで isHomeHearingResultRequired を確認する
# ============================================================

OLD_CALLBACK = (
    "                                      setMissingRequiredFields(prev => {\n"
    "                                        const next = new Set(prev);\n"
    "                                        if (newValue && String(newValue).trim()) next.delete('owned_home_hearing_result');\n"
    "                                        else next.add('owned_home_hearing_result');\n"
    "                                        return next;\n"
    "                                      });\n"
    "                                      // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない"
)

NEW_CALLBACK = (
    "                                      setMissingRequiredFields(prev => {\n"
    "                                        const next = new Set(prev);\n"
    "                                        if (newValue && String(newValue).trim()) {\n"
    "                                          next.delete('owned_home_hearing_result');\n"
    "                                        } else if (isHomeHearingResultRequired(buyer)) {\n"
    "                                          // owned_home_hearing_inquiry に値がある場合のみ必須扱いにする\n"
    "                                          next.add('owned_home_hearing_result');\n"
    "                                        } else {\n"
    "                                          next.delete('owned_home_hearing_result');\n"
    "                                        }\n"
    "                                        return next;\n"
    "                                      });\n"
    "                                      // SAVE_BUTTON_FIELDS に含まれるため handleInlineFieldSave は呼ばない"
)

if NEW_CALLBACK in text:
    print('修正は既に適用済みです。スキップします。')
elif OLD_CALLBACK in text:
    text = text.replace(OLD_CALLBACK, NEW_CALLBACK, 1)
    print('ボタン選択解除時のコールバックを修正しました。')
else:
    print('ERROR: 対象のコールバックが見つかりません。', file=sys.stderr)
    # デバッグ用: 周辺テキストを確認
    idx = text.find("next.add('owned_home_hearing_result')")
    if idx >= 0:
        print(f'  → next.add の箇所は {idx} 文字目に見つかりました。', file=sys.stderr)
        print(f'  → 周辺テキスト: {repr(text[idx-200:idx+100])}', file=sys.stderr)
    sys.exit(1)

# ============================================================
# UTF-8 で書き戻す
# ============================================================
with open(FILE_PATH, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了: BuyerDetailPage.tsx を UTF-8 で書き戻しました。')
