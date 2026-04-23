#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ContractSettlementSection を () => ( から () => { に変換して
修正内容まとめテーブルを追加する
"""
import sys

FILE_PATH = 'frontend/frontend/src/components/WorkTaskDetailModal.tsx'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# アロー関数の開始部分を変換
OLD_START = '''  // 契約決済セクション（スクショ通り）
  const ContractSettlementSection = () => (
    <Box sx={{ display: 'flex', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>'''

NEW_START = '''  // 契約決済セクション（スクショ通り）
  const ContractSettlementSection = () => {
    // 契約書修正内容まとめ用データ取得
    const [contractRevisionSummary, setContractRevisionSummary] = React.useState<Array<{
      property_number: string;
      property_address: string;
      contract_input_deadline: string | null;
      employee_contract_creation: string | null;
      contract_revision_content: string | null;
    }>>([]);

    React.useEffect(() => {
      const fetchSummary = async () => {
        try {
          const { data: rows, error } = await supabase
            .from('work_tasks')
            .select('property_number, property_address, contract_input_deadline, employee_contract_creation, contract_revision_content')
            .eq('contract_revision_exists', 'あり')
            .not('contract_revision_content', 'is', null)
            .order('contract_input_deadline', { ascending: false, nullsFirst: false });
          if (!error && rows) {
            setContractRevisionSummary(rows);
          }
        } catch {
          // エラー時は空のまま
        }
      };
      fetchSummary();
    }, [data]);

    return (
    <Box sx={{ display: 'flex', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>'''

if OLD_START not in text:
    print('ERROR: ContractSettlementSection開始部分が見つかりません')
    sys.exit(1)

text = text.replace(OLD_START, NEW_START, 1)
print('✅ ContractSettlementSection開始部分を変換しました')

# 「製本完了」の後、右ペインの前に修正内容まとめテーブルを追加
OLD_TABLE = '''          <EditableField label="製本予定日" field="binding_scheduled_date" type="date" />
          <EditableField label="製本完了" field="binding_completed" />
        </Box>
      </Box>

      {/* 右ペイン: 決済詳細 */}'''

NEW_TABLE = '''          <EditableField label="製本予定日" field="binding_scheduled_date" type="date" />
          <EditableField label="製本完了" field="binding_completed" />

          {/* 契約書、重説他の修正内容まとめ（全物件） */}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#b71c1c', mb: 1, mt: 3 }}>
            契約書、重説他の修正内容　まとめ
          </Typography>
          {contractRevisionSummary.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              修正内容のある物件はありません
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto', mb: 2 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#ffcdd2' }}>
                    <th style={{ border: '1px solid #e57373', padding: '6px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>重説・契約書入力納期</th>
                    <th style={{ border: '1px solid #e57373', padding: '6px 10px', textAlign: 'left', whiteSpace: 'nowrap' }}>写真が契約書作成</th>
                    <th style={{ border: '1px solid #e57373', padding: '6px 10px', textAlign: 'left', minWidth: '300px' }}>修正内容</th>
                  </tr>
                </thead>
                <tbody>
                  {contractRevisionSummary.map((row, idx) => (
                    <tr key={row.property_number} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fff8f8' }}>
                      <td style={{ border: '1px solid #e0e0e0', padding: '6px 10px', whiteSpace: 'nowrap', color: '#555' }}>
                        {row.contract_input_deadline
                          ? new Date(row.contract_input_deadline).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
                          : '-'}
                      </td>
                      <td style={{ border: '1px solid #e0e0e0', padding: '6px 10px', whiteSpace: 'nowrap' }}>
                        {row.employee_contract_creation || '-'}
                      </td>
                      <td style={{ border: '1px solid #e0e0e0', padding: '6px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {row.contract_revision_content || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          )}
        </Box>
      </Box>

      {/* 右ペイン: 決済詳細 */}'''

if OLD_TABLE not in text:
    print('ERROR: テーブル挿入箇所が見つかりません')
    sys.exit(1)

text = text.replace(OLD_TABLE, NEW_TABLE, 1)
print('✅ 修正内容まとめテーブルを追加しました')

# 関数の終わりの ) を }; に変換する必要がある
# ContractSettlementSection の閉じ括弧を探す
# 右ペインの終わりの </Box> の後の ); を ); に変換
# SellerBuyerDetailSection の直前の ); を見つける
# 実際には ContractSettlementSection の return の閉じ括弧を追加する必要がある

# 右ペインの最後の </Box> の後に return の閉じ括弧と関数の閉じ括弧を追加
# 現在: ...最後の </Box>\n  );\n\n  // 売主、買主詳細セクション
# 変更後: ...最後の </Box>\n    );\n  };\n\n  // 売主、買主詳細セクション

# ContractSettlementSectionの終わりを探す
# 右ペインの最後は </Box> で終わり、その後に ); がある
# SellerBuyerDetailSectionの前の ); を ); }; に変換

OLD_END = '''    </Box>
  );

  // 売主、買主詳細セクション'''

NEW_END = '''    </Box>
    );
  };

  // 売主、買主詳細セクション'''

if OLD_END not in text:
    print('ERROR: ContractSettlementSection終了部分が見つかりません')
    sys.exit(1)

text = text.replace(OLD_END, NEW_END, 1)
print('✅ ContractSettlementSection終了部分を変換しました')

with open(FILE_PATH, 'wb') as f:
    f.write(text.encode('utf-8'))

with open(FILE_PATH, 'rb') as f:
    head = f.read(3)
if head == b'\xef\xbb\xbf':
    print('WARNING: BOM付き')
else:
    print('✅ BOMなしUTF-8で書き込み完了')

print('完了！')
