#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PageNavigation.tsx に onNavigate コールバック props を追加する
BuyerDetailPage.tsx で PageNavigation に onNavigate={handleNavigate} を渡す
"""

# --- PageNavigation.tsx の更新 ---
with open('frontend/frontend/src/components/PageNavigation.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_component = """export default function PageNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = ["""

new_component = """interface PageNavigationProps {
  onNavigate?: (url: string) => void;
}

export default function PageNavigation({ onNavigate }: PageNavigationProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
  };

  const navItems = ["""

text = text.replace(old_component, new_component, 1)

# ナビゲーションボタンの onClick を handleNav に切り替え
old_onclick = "            onClick={() => navigate(item.path)}"
new_onclick = "            onClick={() => handleNav(item.path)}"
text = text.replace(old_onclick, new_onclick, 1)

with open('frontend/frontend/src/components/PageNavigation.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('PageNavigation.tsx updated.')

# --- BuyerDetailPage.tsx の更新: PageNavigation に onNavigate を渡す ---
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_page_nav = "        <PageNavigation />"
new_page_nav = "        <PageNavigation onNavigate={handleNavigate} />"
text = text.replace(old_page_nav, new_page_nav, 1)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('BuyerDetailPage.tsx updated with onNavigate prop.')
