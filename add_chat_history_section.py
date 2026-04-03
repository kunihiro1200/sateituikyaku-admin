with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# PropertySidebarStatusの下にChatHistorySectionを追加
old_code = """        {/* 左サイドバー - サイドバーステータス */}
        <PropertySidebarStatus
          listings={[data]}
          selectedStatus={data.sidebar_status || null}
          onStatusChange={() => {}}
          pendingPriceReductionProperties={new Set()}
        />

        {/* メインコンテンツ */}"""

new_code = """        {/* 左サイドバー - サイドバーステータス */}
        <Box>
          <PropertySidebarStatus
            listings={[data]}
            selectedStatus={data.sidebar_status || null}
            onStatusChange={() => {}}
            pendingPriceReductionProperties={new Set()}
          />
          
          {/* CHAT送信履歴セクション */}
          <ChatHistorySection
            chatHistory={chatHistory}
            loading={chatHistoryLoading}
          />
        </Box>

        {/* メインコンテンツ */}"""

text = text.replace(old_code, new_code)

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Added ChatHistorySection to sidebar!')
