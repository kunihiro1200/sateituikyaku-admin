#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
メール配信時に買主氏名を正しく表示する修正
- バックエンド: FilteredBuyerにnameフィールドを追加
- フロントエンド: onConfirmでname情報も渡す、1人選択時は名前を使用
"""

import re

# ============================================================
# 1. EnhancedBuyerDistributionService.ts - nameフィールド追加
# ============================================================
path1 = 'backend/src/services/EnhancedBuyerDistributionService.ts'
with open(path1, 'rb') as f:
    text1 = f.read().decode('utf-8')

# FilteredBuyer型にnameを追加
old1a = """export interface FilteredBuyer {
  buyer_number: string;
  email: string;"""
new1a = """export interface FilteredBuyer {
  buyer_number: string;
  name: string | null;
  email: string;"""

if old1a in text1:
    text1 = text1.replace(old1a, new1a)
    print('✅ FilteredBuyer型にname追加')
else:
    print('❌ FilteredBuyer型が見つかりません')

# ConsolidatedBuyerにnameを追加
old1b = """interface ConsolidatedBuyer {
  email: string;
  buyerNumbers: string[];
  buyerIds: string[]; // buyer_id (UUID) for buyer_inquiries join
  allDesiredAreas: string;"""
new1b = """interface ConsolidatedBuyer {
  email: string;
  name: string | null;
  buyerNumbers: string[];
  buyerIds: string[]; // buyer_id (UUID) for buyer_inquiries join
  allDesiredAreas: string;"""

if old1b in text1:
    text1 = text1.replace(old1b, new1b)
    print('✅ ConsolidatedBuyerにname追加')
else:
    print('❌ ConsolidatedBuyerが見つかりません')

# fetchAllBuyersのselectにnameを追加
old1c = """        .select(`
          buyer_id,
          buyer_number,
          email,
          desired_area,
          distribution_type,
          latest_status,
          desired_property_type,
          price_range_apartment,
          price_range_house,
          price_range_land
        `)"""
new1c = """        .select(`
          buyer_id,
          buyer_number,
          name,
          email,
          desired_area,
          distribution_type,
          latest_status,
          desired_property_type,
          price_range_apartment,
          price_range_house,
          price_range_land
        `)"""

if old1c in text1:
    text1 = text1.replace(old1c, new1c)
    print('✅ fetchAllBuyersにname追加')
else:
    print('❌ fetchAllBuyersのselectが見つかりません')

# consolidateBuyersByEmailの初期化にnameを追加
old1d = """        emailMap.set(normalizedEmail, {
          email: buyer.email, // Use original casing
          buyerNumbers: [buyer.buyer_number],
          buyerIds: [buyer.buyer_id], // buyer_id (UUID) for buyer_inquiries join
          allDesiredAreas: buyer.desired_area || '',"""
new1d = """        emailMap.set(normalizedEmail, {
          email: buyer.email, // Use original casing
          name: buyer.name || null,
          buyerNumbers: [buyer.buyer_number],
          buyerIds: [buyer.buyer_id], // buyer_id (UUID) for buyer_inquiries join
          allDesiredAreas: buyer.desired_area || '',"""

if old1d in text1:
    text1 = text1.replace(old1d, new1d)
    print('✅ consolidateBuyersByEmailの初期化にname追加')
else:
    print('❌ consolidateBuyersByEmailの初期化が見つかりません')

# filteredBuyersのreturnにnameを追加
old1e = """          return {
            buyer_number: consolidatedBuyer.buyerNumbers.join(','),
            email: consolidatedBuyer.email,"""
new1e = """          return {
            buyer_number: consolidatedBuyer.buyerNumbers.join(','),
            name: consolidatedBuyer.name,
            email: consolidatedBuyer.email,"""

if old1e in text1:
    text1 = text1.replace(old1e, new1e)
    print('✅ filteredBuyersのreturnにname追加')
else:
    print('❌ filteredBuyersのreturnが見つかりません')

with open(path1, 'wb') as f:
    f.write(text1.encode('utf-8'))
print()

# ============================================================
# 2. gmailDistributionService.ts - 型定義にname追加
# ============================================================
path2 = 'frontend/frontend/src/services/gmailDistributionService.ts'
with open(path2, 'rb') as f:
    text2 = f.read().decode('utf-8')

old2 = """  filteredBuyers?: Array<{
    buyer_number: string;
    email: string;"""
new2 = """  filteredBuyers?: Array<{
    buyer_number: string;
    name: string | null;
    email: string;"""

if old2 in text2:
    text2 = text2.replace(old2, new2)
    print('✅ gmailDistributionService型定義にname追加')
else:
    print('❌ gmailDistributionService型定義が見つかりません')

with open(path2, 'wb') as f:
    f.write(text2.encode('utf-8'))
print()

# ============================================================
# 3. BuyerFilterSummaryModal.tsx - nameを表示・onConfirmで渡す
# ============================================================
path3 = 'frontend/frontend/src/components/BuyerFilterSummaryModal.tsx'
with open(path3, 'rb') as f:
    text3 = f.read().decode('utf-8')

# FilteredBuyer型にname追加
old3a = """interface FilteredBuyer {
  buyer_number: string;
  email: string;"""
new3a = """interface FilteredBuyer {
  buyer_number: string;
  name: string | null;
  email: string;"""

if old3a in text3:
    text3 = text3.replace(old3a, new3a)
    print('✅ BuyerFilterSummaryModal FilteredBuyer型にname追加')
else:
    print('❌ BuyerFilterSummaryModal FilteredBuyer型が見つかりません')

# onConfirmの型をemailとnameのペアに変更
old3b = """  onConfirm: (selectedEmails: string[]) => void;"""
new3b = """  onConfirm: (selectedBuyers: Array<{ email: string; name: string | null }>) => void;"""

if old3b in text3:
    text3 = text3.replace(old3b, new3b)
    print('✅ onConfirmの型変更')
else:
    print('❌ onConfirmの型が見つかりません')

# selectedEmailsのstateをselectedBuyersに変更
old3c = """  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  // 初期化: 全ての条件を満たす買主を選択
  useEffect(() => {
    if (open) {
      const qualifiedEmails = buyers
        .filter(b => 
          b.filterResults.geography &&
          b.filterResults.distribution &&
          b.filterResults.status &&
          b.filterResults.priceRange &&
          b.email
        )
        .map(b => b.email);
      setSelectedEmails(new Set(qualifiedEmails));
    }
  }, [open, buyers]);

  const handleToggle = (email: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedEmails(newSelected);
  };

  const handleSelectAll = () => {
    const qualifiedEmails = qualifiedBuyers
      .filter(b => b.email)
      .map(b => b.email);
    setSelectedEmails(new Set(qualifiedEmails));
  };

  const handleDeselectAll = () => {
    setSelectedEmails(new Set());
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedEmails));
  };"""
new3c = """  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  // email -> name のマップ
  const [emailNameMap, setEmailNameMap] = useState<Map<string, string | null>>(new Map());

  // 初期化: 全ての条件を満たす買主を選択
  useEffect(() => {
    if (open) {
      const qualifiedBuyers2 = buyers.filter(b => 
        b.filterResults.geography &&
        b.filterResults.distribution &&
        b.filterResults.status &&
        b.filterResults.priceRange &&
        b.email
      );
      setSelectedEmails(new Set(qualifiedBuyers2.map(b => b.email)));
      const nameMap = new Map<string, string | null>();
      buyers.forEach(b => { if (b.email) nameMap.set(b.email, b.name ?? null); });
      setEmailNameMap(nameMap);
    }
  }, [open, buyers]);

  const handleToggle = (email: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedEmails(newSelected);
  };

  const handleSelectAll = () => {
    const qualifiedEmails = qualifiedBuyers
      .filter(b => b.email)
      .map(b => b.email);
    setSelectedEmails(new Set(qualifiedEmails));
  };

  const handleDeselectAll = () => {
    setSelectedEmails(new Set());
  };

  const handleConfirm = () => {
    const selected = Array.from(selectedEmails).map(email => ({
      email,
      name: emailNameMap.get(email) ?? null,
    }));
    onConfirm(selected);
  };"""

if old3c in text3:
    text3 = text3.replace(old3c, new3c)
    print('✅ BuyerFilterSummaryModal state/handleConfirm変更')
else:
    print('❌ BuyerFilterSummaryModal state/handleConfirmが見つかりません')

# 送信先件数の表示を更新
old3d = """              <Typography variant="body2">
                送信先: {selectedEmails.size}件選択中
              </Typography>"""
new3d = """              <Typography variant="body2">
                送信先: {selectedEmails.size}件選択中
                {selectedEmails.size === 1 && emailNameMap.get(Array.from(selectedEmails)[0]) && (
                  <span>（{emailNameMap.get(Array.from(selectedEmails)[0])}様）</span>
                )}
              </Typography>"""

if old3d in text3:
    text3 = text3.replace(old3d, new3d)
    print('✅ 送信先件数表示に名前追加')
else:
    print('❌ 送信先件数表示が見つかりません')

# 次へボタンの件数表示
old3e = """          次へ ({selectedEmails.size}件)"""
new3e = """          次へ ({selectedEmails.size}件)"""

# 買主リストに名前を表示
old3f = """                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">
                            {buyer.buyer_number}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {buyer.email}
                          </Typography>
                        </Box>
                      }"""
new3f = """                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">
                            {buyer.buyer_number}
                          </Typography>
                          {buyer.name && (
                            <Typography variant="body2" fontWeight="medium">
                              {buyer.name}
                            </Typography>
                          )}
                          <Typography variant="body2" color="text.secondary">
                            {buyer.email}
                          </Typography>
                        </Box>
                      }"""

if old3f in text3:
    text3 = text3.replace(old3f, new3f)
    print('✅ 買主リストに名前表示追加')
else:
    print('❌ 買主リストの表示が見つかりません')

with open(path3, 'wb') as f:
    f.write(text3.encode('utf-8'))
print()

# ============================================================
# 4. GmailDistributionButton.tsx - 選択買主の名前を使用
# ============================================================
path4 = 'frontend/frontend/src/components/GmailDistributionButton.tsx'
with open(path4, 'rb') as f:
    text4 = f.read().decode('utf-8')

# selectedEmailsをselectedBuyersに変更
old4a = """  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);"""
new4a = """  const [selectedBuyers, setSelectedBuyers] = useState<Array<{ email: string; name: string | null }>>([]);"""

if old4a in text4:
    text4 = text4.replace(old4a, new4a)
    print('✅ selectedEmails -> selectedBuyers')
else:
    print('❌ selectedEmailsのstateが見つかりません')

# handleFilterSummaryConfirmの引数型変更
old4b = """  const handleFilterSummaryConfirm = (emails: string[]) => {
    if (!selectedTemplate || emails.length === 0) {
      return;
    }
    setSelectedEmails(emails);
    setFilterSummaryOpen(false);
    setConfirmationOpen(true);
  };"""
new4b = """  const handleFilterSummaryConfirm = (buyers: Array<{ email: string; name: string | null }>) => {
    if (!selectedTemplate || buyers.length === 0) {
      return;
    }
    setSelectedBuyers(buyers);
    setFilterSummaryOpen(false);
    setConfirmationOpen(true);
  };"""

if old4b in text4:
    text4 = text4.replace(old4b, new4b)
    print('✅ handleFilterSummaryConfirm変更')
else:
    print('❌ handleFilterSummaryConfirmが見つかりません')

# handleConfirmationConfirmでbuyerNameを設定
old4c = """  const handleConfirmationConfirm = async () => {
    if (!selectedTemplate || selectedEmails.length === 0) {
      return;
    }

    try {
      const subject = replacePlaceholders(selectedTemplate.subject);
      const body = replacePlaceholders(selectedTemplate.body);

      const response = await api.post('/api/emails/send-distribution', {
        recipients: selectedEmails,
        subject: subject,
        body: body,
        senderAddress: senderAddress,
        propertyNumber: propertyNumber
      });"""
new4c = """  const handleConfirmationConfirm = async () => {
    if (!selectedTemplate || selectedBuyers.length === 0) {
      return;
    }

    // 1人選択時は名前を使用、複数時は「お客様」
    const buyerName = selectedBuyers.length === 1 ? (selectedBuyers[0].name || 'お客様') : 'お客様';
    const selectedEmails = selectedBuyers.map(b => b.email);

    try {
      const subject = replacePlaceholders(selectedTemplate.subject, buyerName);
      const body = replacePlaceholders(selectedTemplate.body, buyerName);

      const response = await api.post('/api/emails/send-distribution', {
        recipients: selectedEmails,
        subject: subject,
        body: body,
        senderAddress: senderAddress,
        propertyNumber: propertyNumber
      });"""

if old4c in text4:
    text4 = text4.replace(old4c, new4c)
    print('✅ handleConfirmationConfirmにbuyerName追加')
else:
    print('❌ handleConfirmationConfirmが見つかりません')

# handleConfirmationConfirmの成功件数表示
old4d = """      if (result.failedBatches === 0) {
        setSnackbar({
          open: true,
          message: `メールを送信しました (${result.successCount}件)\n送信元: ${senderAddress}`,
          severity: 'success'
        });
      } else {
        setSnackbar({
          open: true,
          message: `メール送信が完了しました\n成功: ${result.successCount}件\n失敗: ${result.failedCount}件`,
          severity: 'warning'
        });
      }
    } catch (error: any) {
      console.error('Failed to send emails via API:', error);
      setSnackbar({
        open: true,
        message: 'API経由での送信に失敗しました。Gmail Web UIで送信します。',
        severity: 'warning'
      });
      setConfirmationOpen(false);
      setSenderAddress(DEFAULT_SENDER);
      fallbackToGmailWebUI();
    }
  };"""
new4d = """      if (result.failedBatches === 0) {
        setSnackbar({
          open: true,
          message: `メールを送信しました (${result.successCount}件)\n送信元: ${senderAddress}`,
          severity: 'success'
        });
      } else {
        setSnackbar({
          open: true,
          message: `メール送信が完了しました\n成功: ${result.successCount}件\n失敗: ${result.failedCount}件`,
          severity: 'warning'
        });
      }
    } catch (error: any) {
      console.error('Failed to send emails via API:', error);
      setSnackbar({
        open: true,
        message: 'API経由での送信に失敗しました。Gmail Web UIで送信します。',
        severity: 'warning'
      });
      setConfirmationOpen(false);
      setSenderAddress(DEFAULT_SENDER);
      fallbackToGmailWebUI(buyerName);
    }
  };"""

if old4d in text4:
    text4 = text4.replace(old4d, new4d)
    print('✅ fallbackToGmailWebUIにbuyerName渡す')
else:
    print('❌ fallbackToGmailWebUIの呼び出しが見つかりません')

# fallbackToGmailWebUIにbuyerName引数追加
old4e = """  const fallbackToGmailWebUI = () => {
    if (!selectedTemplate || selectedEmails.length === 0) {
      return;
    }

    try {
      let emailsToSend = selectedEmails;
      if (isBccLimitExceeded(selectedEmails)) {
        setSnackbar({
          open: true,
          message: `宛先が${MAX_BCC_RECIPIENTS}件を超えています。最初の${MAX_BCC_RECIPIENTS}件のみ追加されます。`,
          severity: 'warning'
        });
        emailsToSend = limitBccRecipients(selectedEmails);
      }

      const subject = replacePlaceholders(selectedTemplate.subject);
      const body = replacePlaceholders(selectedTemplate.body);"""
new4e = """  const fallbackToGmailWebUI = (buyerName?: string) => {
    if (!selectedTemplate || selectedBuyers.length === 0) {
      return;
    }

    const resolvedBuyerName = buyerName || (selectedBuyers.length === 1 ? (selectedBuyers[0].name || 'お客様') : 'お客様');
    const emailsForFallback = selectedBuyers.map(b => b.email);

    try {
      let emailsToSend = emailsForFallback;
      if (isBccLimitExceeded(emailsForFallback)) {
        setSnackbar({
          open: true,
          message: `宛先が${MAX_BCC_RECIPIENTS}件を超えています。最初の${MAX_BCC_RECIPIENTS}件のみ追加されます。`,
          severity: 'warning'
        });
        emailsToSend = limitBccRecipients(emailsForFallback);
      }

      const subject = replacePlaceholders(selectedTemplate.subject, resolvedBuyerName);
      const body = replacePlaceholders(selectedTemplate.body, resolvedBuyerName);"""

if old4e in text4:
    text4 = text4.replace(old4e, new4e)
    print('✅ fallbackToGmailWebUIにbuyerName引数追加')
else:
    print('❌ fallbackToGmailWebUIが見つかりません')

# fallbackToGmailWebUI内のsnackbarメッセージ
old4f = """      setSnackbar({
        open: true,
        message: `Gmailを開きました (${emailsToSend.length}件の宛先)\n送信元: ${senderAddress}\n\n内容を確認して、Gmailで送信ボタンを押してください。`,
        severity: 'success'
      });"""
new4f = """      setSnackbar({
        open: true,
        message: `Gmailを開きました (${emailsToSend.length}件の宛先)\n送信元: ${senderAddress}\n\n内容を確認して、Gmailで送信ボタンを押してください。`,
        severity: 'success'
      });"""
# 変更なし（そのまま）

# BuyerFilterSummaryModalのonConfirm型を更新
old4g = """      <BuyerFilterSummaryModal
        open={filterSummaryOpen}
        onClose={() => {
          setFilterSummaryOpen(false);
          setSenderAddress(DEFAULT_SENDER);
        }}
        onConfirm={handleFilterSummaryConfirm}
        buyers={buyerData?.filteredBuyers || []}
        totalBuyers={buyerData?.totalBuyers || 0}
        senderAddress={senderAddress}
        onSenderAddressChange={handleSenderAddressChange}
        employees={employees}
      />"""
new4g = """      <BuyerFilterSummaryModal
        open={filterSummaryOpen}
        onClose={() => {
          setFilterSummaryOpen(false);
          setSenderAddress(DEFAULT_SENDER);
        }}
        onConfirm={handleFilterSummaryConfirm}
        buyers={(buyerData?.filteredBuyers || []) as any}
        totalBuyers={buyerData?.totalBuyers || 0}
        senderAddress={senderAddress}
        onSenderAddressChange={handleSenderAddressChange}
        employees={employees}
      />"""

if old4g in text4:
    text4 = text4.replace(old4g, new4g)
    print('✅ BuyerFilterSummaryModalのbuyers型キャスト追加')
else:
    print('❌ BuyerFilterSummaryModalのpropsが見つかりません')

# DistributionConfirmationModalのrecipientCountとbodyPreviewを更新
old4h = """      <DistributionConfirmationModal
        open={confirmationOpen}
        onClose={() => {
          setConfirmationOpen(false);
          setSenderAddress(DEFAULT_SENDER);
        }}
        onConfirm={handleConfirmationConfirm}
        recipientCount={selectedEmails.length}
        senderAddress={senderAddress}
        onSenderAddressChange={handleSenderAddressChange}
        employees={employees}
        subject={selectedTemplate ? replacePlaceholders(selectedTemplate.subject) : ''}
        bodyPreview={selectedTemplate ? replacePlaceholders(selectedTemplate.body) : ''}
      />"""
new4h = """      <DistributionConfirmationModal
        open={confirmationOpen}
        onClose={() => {
          setConfirmationOpen(false);
          setSenderAddress(DEFAULT_SENDER);
        }}
        onConfirm={handleConfirmationConfirm}
        recipientCount={selectedBuyers.length}
        senderAddress={senderAddress}
        onSenderAddressChange={handleSenderAddressChange}
        employees={employees}
        subject={selectedTemplate ? replacePlaceholders(selectedTemplate.subject, selectedBuyers.length === 1 ? (selectedBuyers[0].name || 'お客様') : 'お客様') : ''}
        bodyPreview={selectedTemplate ? replacePlaceholders(selectedTemplate.body, selectedBuyers.length === 1 ? (selectedBuyers[0].name || 'お客様') : 'お客様') : ''}
      />"""

if old4h in text4:
    text4 = text4.replace(old4h, new4h)
    print('✅ DistributionConfirmationModalのprops更新')
else:
    print('❌ DistributionConfirmationModalのpropsが見つかりません')

with open(path4, 'wb') as f:
    f.write(text4.encode('utf-8'))

print('\n全て完了')
