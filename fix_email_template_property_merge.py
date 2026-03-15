#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""EmailTemplateService に物件用プレースホルダー置換メソッドを追加"""

with open('backend/src/services/EmailTemplateService.ts', 'rb') as f:
    content = f.read().decode('utf-8')

# mergeAngleBracketPlaceholders の後に mergePropertyTemplate を追加
old_end = """  /**
   * <<>> 形式のプレースホルダーを実際のデータで置換する
   * 例: <<住居表示>> → 物件住所, <<●氏名・会社名>> → 買主名
   */
  mergeAngleBracketPlaceholders("""

new_end = """  /**
   * 物件報告メール用プレースホルダー置換
   * <<●所有者情報>> → 売主氏名 + 様
   * <<担当名（営業）名前>> → sales_assignee
   * <<担当名（営業）電話番号>> → スタッフの電話番号
   * <<担当名（営業）メールアドレス>> → スタッフのメールアドレス
   * <<担当名（営業）固定休>> → スタッフの固定休
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
    const ownerLabel = sellerName ? `${sellerName}様` : '';
    result = result.replace(/<<●所有者情報>>/g, ownerLabel);

    // <<担当名（営業）名前>> → sales_assignee
    const salesAssignee = property['sales_assignee'] || '';
    result = result.replace(/<<担当名（営業）名前>>/g, salesAssignee);

    // <<担当名（営業）電話番号>> → スタッフの電話番号
    result = result.replace(/<<担当名（営業）電話番号>>/g, staffInfo?.phone || '');

    // <<担当名（営業）メールアドレス>> → スタッフのメールアドレス
    result = result.replace(/<<担当名（営業）メールアドレス>>/g, staffInfo?.email || '');

    // <<担当名（営業）固定休>> → スタッフの固定休
    result = result.replace(/<<担当名（営業）固定休>>/g, staffInfo?.regularHoliday || '');

    // その他 <<XXX>> → property_listings の対応カラム値
    result = result.replace(/<<([^>]+)>>/g, (_match: string, key: string) => {
      const trimmedKey = key.trim();
      // property オブジェクトのキーを検索（スネークケース・キャメルケース両対応）
      if (property[trimmedKey] !== undefined && property[trimmedKey] !== null) {
        return String(property[trimmedKey]);
      }
      // スネークケース変換して検索
      const snakeKey = trimmedKey.replace(/\s+/g, '_').toLowerCase();
      if (property[snakeKey] !== undefined && property[snakeKey] !== null) {
        return String(property[snakeKey]);
      }
      // 見つからない場合は空文字
      return '';
    });

    return result;
  }

  /**
   * <<>> 形式のプレースホルダーを実際のデータで置換する
   * 例: <<住居表示>> → 物件住所, <<●氏名・会社名>> → 買主名
   */
  mergeAngleBracketPlaceholders("""

content = content.replace(old_end, new_end)

with open('backend/src/services/EmailTemplateService.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done: EmailTemplateService updated')
