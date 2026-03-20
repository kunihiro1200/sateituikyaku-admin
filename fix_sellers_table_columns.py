#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SellersPage.tsx のテーブル列を変更するスクリプト
- 削除: 不通、Pinrich、ステータス、除外日、電話番号
- 追加（次電日の後）: 物件所在地、種別、査定額、営担
"""

import re

filepath = 'frontend/frontend/src/pages/SellersPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== 1. Seller インターフェースに新フィールドを追加 =====
old_interface = '''interface Seller {
  id: string;
  sellerNumber?: string;
  name: string;
  address: string;
  phoneNumber: string;
  email?: string;
  status: string;
  confidence?: string;
  nextCallDate?: string;
  createdAt: string;
  lastCallDate?: string;
  inquirySource?: string;
  inquiryDate?: string;
  inquiryDetailedDatetime?: string;
  inquiryYear?: number;
  inquirySite?: string;
  site?: string;
  confidenceLevel?: string;
  firstCallerInitials?: string;
  isUnreachable?: boolean;
}'''

new_interface = '''interface Seller {
  id: string;
  sellerNumber?: string;
  name: string;
  address: string;
  phoneNumber: string;
  email?: string;
  status: string;
  confidence?: string;
  nextCallDate?: string;
  createdAt: string;
  lastCallDate?: string;
  inquirySource?: string;
  inquiryDate?: string;
  inquiryDetailedDatetime?: string;
  inquiryYear?: number;
  inquirySite?: string;
  site?: string;
  confidenceLevel?: string;
  firstCallerInitials?: string;
  isUnreachable?: boolean;
  propertyAddress?: string;
  propertyType?: string;
  valuationAmount1?: number;
  visitAssignee?: string;
  visitAssigneeInitials?: string;
}'''

text = text.replace(old_interface, new_interface)

# ===== 2. テーブルヘッダーを変更 =====
old_header = '''              <TableRow>
                <TableCell>売主番号</TableCell>
                <TableCell>名前</TableCell>
                <TableCell>反響日付</TableCell>
                <TableCell>サイト</TableCell>
                <TableCell>確度</TableCell>
                <TableCell>不通</TableCell>
                <TableCell>次電日</TableCell>
                <TableCell>訪問日</TableCell>
                <TableCell>状況（当社）</TableCell>
                <TableCell>Pinrich</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell>除外日</TableCell>
                <TableCell>電話番号</TableCell>
              </TableRow>'''

new_header = '''              <TableRow>
                <TableCell>売主番号</TableCell>
                <TableCell>名前</TableCell>
                <TableCell>反響日付</TableCell>
                <TableCell>サイト</TableCell>
                <TableCell>確度</TableCell>
                <TableCell>次電日</TableCell>
                <TableCell>物件所在地</TableCell>
                <TableCell>種別</TableCell>
                <TableCell>査定額</TableCell>
                <TableCell>営担</TableCell>
                <TableCell>訪問日</TableCell>
                <TableCell>状況（当社）</TableCell>
              </TableRow>'''

text = text.replace(old_header, new_header)

# ===== 3. テーブルボディの行を変更 =====
# 読み込み中のcolSpan
text = text.replace(
    '<TableCell colSpan={13} align="center">\n                    読み込み中...',
    '<TableCell colSpan={12} align="center">\n                    読み込み中...'
)

# 見つからない場合のcolSpan
text = text.replace(
    '<TableCell colSpan={13} align="center">\n                    売主が見つかりませんでした',
    '<TableCell colSpan={12} align="center">\n                    売主が見つかりませんでした'
)

# ===== 4. テーブル行のセルを変更 =====
# 確度セルの後から電話番号セルまでを置換
old_row_cells = '''                    <TableCell>
                      {seller.confidence ? (
                        <Chip
                          label={
                            seller.confidence === 'A' ? 'A' :
                            seller.confidence === 'B' ? 'B' :
                            seller.confidence === 'B_PRIME' ? "B'" :
                            seller.confidence === 'C' ? 'C' :
                            seller.confidence === 'D' ? 'D' :
                            seller.confidence === 'E' ? 'E' :
                            seller.confidence === 'DUPLICATE' ? 'ダブり' :
                            seller.confidence
                          }
                          color={
                            seller.confidence === 'A' ? 'success' :
                            seller.confidence === 'B' ? 'info' :
                            seller.confidence === 'C' ? 'warning' :
                            'default'
                          }
                          size="small"
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {seller.unreachable ? (
                        <Chip label="不通" size="small" color="error" />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {seller.nextCallDate
                        ? new Date(seller.nextCallDate).toLocaleDateString('ja-JP')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {seller.visitDate
                        ? new Date(seller.visitDate).toLocaleDateString('ja-JP')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={statusLabels[seller.status] || seller.status}
                        color={getStatusColor(seller.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{seller.pinrichStatus || '-'}</TableCell>
                    <TableCell>
                      <SellerStatusCell seller={seller} />
                    </TableCell>
                    <TableCell>
                      {seller.exclusionDate
                        ? new Date(seller.exclusionDate).toLocaleDateString('ja-JP')
                        : '-'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {seller.phoneNumber ? (
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PhoneIcon fontSize="small" color="action" />
                            <a
                              href={`tel:${seller.phoneNumber}`}
                              style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                              {seller.phoneNumber}
                            </a>
                          </Box>
                          {seller.lastCallDate && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 2.5 }}>
                              最終: {new Date(seller.lastCallDate).toLocaleString('ja-JP', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        '-'
                      )}
                    </TableCell>'''

new_row_cells = '''                    <TableCell>
                      {seller.confidence ? (
                        <Chip
                          label={
                            seller.confidence === 'A' ? 'A' :
                            seller.confidence === 'B' ? 'B' :
                            seller.confidence === 'B_PRIME' ? "B'" :
                            seller.confidence === 'C' ? 'C' :
                            seller.confidence === 'D' ? 'D' :
                            seller.confidence === 'E' ? 'E' :
                            seller.confidence === 'DUPLICATE' ? 'ダブり' :
                            seller.confidence
                          }
                          color={
                            seller.confidence === 'A' ? 'success' :
                            seller.confidence === 'B' ? 'info' :
                            seller.confidence === 'C' ? 'warning' :
                            'default'
                          }
                          size="small"
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {seller.nextCallDate
                        ? new Date(seller.nextCallDate).toLocaleDateString('ja-JP')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {seller.propertyAddress || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>{seller.propertyType || '-'}</TableCell>
                    <TableCell>
                      {seller.valuationAmount1
                        ? `${Math.round(seller.valuationAmount1 / 10000).toLocaleString()}万円`
                        : '-'}
                    </TableCell>
                    <TableCell>{seller.visitAssigneeInitials || seller.visitAssignee || '-'}</TableCell>
                    <TableCell>
                      {seller.visitDate
                        ? new Date(seller.visitDate).toLocaleDateString('ja-JP')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={statusLabels[seller.status] || seller.status}
                        color={getStatusColor(seller.status)}
                        size="small"
                      />
                    </TableCell>'''

text = text.replace(old_row_cells, new_row_cells)

# ===== 5. 不要なimportを削除（PhoneIconが不要になった場合） =====
# PhoneIconはもう使わないので削除
text = text.replace(
    '  Phone as PhoneIcon,\n  FilterList as FilterListIcon,',
    '  FilterList as FilterListIcon,'
)

# ===== 書き込み =====
with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! SellersPage.tsx updated successfully.')
print('Changes:')
print('  - Added propertyAddress, propertyType, valuationAmount1, visitAssignee to Seller interface')
print('  - Removed columns: 不通, Pinrich, ステータス, 除外日, 電話番号')
print('  - Added columns after 次電日: 物件所在地, 種別, 査定額, 営担')
print('  - Updated colSpan from 13 to 12')
