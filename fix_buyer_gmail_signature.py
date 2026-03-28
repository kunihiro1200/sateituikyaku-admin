"""
買主Gmail署名の担当者情報バグ修正スクリプト
- EmailTemplateService.ts: mergeAngleBracketPlaceholders に staffInfo パラメータと担当者情報置換を追加
- emailTemplates.ts (routes): mergeMultiple エンドポイントでスタッフ情報取得を追加
- BuyerGmailSendButton.tsx: followUpAssignee props 追加
- BuyerDetailPage.tsx: followUpAssignee を渡す
"""
import re

# ===== File 1: EmailTemplateService.ts =====
with open('backend/src/services/EmailTemplateService.ts', 'rb') as f:
    content = f.read().decode('utf-8')

# mergeAngleBracketPlaceholders のシグネチャを変更（staffInfo パラメータ追加）
old_sig = '''  mergeAngleBracketPlaceholders(
    text: string,
    buyer: { name?: string; company_name?: string; buyer_number?: string; email?: string; pre_viewing_notes?: string; [key: string]: any },
    properties: Array<{
      propertyNumber: string;
      address: string;
      price?: number;
      googleMapUrl?: string;
      athomeUrl?: string;
      detailUrl?: string;
      [key: string]: any;
    }>
  ): string {'''

new_sig = '''  mergeAngleBracketPlaceholders(
    text: string,
    buyer: { name?: string; company_name?: string; buyer_number?: string; email?: string; pre_viewing_notes?: string; [key: string]: any },
    properties: Array<{
      propertyNumber: string;
      address: string;
      price?: number;
      googleMapUrl?: string;
      athomeUrl?: string;
      detailUrl?: string;
      [key: string]: any;
    }>,
    staffInfo?: { name?: string; phone?: string | null; email?: string | null; regularHoliday?: string | null } | null
  ): string {'''

content = content.replace(old_sig, new_sig)

# 物件なしコードパスの <<[^>]*>> 置換の直前に担当者情報置換を追加
old_no_prop = '''      result = result.replace(/<<内覧アンケート>>/g, '');
      result = result.replace(/<<[^>]*>>/g, '');
      return result;
    }'''

new_no_prop = '''      result = result.replace(/<<内覧アンケート>>/g, '');
      // <<担当名（営業）>> 系プレースホルダーの置換（staffInfo が渡された場合）
      result = result.replace(/<<担当名（営業）名前>>/g, staffInfo?.name || '');
      result = result.replace(/<<担当名（営業）電話番号>>/g, staffInfo?.phone || '');
      result = result.replace(/<<担当名（営業）メールアドレス>>/g, staffInfo?.email || '');
      result = result.replace(/<<担当名（営業）固定休>>/g, staffInfo?.regularHoliday || '');
      result = result.replace(/<<[^>]*>>/g, '');
      return result;
    }'''

content = content.replace(old_no_prop, new_no_prop)

# 物件ありコードパスの <<住居表示Pinrich>> 置換の後、<<[^>]*>> 置換の直前に担当者情報置換を追加
old_with_prop = '''    // <<住居表示Pinrich>> の置換（空欄の場合は非表示）
    const pinrichUrl = buyer.pinrich_url || buyer.pinrichUrl || '';
    result = result.replace(/<<住居表示Pinrich>>/g, pinrichUrl || '');

    // 残った未置換の <<...>> を空文字に（安全策）
    result = result.replace(/<<[^>]*>>/g, '');

    return result;
  }'''

new_with_prop = '''    // <<住居表示Pinrich>> の置換（空欄の場合は非表示）
    const pinrichUrl = buyer.pinrich_url || buyer.pinrichUrl || '';
    result = result.replace(/<<住居表示Pinrich>>/g, pinrichUrl || '');

    // <<担当名（営業）>> 系プレースホルダーの置換（staffInfo が渡された場合）
    result = result.replace(/<<担当名（営業）名前>>/g, staffInfo?.name || '');
    result = result.replace(/<<担当名（営業）電話番号>>/g, staffInfo?.phone || '');
    result = result.replace(/<<担当名（営業）メールアドレス>>/g, staffInfo?.email || '');
    result = result.replace(/<<担当名（営業）固定休>>/g, staffInfo?.regularHoliday || '');

    // 残った未置換の <<...>> を空文字に（安全策）
    result = result.replace(/<<[^>]*>>/g, '');

    return result;
  }'''

