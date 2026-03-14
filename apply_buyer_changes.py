import re

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 変更1: ContentCopyIcon インポート追加（既にあれば何もしない）
if 'ContentCopy as ContentCopyIcon' not in text:
    text = text.replace(
        "  ArrowBack as ArrowBackIcon,\n  Email as EmailIcon,\n}",
        "  ArrowBack as ArrowBackIcon,\n  Email as EmailIcon,\n  ContentCopy as ContentCopyIcon,\n}"
    )
    print("Applied: ContentCopyIcon import")
else:
    print("Skip: ContentCopyIcon already present")

# 変更2: copiedBuyerNumber state 追加（既にあれば何もしない）
if 'copiedBuyerNumber' not in text:
    text = text.replace(
        "  const [loading, setLoading] = useState(true);",
        "  const [loading, setLoading] = useState(true);\n  const [copiedBuyerNumber, setCopiedBuyerNumber] = useState(false);"
    )
    print("Applied: copiedBuyerNumber state")
else:
    print("Skip: copiedBuyerNumber already present")

# 変更3: BuyerGmailSendButton の buyerId を buyer_number に
text = text.replace(
    "buyerId={buyer.id || buyer_number || ''}",
    "buyerId={buyer_number || ''}"
)
print("Applied: BuyerGmailSendButton buyerId fix")

# 変更4: InlineEditableField の buyerId を buyer_number に（全箇所）
text = text.replace(
    "buyerId={buyer?.id || buyer_number}",
    "buyerId={buyer_number}"
)
print("Applied: InlineEditableField buyerId fix")

# 変更5: RelatedBuyersSection
text = text.replace(
    "      {buyer?.id && (\n        <Box sx={{ mt: 3 }}>\n          <RelatedBuyersSection buyerId={buyer.id} />",
    "      {buyer_number && (\n        <Box sx={{ mt: 3 }}>\n          <RelatedBuyersSection buyerNumber={buyer_number} />"
)
print("Applied: RelatedBuyersSection buyerNumber fix")

# 変更6: UnifiedInquiryHistoryTable
text = text.replace(
    "      {buyer?.id && (\n        <Box sx={{ mt: 3 }}>\n          <UnifiedInquiryHistoryTable buyerId={buyer.id} />",
    "      {buyer_number && (\n        <Box sx={{ mt: 3 }}>\n          <UnifiedInquiryHistoryTable buyerNumber={buyer_number} />"
)
print("Applied: UnifiedInquiryHistoryTable buyerNumber fix")

# 変更7: InquiryResponseEmailModal の buyerId
text = text.replace(
    "          buyerId: buyer.id || buyer_number || '',",
    "          buyerId: buyer_number || '',"
)
print("Applied: InquiryResponseEmailModal buyerId fix")

# 変更8: ヘッダーに買主番号コピーChip + 3ボタン追加
# RelatedBuyerNotificationBadge の後にコピーChipを追加
if 'copiedBuyerNumber ? ' not in text:
    text = text.replace(
        "          <RelatedBuyerNotificationBadge \n            count={relatedBuyersCount} \n            onClick={scrollToRelatedBuyers}\n          />",
        """          <RelatedBuyerNotificationBadge 
            count={relatedBuyersCount} 
            onClick={scrollToRelatedBuyers}
          />
          {/* 買主番号コピーChip */}
          <Tooltip title={copiedBuyerNumber ? 'コピーしました！' : '買主番号をコピー'} arrow>
            <Chip
              icon={<ContentCopyIcon fontSize="small" />}
              label={buyer_number}
              size="small"
              onClick={() => {
                navigator.clipboard.writeText(buyer_number || '');
                setCopiedBuyerNumber(true);
                setTimeout(() => setCopiedBuyerNumber(false), 2000);
              }}
              color={copiedBuyerNumber ? 'success' : 'default'}
              variant="outlined"
              sx={{ cursor: 'pointer' }}
            />
          </Tooltip>"""
    )
    print("Applied: copy chip")
else:
    print("Skip: copy chip already present")

# 変更9: ヘッダーに3ボタン追加
if 'navigate(`/buyers/${buyer_number}/inquiry-history`)' not in text:
    # 既存のヘッダーボタンエリアを探して置換
    text = text.replace(
        "      </Box>\n\n      {/* 問い合わせ履歴テーブルセクション */}",
        """        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(`/buyers/${buyer_number}/inquiry-history`)}
          >
            問い合わせ履歴 ({inquiryHistoryTable.length}件)
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(`/buyers/${buyer_number}/desired-conditions`)}
          >
            希望条件
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(`/buyers/${buyer_number}/viewing`)}
          >
            内覧
          </Button>
        </Box>
      </Box>

      {/* 問い合わせ履歴テーブルセクション */}"""
    )
    print("Applied: header buttons")
else:
    print("Skip: header buttons already present")

# 検証
remaining = text.count('buyer?.id') + text.count('buyer.id')
print(f"\nRemaining buyer.id references: {remaining}")

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("Done!")
