# send-chat-to-assigneeエンドポイントのselect・メッセージフォーマットを更新する

with open('backend/src/routes/propertyListings.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# selectに売主情報を追加し、メッセージフォーマットを更新
old_code = """    const { data: property, error } = await supabase
      .from('property_listings')
      .select('property_number, address, sales_assignee')
      .eq('property_number', propertyNumber)
      .single();

    if (error || !property) {
      res.status(404).json({ error: '物件が見つかりませんでした' });
      return;
    }

    if (!property.sales_assignee) {
      res.status(400).json({ error: '物件担当が設定されていません' });
      return;
    }

    // 担当者のWebhook URLを取得
    const staffService = new StaffManagementService();
    const result = await staffService.getWebhookUrl(property.sales_assignee);
    if (!result.success || !result.webhookUrl) {
      res.status(404).json({ error: result.error || '担当者のChat webhook URLが見つかりませんでした' });
      return;
    }

    // Google Chatにメッセージ送信
    const chatMessage = `📩 *物件担当への質問・伝言*\\n\\n物件番号: ${property.property_number}\\n所在地: ${property.address || '未設定'}\\n担当: ${property.sales_assignee}\\n\\n${String(message).trim()}`;"""

new_code = """    const { data: property, error } = await supabase
      .from('property_listings')
      .select('property_number, address, sales_assignee, seller_name, seller_contact, seller_email')
      .eq('property_number', propertyNumber)
      .single();

    if (error || !property) {
      res.status(404).json({ error: '物件が見つかりませんでした' });
      return;
    }

    if (!property.sales_assignee) {
      res.status(400).json({ error: '物件担当が設定されていません' });
      return;
    }

    // 担当者のWebhook URLを取得
    const staffService = new StaffManagementService();
    const result = await staffService.getWebhookUrl(property.sales_assignee);
    if (!result.success || !result.webhookUrl) {
      res.status(404).json({ error: result.error || '担当者のChat webhook URLが見つかりませんでした' });
      return;
    }

    // 物件詳細画面のURL
    const propertyUrl = `https://sateituikyaku-admin-frontend.vercel.app/property-listings/${property.property_number}`;

    // Google Chatにメッセージ送信
    const sellerInfo = [
      property.seller_name ? `売主氏名: ${property.seller_name}` : null,
      property.seller_contact ? `売主電話: ${property.seller_contact}` : null,
      property.seller_email ? `売主メール: ${property.seller_email}` : null,
    ].filter(Boolean).join('\\n');

    const chatMessage = `📩 *物件担当への質問・伝言*\\n\\n物件番号: ${property.property_number}\\n所在地: ${property.address || '未設定'}\\n担当: ${property.sales_assignee}\\n${sellerInfo ? sellerInfo + '\\n' : ''}物件URL: ${propertyUrl}\\n\\n${String(message).trim()}`;"""

if old_code in text:
    text = text.replace(old_code, new_code, 1)
    print('✅ メッセージフォーマットを更新しました')
else:
    print('❌ 対象箇所が見つかりません')
    # デバッグ用に前後を確認
    idx = text.find('send-chat-to-assignee')
    if idx >= 0:
        print(f'エンドポイント発見位置: {idx}')
        print(text[idx:idx+500])

with open('backend/src/routes/propertyListings.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 完了')