content = content.replace(old_with_prop, new_with_prop)

with open('backend/src/services/EmailTemplateService.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ EmailTemplateService.ts 修正完了')

# ===== File 2: emailTemplates.ts (routes) =====
with open('backend/src/routes/emailTemplates.ts', 'rb') as f:
    content = f.read().decode('utf-8')

# mergeMultiple エンドポイントで物件なしの場合の mergeAngleBracketPlaceholders 呼び出しを修正
old_no_prop_route = '''      let mergedContent = templateService.mergeMultipleProperties(template, buyer, []);
      mergedContent.subject = templateService.mergeAngleBracketPlaceholders(
        mergedContent.subject, buyer, []
      );
      mergedContent.body = templateService.mergeAngleBracketPlaceholders(
        mergedContent.body, buyer, []
      );
      return res.json(mergedContent);'''

new_no_prop_route = '''      // follow_up_assignee でスタッフ情報を取得
      let staffInfoForMerge = null;
      const followUpAssignee = buyer.follow_up_assignee;
      if (followUpAssignee) {
        staffInfoForMerge = await staffService.getStaffByInitials(followUpAssignee);
        if (!staffInfoForMerge) {
          staffInfoForMerge = await staffService.getStaffByNameContains(followUpAssignee);
        }
      }
      let mergedContent = templateService.mergeMultipleProperties(template, buyer, []);
      mergedContent.subject = templateService.mergeAngleBracketPlaceholders(
        mergedContent.subject, buyer, [], staffInfoForMerge
      );
      mergedContent.body = templateService.mergeAngleBracketPlaceholders(
        mergedContent.body, buyer, [], staffInfoForMerge
      );
      return res.json(mergedContent);'''

content = content.replace(old_no_prop_route, new_no_prop_route)

# 物件ありの場合の mergeAngleBracketPlaceholders 呼び出しを修正
old_with_prop_route = '''    // {{}} 形式を置換してから <<>> 形式を置換
    let mergedContent = templateService.mergeMultipleProperties(template, buyer, legacyProperties);
    mergedContent.subject = templateService.mergeAngleBracketPlaceholders(
      mergedContent.subject, buyer, propertyDataForPlaceholders
    );
    mergedContent.body = templateService.mergeAngleBracketPlaceholders(
      mergedContent.body, buyer, propertyDataForPlaceholders
    );

    res.json(mergedContent);'''

new_with_prop_route = '''    // follow_up_assignee でスタッフ情報を取得
    let staffInfoForMerge = null;
    const followUpAssignee = buyer.follow_up_assignee;
    if (followUpAssignee) {
      staffInfoForMerge = await staffService.getStaffByInitials(followUpAssignee);
      if (!staffInfoForMerge) {
        staffInfoForMerge = await staffService.getStaffByNameContains(followUpAssignee);
      }
    }

    // {{}} 形式を置換してから <<>> 形式を置換
    let mergedContent = templateService.mergeMultipleProperties(template, buyer, legacyProperties);
    mergedContent.subject = templateService.mergeAngleBracketPlaceholders(
      mergedContent.subject, buyer, propertyDataForPlaceholders, staffInfoForMerge
    );
    mergedContent.body = templateService.mergeAngleBracketPlaceholders(
      mergedContent.body, buyer, propertyDataForPlaceholders, staffInfoForMerge
    );

    res.json(mergedContent);'''

content = content.replace(old_with_prop_route, new_with_prop_route)

with open('backend/src/routes/emailTemplates.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ emailTemplates.ts (routes) 修正完了')

