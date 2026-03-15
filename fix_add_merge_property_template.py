#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""EmailTemplateService に mergePropertyTemplate を追加"""

with open('backend/src/services/EmailTemplateService.ts', 'rb') as f:
    raw = f.read()

# CRLF -> LF に正規化して処理
content = raw.decode('utf-8').replace('\r\n', '\n')

# クラスの末尾に mergePropertyTemplate を挿入
old_end = "    return result;\n  }\n}\n"

new_end = """    return result;
  }

  /**
   * 物件報告メール用プレースホルダー置換
   * <<●所有者情報>> → 売主氏名 + 様
   * <<担当名（営業）名前>> → sales_assignee
   * <<担当名（営業）電話番号/メールアドレス/固定休>> → スタッフ情報
   * その他 <<XXX>> → property_listings の対応カラム値
   */
  mergePropertyTemplate(
    text: string,
    property: Record<string, any>,
    sellerName: string,
    staffInfo: { name?: string; phone?: string | null; email?: string | null; regularHoliday?: string | null } | null
  ): string {
    let result = text;

    // <<●所有者情報>> → 売主氏名 + 様
    result = result.replace(/<<●所有者情報>>/g, sellerName ? `${sellerName}様` : '');

    // <<担当名（営業）名前>> → sales_assignee
    result = result.replace(/<<担当名（営業）名前>>/g, property['sales_assignee'] || '');

    // <<担当名（営業）電話番号/メールアドレス/固定休>> → スタッフ情報
    result = result.replace(/<<担当名（営業）電話番号>>/g, staffInfo?.phone || '');
    result = result.replace(/<<担当名（営業）メールアドレス>>/g, staffInfo?.email || '');
    result = result.replace(/<<担当名（営業）固定休>>/g, staffInfo?.regularHoliday || '');

    // その他 <<XXX>> → property_listings の対応カラム値
    result = result.replace(/<<([^>]+)>>/g, (_match: string, key: string) => {
      const trimmedKey = key.trim();
      if (property[trimmedKey] !== undefined && property[trimmedKey] !== null) {
        return String(property[trimmedKey]);
      }
      return '';
    });

    return result;
  }
}
"""

if old_end in content:
    # 最後の出現箇所のみ置換（クラス末尾）
    idx = content.rfind(old_end)
    content = content[:idx] + new_end
    print('Replaced successfully')
else:
    print('ERROR: pattern not found')
    print(repr(content[-300:]))

with open('backend/src/services/EmailTemplateService.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done')
