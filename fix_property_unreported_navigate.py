#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyListingsPage.tsx - 「未報告」カテゴリー選択時に報告ページへ直接遷移
"""

with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_handle = """  const handleRowClick = (propertyNumber: string) => {
    console.log('[handleRowClick] called with:', propertyNumber);
    const currentState = {
      page,
      rowsPerPage,
      searchQuery,
      sidebarStatus,
      lastFilter,
    };
    sessionStorage.setItem('propertyListState', JSON.stringify(currentState));
    console.log('[handleRowClick] navigating to:', `/property-listings/${propertyNumber}`);
    navigate(`/property-listings/${propertyNumber}`);
  };"""

new_handle = """  const handleRowClick = (propertyNumber: string) => {
    console.log('[handleRowClick] called with:', propertyNumber);

    // 「未報告」カテゴリー選択中は報告ページへ直接遷移
    if (sidebarStatus && sidebarStatus.startsWith('未報告')) {
      navigate(`/property-listings/${propertyNumber}/report`);
      return;
    }

    const currentState = {
      page,
      rowsPerPage,
      searchQuery,
      sidebarStatus,
      lastFilter,
    };
    sessionStorage.setItem('propertyListState', JSON.stringify(currentState));
    console.log('[handleRowClick] navigating to:', `/property-listings/${propertyNumber}`);
    navigate(`/property-listings/${propertyNumber}`);
  };"""

if old_handle in text:
    text = text.replace(old_handle, new_handle)
    print("✅ 未報告クリック時に報告ページへ遷移するよう修正しました")
else:
    print("❌ handleRowClickが見つかりませんでした")

with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n完了")