# ===== File 3: BuyerGmailSendButton.tsx =====
with open('frontend/frontend/src/components/BuyerGmailSendButton.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# props interface に followUpAssignee を追加
old_props = '''interface BuyerGmailSendButtonProps {
  buyerId: string;
  buyerEmail: string;
  buyerName: string;
  buyerCompanyName?: string;
  buyerNumber?: string;
  preViewingNotes?: string;
  inquiryHistory: InquiryHistoryItem[];
  selectedPropertyIds: Set<string>; // チェックボックスで選択された物件ID
  size?: 'small' | 'medium' | 'large';
  variant?: 'text' | 'outlined' | 'contained';
  onEmailSent?: () => void; // メール送信成功後のコールバック
}'''

new_props = '''interface BuyerGmailSendButtonProps {
  buyerId: string;
  buyerEmail: string;
  buyerName: string;
  buyerCompanyName?: string;
  buyerNumber?: string;
  preViewingNotes?: string;
  followUpAssignee?: string; // 後続担当（署名の担当者情報取得に使用）
  inquiryHistory: InquiryHistoryItem[];
  selectedPropertyIds: Set<string>; // チェックボックスで選択された物件ID
  size?: 'small' | 'medium' | 'large';
  variant?: 'text' | 'outlined' | 'contained';
  onEmailSent?: () => void; // メール送信成功後のコールバック
}'''

content = content.replace(old_props, new_props)

# 関数の引数に followUpAssignee を追加
old_args = '''  buyerId,
  buyerEmail,
  buyerName,
  buyerCompanyName,
  buyerNumber,
  preViewingNotes,
  inquiryHistory,
  selectedPropertyIds,
  size = 'medium',
  variant = 'contained',
  onEmailSent,
}: BuyerGmailSendButtonProps)'''

new_args = '''  buyerId,
  buyerEmail,
  buyerName,
  buyerCompanyName,
  buyerNumber,
  preViewingNotes,
  followUpAssignee,
  inquiryHistory,
  selectedPropertyIds,
  size = 'medium',
  variant = 'contained',
  onEmailSent,
}: BuyerGmailSendButtonProps)'''

content = content.replace(old_args, new_args)

# mergeMultiple リクエストの buyer オブジェクトに follow_up_assignee を追加
old_buyer_req = '''      // 複数物件のデータを取得してマージ
      const response = await api.post(`/api/email-templates/${template.id}/mergeMultiple`, {
        buyer: {
          buyerName,
          name: buyerName,
          company_name: buyerCompanyName || '',
          buyer_number: buyerNumber || '',
          email: buyerEmail,
          pre_viewing_notes: preViewingNotes || '',
        },'''

new_buyer_req = '''      // 複数物件のデータを取得してマージ
      const response = await api.post(`/api/email-templates/${template.id}/mergeMultiple`, {
        buyer: {
          buyerName,
          name: buyerName,
          company_name: buyerCompanyName || '',
          buyer_number: buyerNumber || '',
          email: buyerEmail,
          pre_viewing_notes: preViewingNotes || '',
          follow_up_assignee: followUpAssignee || '',
        },'''

content = content.replace(old_buyer_req, new_buyer_req)

with open('frontend/frontend/src/components/BuyerGmailSendButton.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ BuyerGmailSendButton.tsx 修正完了')

# ===== File 4: BuyerDetailPage.tsx =====
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# BuyerGmailSendButton に followUpAssignee を渡す
old_gmail_btn = '''          <BuyerGmailSendButton
            buyerId={buyer_number || ''}
            buyerEmail={buyer.email || ''}
            buyerName={buyer.name || ''}
            buyerCompanyName={buyer.company_name || ''}
            buyerNumber={buyer_number || ''}
            preViewingNotes={buyer.pre_viewing_notes || ''}
            inquiryHistory={inquiryHistoryTable}
            selectedPropertyIds={selectedPropertyIds}
            size="small"
            variant="contained"
            onEmailSent={fetchActivities}
          />'''

new_gmail_btn = '''          <BuyerGmailSendButton
            buyerId={buyer_number || ''}
            buyerEmail={buyer.email || ''}
            buyerName={buyer.name || ''}
            buyerCompanyName={buyer.company_name || ''}
            buyerNumber={buyer_number || ''}
            preViewingNotes={buyer.pre_viewing_notes || ''}
            followUpAssignee={buyer.follow_up_assignee || ''}
            inquiryHistory={inquiryHistoryTable}
            selectedPropertyIds={selectedPropertyIds}
            size="small"
            variant="contained"
            onEmailSent={fetchActivities}
          />'''

content = content.replace(old_gmail_btn, new_gmail_btn)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ BuyerDetailPage.tsx 修正完了')
print('\n全ての修正が完了しました。')
