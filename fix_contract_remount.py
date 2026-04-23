#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ContractSettlementSection の useState/useEffect を親コンポーネントに移動し、
コンポーネントを () => ( 形式に戻す（再マウント問題の修正）
"""
import sys

FILE_PATH = 'frontend/frontend/src/components/WorkTaskDetailModal.tsx'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 1. ContractSettlementSection の useState/useEffect を削除して
#    () => { return ( ... ); }; を () => ( ... ); に戻す
# ============================================================

OLD_SECTION_START = '''  // 契約決済セクション（スクショ通り）
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

NEW_SECTION_START = '''  // 契約決済セクション（スクショ通り）
  const ContractSettlementSection = () => (
    <Box sx={{ display: 'flex', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>'''

if OLD_SECTION_START not in text:
    print('ERROR: ContractSettlementSection開始部分が見つかりません')
    sys.exit(1)

text = text.replace(OLD_SECTION_START, NEW_SECTION_START, 1)
print('✅ ContractSettlementSection開始部分を元に戻しました')

# ============================================================
# 2. 終わりの return ); }; を ); に戻す
# ============================================================
OLD_END = '''    </Box>
    );
  };

  // 売主、買主詳細セクション'''

NEW_END = '''    </Box>
  );

  // 売主、買主詳細セクション'''

if OLD_END not in text:
    print('ERROR: ContractSettlementSection終了部分が見つかりません')
    sys.exit(1)

text = text.replace(OLD_END, NEW_END, 1)
print('✅ ContractSettlementSection終了部分を元に戻しました')

# ============================================================
# 3. contractRevisionSummary の state と useEffect を親コンポーネントに追加
#    fetchRevisionHistories の定義の後に追加する
# ============================================================
OLD_FETCH_REVISION = '''  // 修正履歴テーブルを再取得する関数
  const fetchRevisionHistories = () => {'''

NEW_FETCH_REVISION = '''  // 契約書修正内容まとめ用データ（ContractSettlementSection用）
  const [contractRevisionSummary, setContractRevisionSummary] = useState<Array<{
    property_number: string;
    property_address: string;
    contract_input_deadline: string | null;
    employee_contract_creation: string | null;
    contract_revision_content: string | null;
  }>>([]);

  useEffect(() => {
    if (!open) return;
    const fetchContractRevisionSummary = async () => {
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
    fetchContractRevisionSummary();
  }, [open, data]);

  // 修正履歴テーブルを再取得する関数
  const fetchRevisionHistories = () => {'''

if OLD_FETCH_REVISION not in text:
    print('ERROR: fetchRevisionHistories定義が見つかりません')
    # 別の場所を探す
    # hasChanges の後に追加
    OLD_FETCH_REVISION2 = '''  const hasChanges = Object.keys(editedData).length > 0;'''
    NEW_FETCH_REVISION2 = '''  const hasChanges = Object.keys(editedData).length > 0;

  // 契約書修正内容まとめ用データ（ContractSettlementSection用）
  const [contractRevisionSummary, setContractRevisionSummary] = useState<Array<{
    property_number: string;
    property_address: string;
    contract_input_deadline: string | null;
    employee_contract_creation: string | null;
    contract_revision_content: string | null;
  }>>([]);

  useEffect(() => {
    if (!open) return;
    const fetchContractRevisionSummary = async () => {
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
    fetchContractRevisionSummary();
  }, [open, data]);'''

    if OLD_FETCH_REVISION2 not in text:
        print('ERROR: hasChanges定義も見つかりません')
        sys.exit(1)
    text = text.replace(OLD_FETCH_REVISION2, NEW_FETCH_REVISION2, 1)
    print('✅ contractRevisionSummaryをhasChangesの後に追加しました')
else:
    text = text.replace(OLD_FETCH_REVISION, NEW_FETCH_REVISION, 1)
    print('✅ contractRevisionSummaryをfetchRevisionHistoriesの前に追加しました')

# ============================================================
# 4. UTF-8で書き込み
# ============================================================
with open(FILE_PATH, 'wb') as f:
    f.write(text.encode('utf-8'))

with open(FILE_PATH, 'rb') as f:
    head = f.read(3)
if head == b'\xef\xbb\xbf':
    print('WARNING: BOM付き')
else:
    print('✅ BOMなしUTF-8で書き込み完了')

print('完了！')
