# -*- coding: utf-8 -*-
# NewBuyerPage.tsx に初動担当の条件付き必須バリデーションを追加するスクリプト

import sys

file_path = 'frontend/frontend/src/pages/NewBuyerPage.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 挿入対象：!name チェックの直後
old_str = """    if (!name) {
      setError('氏名は必須です');
      return;
    }

    setLoading(true);"""

new_str = """    if (!name) {
      setError('氏名は必須です');
      return;
    }

    // 初動担当の条件付き必須バリデーション（受付日2026/3/30以降）
    const receptionDateObj = receptionDate ? new Date(receptionDate) : null;
    const isAfterCutoff = receptionDateObj && receptionDateObj >= new Date('2026-03-30');
    if (isAfterCutoff) {
      const emailPhoneFilled = inquiryEmailPhone && String(inquiryEmailPhone).trim();
      const hearingFilled = inquiryHearing && String(inquiryHearing).trim();
      if ((emailPhoneFilled || hearingFilled) && (!initialAssignee || !String(initialAssignee).trim())) {
        setError('初動担当は必須です（受付日2026/3/30以降かつ問合メール電話対応または問合時ヒアリングが入力されている場合）');
        return;
      }
    }

    setLoading(true);"""

if old_str not in text:
    print('ERROR: 挿入対象の文字列が見つかりませんでした。')
    sys.exit(1)

new_text = text.replace(old_str, new_str, 1)

with open(file_path, 'wb') as f:
    f.write(new_text.encode('utf-8'))

print('Done! バリデーションを追加しました。')
