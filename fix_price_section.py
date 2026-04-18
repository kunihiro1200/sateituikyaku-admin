"""
PriceSection.tsx に priceSavedButNotSent prop を追加し、
青いバーの表示条件に組み込む
"""

with open('frontend/frontend/src/components/PriceSection.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== 修正1: interface に priceSavedButNotSent prop を追加 =====
old_interface = """  onChatSend: (data: PropertyChatSendData) => Promise<void>;
}"""

new_interface = """  onChatSend: (data: PropertyChatSendData) => Promise<void>;
  priceSavedButNotSent?: boolean;
}"""

text = text.replace(old_interface, new_interface)

# ===== 修正2: 関数の引数に priceSavedButNotSent を追加 =====
old_args = """  onChatSendSuccess,
  onChatSendError,
  onChatSend,
}: PriceSectionProps)"""

new_args = """  onChatSendSuccess,
  onChatSendError,
  onChatSend,
  priceSavedButNotSent = false,
}: PriceSectionProps)"""

text = text.replace(old_args, new_args)

# ===== 修正3: showBlueChatButton の条件に priceSavedButNotSent を追加 =====
old_blue = """  // 青いバー：売買価格が変更された場合（オレンジが表示されていない場合のみ）
  const showBlueChatButton = !isEditMode && !displayScheduledDate && isPriceChanged && !showOrangeChatButton;"""

new_blue = """  // 青いバー：売買価格が変更された場合、または保存済みだがCHATがまだ送信されていない場合
  const showBlueChatButton = !isEditMode && !displayScheduledDate && (isPriceChanged || priceSavedButNotSent) && !showOrangeChatButton;"""

text = text.replace(old_blue, new_blue)

# UTF-8 で書き込む（BOMなし）
with open('frontend/frontend/src/components/PriceSection.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('PriceSection.tsx の修正完了')

checks = [
    ('priceSavedButNotSent prop定義', 'priceSavedButNotSent?: boolean'),
    ('priceSavedButNotSent 引数', 'priceSavedButNotSent = false'),
    ('showBlueChatButton 条件更新', 'priceSavedButNotSent'),
]
for name, pattern in checks:
    found = pattern in text
    print(f'  {"✅" if found else "❌"} {name}: {found}')
