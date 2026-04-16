# -*- coding: utf-8 -*-
"""
タスク1: POST / エンドポイントのメール送信ロジックを修正する
UTF-8安全に buyer-appointments.ts を書き換えるスクリプト
"""

import sys

FILE_PATH = 'backend/src/routes/buyer-appointments.ts'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ---- 変更1: リクエストボディの分割代入に新フィールドを追加 ----
OLD_DESTRUCTURE = (
    "      const { buyerNumber, startTime, endTime, assignedTo, buyerName, buyerPhone, "
    "buyerEmail, viewingMobile, propertyAddress, propertyGoogleMapUrl, inquiryHearing, "
    "creatorName, customTitle, customDescription, propertyNumber } = req.body;"
)
NEW_DESTRUCTURE = (
    "      const { buyerNumber, startTime, endTime, assignedTo, buyerName, buyerPhone, "
    "buyerEmail, viewingMobile, viewingTypeGeneral, viewingDate, viewingTime, "
    "followUpAssignee, propertyAddress, propertyGoogleMapUrl, inquiryHearing, "
    "creatorName, customTitle, customDescription, propertyNumber } = req.body;"
)

if OLD_DESTRUCTURE not in text:
    print("ERROR: 分割代入の対象文字列が見つかりません。")
    sys.exit(1)

text = text.replace(OLD_DESTRUCTURE, NEW_DESTRUCTURE, 1)

# ---- 変更2: メール送信ブロック全体を置き換える ----
OLD_EMAIL_BLOCK = """      // カレンダー登録成功後にメール通知を送信（失敗してもカレンダー登録は成功扱い）
      try {
        const recipients: string[] = [];

        // 1. 後続担当のメールアドレスを追加
        if (assignedEmployee.email) {
          recipients.push(assignedEmployee.email);
        }

        // 2. 物件担当者（sales_assignee）のメールアドレスを取得して追加
        let salesAssigneeInitials = '';
        if (propertyNumber) {
          const { data: propertyData } = await supabase
            .from('property_listings')
            .select('sales_assignee')
            .eq('property_number', propertyNumber)
            .single();

          if (propertyData?.sales_assignee) {
            salesAssigneeInitials = propertyData.sales_assignee;
            const salesEmployee = await employeeUtils.getEmployeeByInitials(propertyData.sales_assignee);
            if (salesEmployee?.email && salesEmployee.email !== assignedEmployee.email) {
              recipients.push(salesEmployee.email);
            }
          }
        }

        // 3. 売主情報を取得（物件番号 = 売主番号）
        let ownerName = 'なし';
        let ownerPhone = 'なし';
        if (propertyNumber) {
          const { data: sellerData } = await supabase
            .from('sellers')
            .select('name, phone_number')
            .eq('seller_number', propertyNumber)
            .single();
          if (sellerData) {
            try {
              ownerName = sellerData.name ? decrypt(sellerData.name) : 'なし';
            } catch {
              ownerName = sellerData.name || 'なし';
            }
            try {
              ownerPhone = sellerData.phone_number ? decrypt(sellerData.phone_number) : 'なし';
            } catch {
              ownerPhone = sellerData.phone_number || 'なし';
            }
          }
        }

        if (recipients.length > 0) {
          const startDate = new Date(startTime);
          const endDate = new Date(endTime);
          const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
          const weekday = weekdays[startDate.getDay()];
          const dateStr = `${startDate.getFullYear()}/${startDate.getMonth() + 1}/${startDate.getDate()}`;
          const startTimeStr = startDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          const endTimeStr = endDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          const frontendUrl = (process.env.FRONTEND_URL || 'https://sateituikyaku-admin-frontend.vercel.app').split(',')[0].trim();

          const subject = `${propertyAddress || '物件住所未設定'}の内覧入りました！内覧担当：${assignedEmployee.name}`;
          const body = [
            `内覧担当は${assignedEmployee.name}です。`,
            `${viewingMobile || ''}`,
            `物件所在地「${propertyAddress || 'なし'}」`,
            `内覧日：${dateStr}(${weekday})`,
            `時間：${startTimeStr}〜${endTimeStr}`,
            `問合時コメント：${inquiryHearing || 'なし'}`,
            `売主様：${ownerName}`,
            `所有者連絡先：${ownerPhone}`,
            `買主番号：${buyerNumber}`,
            `物件番号：${propertyNumber || 'なし'}`,
            '',
            `${frontendUrl}/buyers/${buyerNumber}`,
          ].join('\\n');

          await emailService.sendEmail({ to: recipients, subject, body });
          console.log('[BuyerAppointments] Notification email sent to:', recipients);
        }
      } catch (emailError: any) {
        // メール送信失敗はログのみ（カレンダー登録の成功に影響させない）
        console.error('[BuyerAppointments] Failed to send notification email (non-fatal):', emailError.message);
      }"""

