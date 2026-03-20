# コメントフィールドの追加修正スクリプト
import sys

# ===== 1. SellerService.supabase.ts の修正 =====
with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 既にcommentsが追加済みか確認
if "// コメントフィールド" in text:
    print('ℹ️  SellerService.supabase.ts: 既にcommentsフィールドが追加されています')
else:
    # mailSentDate の処理の後に comments を追加
    # 改行コードの違いに対応するため、柔軟な検索を使用
    target = "if ((data as any).mailSentDate !== undefined) {"
    if target in text:
        # mailSentDateブロックの終わりを見つけて、その後にcommentsを追加
        idx = text.find(target)
        # ブロックの終わり（}）を見つける
        end_idx = text.find("    }", idx) + 5  # "    }" の後
        
        insert_text = "\n\n    // コメントフィールド\n    if ((data as any).comments !== undefined) {\n      updates.comments = (data as any).comments;\n    }"
        text = text[:end_idx] + insert_text + text[end_idx:]
        
        with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
            f.write(text.encode('utf-8'))
        print('✅ SellerService.supabase.ts: commentsフィールドを追加しました')
    else:
        print('❌ SellerService.supabase.ts: mailSentDateの処理が見つかりませんでした')
        # デバッグ: 周辺テキストを表示
        idx2 = text.find("mailing_status")
        if idx2 >= 0:
            print(f'  mailing_status周辺: {repr(text[idx2-50:idx2+200])}')
        sys.exit(1)

# ===== 2. types/index.ts の修正 =====
with open('backend/src/types/index.ts', 'rb') as f:
    content2 = f.read()

text2 = content2.decode('utf-8')

if "comments?: string; // コメント" in text2:
    print('ℹ️  types/index.ts: 既にcommentsフィールドが追加されています')
else:
    target2 = "contactMethod?: string; // 連絡方法"
    if target2 in text2:
        text2 = text2.replace(
            target2,
            target2 + "\n  comments?: string; // コメント"
        )
        with open('backend/src/types/index.ts', 'wb') as f:
            f.write(text2.encode('utf-8'))
        print('✅ types/index.ts: commentsフィールドを追加しました')
    else:
        print('❌ types/index.ts: contactMethodの定義が見つかりませんでした')
        sys.exit(1)

print('✅ 全ての修正が完了しました')
