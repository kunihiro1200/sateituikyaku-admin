with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# Interfaceにproperty_sales_assigneeを追加
old_interface = """  // 物件情報
  property_address?: string;
  property_type?: string;
  atbb_status?: string;
}"""

new_interface = """  // 物件情報
  property_address?: string;
  property_type?: string;
  atbb_status?: string;
  property_sales_assignee?: string;
}"""

content = content.replace(old_interface, new_interface)

# テーブルヘッダーを変更: 電話番号・ステータス列を削除、物件担当者を追加
old_header = """                  <TableCell>買主番号</TableCell>
                  <TableCell>氏名</TableCell>
                  <TableCell>物件住所</TableCell>
                  <TableCell>種別</TableCell>
                  <TableCell>atbb_status</TableCell>
                  <TableCell>担当</TableCell>
                  <TableCell>確度</TableCell>
                  <TableCell>受付日</TableCell>
                  <TableCell>次電日</TableCell>
                  <TableCell>ステータス</TableCell>"""

new_header = """                  <TableCell>買主番号</TableCell>
                  <TableCell>氏名</TableCell>
                  <TableCell>物件所在地</TableCell>
                  <TableCell>物件担当</TableCell>
                  <TableCell>種別</TableCell>
                  <TableCell>atbb_status</TableCell>
                  <TableCell>担当</TableCell>
                  <TableCell>確度</TableCell>
                  <TableCell>受付日</TableCell>
                  <TableCell>次電日</TableCell>"""

content = content.replace(old_header, new_header)

# テーブル行を変更: 電話番号・ステータス列を削除、物件担当者を追加
old_row = """                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: SECTION_COLORS.buyer.main }}>
                            {buyer.buyer_number || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>{buyer.name || '-'}</TableCell>
                        <TableCell>{buyer.property_address || '-'}</TableCell>
                        <TableCell>{buyer.property_type || '-'}</TableCell>
                        <TableCell>{formatAtbbStatus(buyer.atbb_status)}</TableCell>
                        <TableCell>{buyer.follow_up_assignee || buyer.initial_assignee || '-'}</TableCell>
                        <TableCell>
                          {displayConfidence && (
                            <Chip 
                              label={displayConfidence.label} 
                              size="small" 
                              color={displayConfidence.color}
                            />
                          )}
                        </TableCell>
                        <TableCell>{formatDate(buyer.reception_date)}</TableCell>
                        <TableCell>{formatDate(buyer.next_call_date)}</TableCell>
                        <TableCell>
                          {buyer.latest_status && (
                            <Chip 
                              label={buyer.latest_status.substring(0, 20)} 
                              size="small" 
                              sx={{ maxWidth: 150 }}
                            />
                          )}
                          {buyer.calculated_status && (
                            <Chip
                              label={buyer.calculated_status.substring(0, 20)}
                              size="small"
                              sx={{ maxWidth: 150, mt: 0.5, bgcolor: buyer.status_color || '#cccccc', color: '#fff' }}
                            />
                          )}
                        </TableCell>"""

new_row = """                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: SECTION_COLORS.buyer.main }}>
                            {buyer.buyer_number || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>{buyer.name || '-'}</TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {buyer.property_address || '-'}
                        </TableCell>
                        <TableCell>{buyer.property_sales_assignee || '-'}</TableCell>
                        <TableCell>{buyer.property_type || '-'}</TableCell>
                        <TableCell>{formatAtbbStatus(buyer.atbb_status)}</TableCell>
                        <TableCell>{buyer.follow_up_assignee || buyer.initial_assignee || '-'}</TableCell>
                        <TableCell>
                          {displayConfidence && (
                            <Chip 
                              label={displayConfidence.label} 
                              size="small" 
                              color={displayConfidence.color}
                            />
                          )}
                        </TableCell>
                        <TableCell>{formatDate(buyer.reception_date)}</TableCell>
                        <TableCell>{formatDate(buyer.next_call_date)}</TableCell>"""

content = content.replace(old_row, new_row)

# colSpanも10→10のまま（列数は変わらない: 削除2列、追加1列 → 10-2+1=9列）
# ヘッダーは9列になったのでcolSpanを修正
content = content.replace('colSpan={10}', 'colSpan={9}')

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('BuyersPage.tsx updated')
