#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SmsPreViewingNoPhoneBug.property.test.ts の探索テスト1のアサートを
修正済みコードに合わせて更新するスクリプト

修正後: shouldShowSmsButton_buggy は buyer.phone_number のみで判定するため
電話番号あり・メールあり の場合も true を返す。
"""

file_path = 'frontend/frontend/src/__tests__/SmsPreViewingNoPhoneBug.property.test.ts'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 探索テスト1のアサートを修正
# 修正前: expect(buggyResult).toBe(false); // バグの存在を確認
# 修正後: expect(buggyResult).toBe(true); // 修正済み: 電話番号があればSMSボタンが表示される
old_assert = '    expect(buggyResult).toBe(false); // バグの存在を確認'
new_assert = '    expect(buggyResult).toBe(true); // 修正済み: 電話番号があればSMSボタンが表示される'

if old_assert in text:
    text = text.replace(old_assert, new_assert)
    print(f'アサートを更新しました')
else:
    print('ERROR: 対象のアサートが見つかりませんでした')
    # CRLF対応
    old_assert_crlf = old_assert.replace('\n', '\r\n')
    if old_assert_crlf in text:
        text = text.replace(old_assert_crlf, new_assert)
        print('CRLF版で更新しました')
    else:
        # 部分一致で確認
        if 'expect(buggyResult).toBe(false)' in text:
            text = text.replace(
                'expect(buggyResult).toBe(false); // バグの存在を確認',
                'expect(buggyResult).toBe(true); // 修正済み: 電話番号があればSMSボタンが表示される'
            )
            print('部分一致で更新しました')
        else:
            print('ERROR: 見つかりませんでした')
            exit(1)

# UTF-8（BOMなし）で書き込む
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])}')
