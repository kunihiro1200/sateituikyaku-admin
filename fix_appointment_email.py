# buyer-appointments.ts のメール件名・本文を指定フォーマットに更新
with open('backend/src/routes/buyer-appointments.ts', 'rb') as f:
    content = f.read().decode('utf-8')

old = """      // カレンダー登録成功後にメール通知を送信（失敗してもカレンダー登録は成功扱い）
      try {
        const recipients: string[] = [];

        // 1. 後続担当のメールアドレスを追加
        if (assignedEmployee.email) {
          recipients.push(assignedEmployee.email);
        }

        // 2. 物件担当者（sales_assignee）のメールアドレスを取得して追加
        if (propertyNumber) {
          const { data: propertyData } = await supabase
            .from('property_listings')
            .select('sales_assignee')
            .eq('property_number', propertyNumber)
            .single();

          if (propertyData?.sales_assignee) {
            const salesEmployee = await employeeUtils.getEmployeeByInitials(propertyData.sales_assignee);
            if (salesEmployee?.email && salesEmployee.email !== assignedEmployee.email) {
              recipients.push(salesEmployee.email);
            }
          }
        }

        if (recipients.length > 0) {
          const startDate = new Date(startTime);
          const endDate = new Date(endTime);
          const dateStr = startDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
          const startTimeStr = startDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
          const endTimeStr = endDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

          const subject = `【内覧予約登録】${buyerName || buyerNumber} - ${propertyAddress || '物件住所未設定'}`;
          const body = [
            '内覧予約がGoogleカレンダーに登録されました。',
            '',
            `日時: ${dateStr} ${startTimeStr}〜${endTimeStr}`,
            `お客様名: ${buyerName || buyerNumber}`,
            `電話番号: ${buyerPhone || 'なし'}`,
            `物件住所: ${propertyAddress || 'なし'}`,
            `GoogleMap: ${propertyGoogleMapUrl || 'なし'}`,
            `後続担当: ${assignedEmployee.name}`,
            `問合時ヒアリング: ${inquiryHearing || 'なし'}`,
            '',
            `買主詳細ページ:`,
            `${(process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim()}/buyers/${buyerNumber}`,
          ].join('\\n');

          await emailService.sendEmail({ to: recipients, subject, body });
          console.log('[BuyerAppointments] Notification email sent to:', recipients);
        }
      } catch (emailError: any) {
        // メール送信失敗はログのみ（カレンダー登録の成功に影響させない）
        console.error('[BuyerAppointments] Failed to send notification email (non-fatal):', emailError.message);
      }"""

new = """      // カレンダー登録成功後にメール通知を送信（失敗してもカレンダー登録は成功扱い）
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
            ownerName = sellerData.name || 'なし';
            ownerPhone = sellerData.phone_number || 'なし';
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
          const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();

          const subject = `${propertyAddress || '物件住所未設定'}の内覧入りました！内覧担当：${assignedEmployee.name}`;
          const body = [
            `内覧担当は${assignedEmployee.name}です。`,
            `${viewingMobile || ''}`,
            `物件所在地「${propertyAddress || 'なし'}」`,
            `内覧日(★下記日程が空欄の場合は、キャンセルされたという意味です）：${dateStr}(${weekday})`,
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

if old in content:
    content = content.replace(old, new)
    with open('backend/src/routes/buyer-appointments.ts', 'wb') as f:
        f.write(content.encode('utf-8'))
    print('Done!')
else:
    print('ERROR: old string not found')
