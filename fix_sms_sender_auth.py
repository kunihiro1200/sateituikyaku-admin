with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. useAuthStore を import に追加
old = "import { useStableContainerHeight } from '../hooks/useStableContainerHeight';"
new = "import { useStableContainerHeight } from '../hooks/useStableContainerHeight';\nimport { useAuthStore } from '../store/authStore';"
text = text.replace(old, new)

# 2. コンポーネント内でemployeeを取得（normalInitialsのstateの直前に追加）
old = "  // 通常スタッフのイニシャル一覧（初動担当選択用）\n  const [normalInitials, setNormalInitials] = useState<string[]>([]);"
new = "  // ログインユーザー情報（SMS送信者名用）\n  const { employee } = useAuthStore();\n\n  // 通常スタッフのイニシャル一覧（初動担当選択用）\n  const [normalInitials, setNormalInitials] = useState<string[]>([]);"
text = text.replace(old, new)

# 3. SmsDropdownButtonのsenderNameをemployee.nameに変更
old = "              senderName={smsSenderName}"
new = "              senderName={employee?.name || ''}"
text = text.replace(old, new)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done - auth store added!')