NEW_EMAIL_BLOCK = """      // カレンダー登録成功後にメール通知を送信（失敗してもカレンダー登録は成功扱い）
      try {
        // 1. 物件担当者（sales_assignee）のメールアドレスを取得
        let salesEmployee = null;
        let displayAddress = '（住所未設定）';
        if (propertyNumber) {
          const { data: propertyData } = await supabase
            .from('property_listings')
            .select('sales_assignee, display_address, address')
            .eq('property_number', propertyNumber)
            .single();

          // display_address → address → '（住所未設定）' のフォールバック
          displayAddress = propertyData?.display_address || propertyData?.address || '（住所未設定）';

          if (propertyData?.sales_assignee) {
            salesEmployee = await employeeUtils.getEmployeeByInitials(propertyData.sales_assignee);
          }
        }

        // sales_assignee が存在しない or メールアドレスなし → スキップ
        if (!salesEmployee?.email) {
          console.log('[BuyerAppointments] No sales_assignee email found, skipping notification email');
        } else {
          // 2. 売主情報を取得（物件番号 = 売主番号）
          let ownerName = 'なし';
          let ownerPhone = 'なし';
          if (propertyNumber) {
            const { data: sellerData } = await supabase
              .from('sellers')
              .select('name, phone_number')
              .eq('seller_number', propertyNumber)
              .single();
            if (sellerData) {
              try {
                ownerName = sellerData.name ? decrypt(sellerData.name) : 'なし';
              } catch {
                ownerName = sellerData.name || 'なし';
              }
              try {
                ownerPhone = sellerData.phone_number ? decrypt(sellerData.phone_number) : 'なし';
              } catch {
                ownerPhone = sellerData.phone_number || 'なし';
              }
            }
          }

          const subject = `${displayAddress}の内覧入りました！`;
          const body = [
            `内覧担当は${followUpAssignee || assignedTo || ''}です。`,
            `${viewingMobile || viewingTypeGeneral || ''}`,
            `物件所在地${displayAddress}`,
            `内覧日${viewingDate || ''}${viewingTime ? ' ' + viewingTime : ''}`,
            `問合時コメント：${inquiryHearing || 'なし'}`,
            `売主様：${ownerName}様`,
            `所有者連絡先${ownerPhone}`,
            `買主番号：${buyerNumber}`,
            `物件番号：${propertyNumber || 'なし'}`,
          ].join('\\n');

          await emailService.sendEmail({ to: [salesEmployee.email], subject, body });
          console.log('[BuyerAppointments] Notification email sent to:', salesEmployee.email);
        }
      } catch (emailError: any) {
        // メール送信失敗はログのみ（カレンダー登録の成功に影響させない）
        console.error('[BuyerAppointments] Failed to send notification email (non-fatal):', emailError.message);
      }"""

if OLD_EMAIL_BLOCK not in text:
    print("ERROR: メール送信ブロックの対象文字列が見つかりません。")
    # デバッグ用に一部を出力
    idx = text.find("カレンダー登録成功後にメール通知を送信")
    if idx >= 0:
        print("見つかった位置:", idx)
        print("前後の文字列:", repr(text[idx:idx+200]))
    sys.exit(1)

text = text.replace(OLD_EMAIL_BLOCK, NEW_EMAIL_BLOCK, 1)

# UTF-8（BOMなし）で書き込む
with open(FILE_PATH, 'wb') as f:
    f.write(text.encode('utf-8'))

print("完了: buyer-appointments.ts を正常に更新しました（UTF-8）")

# BOMチェック
with open(FILE_PATH, 'rb') as f:
    first_bytes = f.read(3)
if first_bytes == b'\xef\xbb\xbf':
    print("WARNING: BOM付きUTF-8が検出されました")
else:
    print("OK: BOMなしUTF-8です")
