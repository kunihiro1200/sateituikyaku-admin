# -*- coding: utf-8 -*-
import re

# ファイルを読み取る
with open('backend/src/routes/propertyListings.ts', 'rb') as f:
    content = f.read()

# UTF-8でデコード
text = content.decode('utf-8')

# 担当へCHAT送信APIのres.json({ success: true });の直前に履歴保存ロジックを追加
# パターン1: 担当へCHAT送信（最初のres.json）
pattern1 = r"(// 担当へCHAT送信.*?)(    res\.json\(\{ success: true \}\);)"
replacement1 = r"\1    // CHAT送信履歴を保存\n    try {\n      await supabase\n        .from('property_chat_history')\n        .insert({\n          property_number: propertyNumber,\n          recipient_type: 'assignee',\n          recipient_name: property.sales_assignee || '',\n          message: String(message).trim(),\n          sender_label: senderLabel || null,\n          sent_at: new Date().toISOString(),\n        });\n      console.log(`[send-chat-to-assignee] Chat history saved for ${propertyNumber}`);\n    } catch (historyError: any) {\n      console.error(`[send-chat-to-assignee] Failed to save chat history:`, historyError);\n      // 履歴保存エラーでもレスポンスは成功を返す\n    }\n\n\2"

text = re.sub(pattern1, replacement1, text, count=1, flags=re.DOTALL)

# 事務へCHAT送信APIのres.json({ success: true });の直前に履歴保存ロジックを追加
# パターン2: 事務へCHAT送信（2番目のres.json）
# send-chat-to-officeの最後のres.json({ success: true });を探す
pattern2 = r"(\[send-chat-to-office\] Failed to sync confirmation to spreadsheet.*?\n.*?// チャット送信は成功しているため.*?\n.*?}\n)(    res\.json\(\{ success: true \}\);)"
replacement2 = r"\1    // CHAT送信履歴を保存\n    try {\n      await supabase\n        .from('property_chat_history')\n        .insert({\n          property_number: propertyNumber,\n          recipient_type: 'office',\n          recipient_name: '事務',\n          message: String(message).trim(),\n          sender_label: senderLabel || null,\n          sent_at: new Date().toISOString(),\n        });\n      console.log(`[send-chat-to-office] Chat history saved for ${propertyNumber}`);\n    } catch (historyError: any) {\n      console.error(`[send-chat-to-office] Failed to save chat history:`, historyError);\n      // 履歴保存エラーでもレスポンスは成功を返す\n    }\n\n\2"

text = re.sub(pattern2, replacement2, text, count=1, flags=re.DOTALL)

# UTF-8で書き込む
with open('backend/src/routes/propertyListings.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
