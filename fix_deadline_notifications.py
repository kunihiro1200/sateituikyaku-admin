#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
業務依頼の納期通知メール修正スクリプト

【BusinessSiteDeadlineHourlyNotificationService】
1. parseDueDateAsJST を datetime 対応に修正（時刻情報を正しく解釈）
2. サイト登録の参照フィールドを site_registration_deadline → site_registration_due_date に変更
3. サイト登録・間取図の本文を「遅れる～」に修正

【WorkTaskDeadlineNotificationService】
1. サイト登録ステータスを当日通知から除外（1時間前通知に任せる）
2. 売買契約の本文「送れるようであれば」→「遅れる可能性がある場合は」に修正
   ※ WorkTaskDeadlineNotificationService の本文はすでに「遅れる可能性がある場合は」に
      なっているため、変更不要。スクショの本文は古いデプロイ版のもの。
"""

# ============================================================
# 1. BusinessSiteDeadlineHourlyNotificationService の修正
# ============================================================
path1 = 'backend/src/services/BusinessSiteDeadlineHourlyNotificationService.ts'

with open(path1, 'rb') as f:
    text = f.read().decode('utf-8')

# --- 1-1. parseDueDateAsJST を datetime 対応に修正 ---
old_parse = '''  /**
   * 日付文字列（YYYY-MM-DD）をJST 00:00:00 として解釈した Date を返す
   * 無効な値の場合は null を返す
   */
  parseDueDateAsJST(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    // YYYY-MM-DD 形式チェック
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dateStr)) return null;
    const d = new Date(dateStr + 'T00:00:00+09:00');
    if (isNaN(d.getTime())) return null;
    return d;
  }'''

new_parse = '''  /**
   * 日付・日時文字列を JST として解釈した Date を返す
   * - "YYYY-MM-DD HH:MM:SS" 形式 → JST の時刻として解釈
   * - "YYYY-MM-DD" 形式 → JST 00:00:00 として解釈
   * 無効な値の場合は null を返す
   */
  parseDueDateAsJST(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    // "YYYY-MM-DD HH:MM:SS" 形式（datetime）
    const datetimeMatch = dateStr.match(/^(\\d{4}-\\d{2}-\\d{2})[T ]?(\\d{2}:\\d{2}(?::\\d{2})?)$/);
    if (datetimeMatch) {
      const d = new Date(datetimeMatch[1] + 'T' + datetimeMatch[2] + '+09:00');
      if (isNaN(d.getTime())) return null;
      return d;
    }
    // "YYYY-MM-DD" 形式（date のみ）→ JST 00:00:00
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(dateStr)) {
      const d = new Date(dateStr + 'T00:00:00+09:00');
      if (isNaN(d.getTime())) return null;
      return d;
    }
    return null;
  }'''

text = text.replace(old_parse, new_parse)

# --- 1-2. サイト登録の参照フィールドを site_registration_due_date に変更 ---
old_site_field = '''      // サイト登録通知チェック
      const siteDeadlineStr = task.site_registration_deadline;
      const siteOkSent = task.site_registration_ok_sent;

      if (siteDeadlineStr) {
        const dueDateTime = this.parseDueDateAsJST(siteDeadlineStr);'''

new_site_field = '''      // サイト登録通知チェック（site_registration_due_date = 納期予定日・datetime型）
      const siteDeadlineStr = task.site_registration_due_date;
      const siteOkSent = task.site_registration_ok_sent;

      if (siteDeadlineStr) {
        const dueDateTime = this.parseDueDateAsJST(siteDeadlineStr);'''

text = text.replace(old_site_field, new_site_field)

# --- 1-3. サイト登録の本文を修正 ---
old_site_body = '''        if (target.notificationType === 'site_registration') {
          subject = `${target.property_number}/${target.property_address}のサイト登録の納期が${remainingTime}です！！`;
          body = [
            'サイト登録者へ、至急メール送信してください！！',
            `${target.property_number}/${target.property_address}のサイト登録の納期が${remainingTime}ですが大丈夫でしょうか？`,
            'ご確認の程よろしくお願い致します。',
          ].join('\\n');
        } else {
          subject = `${target.property_number}/${target.property_address}の間取図作成の納期が${remainingTime}です！！`;
          body = [
            '間取図作成者へ、至急メール送信してください！！',
            `${target.property_number}/${target.property_address}の間取図作成の納期が${remainingTime}ですが大丈夫でしょうか？`,
            'ご確認の程よろしくお願い致します。',
          ].join('\\n');
        }'''

new_site_body = '''        if (target.notificationType === 'site_registration') {
          subject = `${target.property_number}/${target.property_address}のサイト登録の納期が迫っています！！`;
          body = [
            `${target.property_number}/${target.property_address}のサイト登録の納期が${remainingTime}です。`,
            '遅れる可能性がある場合は担当、上長に相談してください。',
            'ご確認の程よろしくお願い致します。',
          ].join('\\n');
        } else {
          subject = `${target.property_number}/${target.property_address}の間取図作成の納期が迫っています！！`;
          body = [
            `${target.property_number}/${target.property_address}の間取図作成の納期が${remainingTime}です。`,
            '遅れる可能性がある場合は担当、上長に相談してください。',
            'ご確認の程よろしくお願い致します。',
          ].join('\\n');
        }'''

text = text.replace(old_site_body, new_site_body)

with open(path1, 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'[1] {path1} 修正完了')

# ============================================================
# 2. WorkTaskDeadlineNotificationService の修正
# ============================================================
path2 = 'backend/src/services/WorkTaskDeadlineNotificationService.ts'

with open(path2, 'rb') as f:
    text = f.read().decode('utf-8')

# --- 2-1. サイト登録ステータスを当日通知から除外 ---
old_filter = '''      if (!status) continue;
      if (!isDeadlineToday(status)) continue;

      targets.push({'''

new_filter = '''      if (!status) continue;
      if (!isDeadlineToday(status)) continue;
      // サイト登録は1時間前通知（BusinessSiteDeadlineHourlyNotificationService）に任せる
      if (status.startsWith('サイト登録依頼してください')) continue;

      targets.push({'''

text = text.replace(old_filter, new_filter)

# --- 2-2. 本文の「送れるようであれば」を修正（念のため）---
text = text.replace(
    'ですが送れるようであれば担当、上長に相談してください。',
    'です。遅れる可能性がある場合は担当、上長に相談してください。'
)

with open(path2, 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'[2] {path2} 修正完了')

# エンコーディング確認
for path in [path1, path2]:
    with open(path, 'rb') as f:
        head = f.read(3)
    bom = 'BOM付き（要注意）' if head == b'\xef\xbb\xbf' else 'BOMなし（正常）'
    print(f'  エンコーディング: {path} → {bom}')

print('\n完了！')
