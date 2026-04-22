import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PageNavigation from './PageNavigation';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Box,
  Tabs,
  Tab,
  Typography,
  TextField,
  Button,
  ButtonGroup,
  Grid,
  CircularProgress,
  Link,
  Snackbar,
  Alert,
} from '@mui/material';
import { Close as CloseIcon, Save as SaveIcon, ContentCopy as ContentCopyIcon, WarningAmber as WarningAmberIcon } from '@mui/icons-material';
import api from '../services/api';
import { supabase } from '../services/supabase';
import { isDeadlineExceeded } from '../utils/deadlineUtils';



interface WorkTaskDetailModalProps {
  open: boolean;
  onClose: () => void;
  propertyNumber: string | null;
  onUpdate?: () => void;
  initialData?: Partial<WorkTaskData> | null;
}

interface WorkTaskData {
  id: string;
  property_number: string;
  property_address: string;
  seller_name: string;
  spreadsheet_url: string;
  sales_assignee: string;
  mediation_type: string;
  mediation_deadline: string;
  mediation_completed: string;
  mediation_creator: string;
  mediation_notes: string;
  on_hold: string;
  site_registration_deadline: string;
  site_registration_request_date: string;
  site_registration_due_date: string;
  site_registration_confirmed: string;
  site_registration_confirmer: string;
  site_registration_confirm_request_date: string;
  site_registration_comment: string;
  site_registration_requester: string;
  site_registration_requestor: string;
  site_registration_ok_comment: string;
  site_registration_ok_sent: string;
  floor_plan: string;
  floor_plan_request_date: string;
  floor_plan_due_date: string;
  floor_plan_completed_date: string;
  floor_plan_confirmer: string;
  floor_plan_comment: string;
  floor_plan_ok_comment: string;
  floor_plan_ok_sent: string;
  floor_plan_stored_email: string;
  floor_plan_revision_count: string;
  panorama: string;
  panorama_completed: string;
  site_notes: string;
  property_type: string;
  cadastral_map_sales_input: string;
  cadastral_map_field: string;
  cadastral_map_url: string;
  storage_url: string;
  cw_request_email_site: string;
  cw_request_email_floor_plan: string;
  cw_request_email_2f_above: string;
  cw_person: string;
  email_distribution: string;
  pre_distribution_check: string;
  distribution_date: string;
  publish_scheduled_date: string;
  direction_symbol: string;
  road_dimensions: string;
  property_list_row_added: string;
  property_file: string;
  sales_contract_confirmed: string;
  completed_comment_sales: string;
  binding_scheduled_date: string;
  binding_completed: string;
  seller_payment_method: string;
  brokerage_fee_seller: number;
  standard_brokerage_fee_seller: number;
  campaign: string;
  discount_reason_other: string;
  referral_flyer_given: string;
  review_seller: string;
  review_buyer: string;
  other_comments: string;
  settlement_completed_chat: string;
  ledger_created: string;
  payment_confirmed_seller: string;
  accounting_confirmed: string;
  ura_chat: string;
  judicial_scrivener: string;
  judicial_scrivener_contact: string;
  broker: string;
  broker_contact: string;
  [key: string]: any;
}

// CWカウントデータの型
interface CwCountData {
  floorPlan300: string | null;
  floorPlan500: string | null;
  siteRegistration: string | null;
}

// CWカウント取得フック
// GASが定期同期するcw_countsテーブルから「現在計」を取得
function useCwCounts(): CwCountData {
  const [data, setData] = useState<CwCountData>({ floorPlan300: null, floorPlan500: null, siteRegistration: null });

  useEffect(() => {
    const fetchCwCounts = async () => {
      try {
        const { data: rows, error } = await supabase
          .from('cw_counts')
          .select('item_name, current_total')
          .in('item_name', ['間取図（300円）', '間取図（500円）', 'サイト登録']);

        if (error || !rows) return;

        const result: CwCountData = { floorPlan300: null, floorPlan500: null, siteRegistration: null };
        rows.forEach(row => {
          if (row.item_name === '間取図（300円）') result.floorPlan300 = row.current_total;
          if (row.item_name === '間取図（500円）') result.floorPlan500 = row.current_total;
          if (row.item_name === 'サイト登録') result.siteRegistration = row.current_total;
        });
        setData(result);
      } catch {
        // エラー時はフォールバック値のまま
      }
    };
    fetchCwCounts();
  }, []);

  return data;
}

// 通常スタッフのイニシャルを動的取得するフック
function useNormalInitials(): string[] {
  const [initials, setInitials] = useState<string[]>(ASSIGNEE_OPTIONS);
  useEffect(() => {
    api.get('/api/employees/normal-initials')
      .then(res => {
        if (res.data.initials?.length > 0) setInitials(res.data.initials);
      })
      .catch(() => { /* フォールバック: ASSIGNEE_OPTIONS のまま */ });
  }, []);
  return initials;
}

// 締日超過警告ダイアログのプロパティ定義
interface DeadlineWarningDialogProps {
  open: boolean;
  fieldLabel: string; // 超過したフィールドのラベル（例: "サイト登録納期予定日"）
  onClose: () => void;
}

// 物件一覧に行追加 未入力警告ダイアログ
const RowAddWarningDialog = ({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) => (
  <Dialog open={open} onClose={onCancel}>
    <DialogTitle>確認</DialogTitle>
    <DialogContent>
      <Typography>物件一覧に行追加が未入力です。このまま保存しますか？</Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onCancel} color="inherit">キャンセル</Button>
      <Button onClick={onConfirm} color="primary" variant="contained">このまま保存</Button>
    </DialogActions>
  </Dialog>
);


// バリデーション警告ダイアログコンポーネント
interface ValidationWarningDialogProps {
  open: boolean;
  title: string;
  emptyFields: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

const ValidationWarningDialog = ({ open, title, emptyFields, onConfirm, onCancel }: ValidationWarningDialogProps) => (
  <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <WarningAmberIcon sx={{ color: 'warning.main' }} />
      <Typography component="span" sx={{ fontWeight: 700 }}>{title}</Typography>
    </DialogTitle>
    <DialogContent>
      <Typography sx={{ fontWeight: 700, mb: 1 }}>以下のフィールドが未入力です：</Typography>
      {emptyFields.map((field) => (
        <Typography key={field}>・未入力：{field}</Typography>
      ))}
    </DialogContent>
    <DialogActions>
      <Button onClick={onCancel} color="error" variant="outlined">キャンセル</Button>
      <Button onClick={onConfirm} color="primary" variant="contained">このまま保存する</Button>
    </DialogActions>
  </Dialog>
);

// 締日超過警告ダイアログコンポーネント
function DeadlineWarningDialog({ open, fieldLabel, onClose }: DeadlineWarningDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          border: '3px solid #d32f2f',
          borderRadius: 2,
          boxShadow: '0 0 30px rgba(211, 47, 47, 0.5)',
        }
      }}
    >
      <DialogTitle sx={{
        bgcolor: '#d32f2f',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        fontWeight: 700,
        fontSize: '1.1rem',
        py: 1.5,
      }}>
        <WarningAmberIcon sx={{ fontSize: '1.8rem', color: '#ffeb3b' }} />
        ⚠️ 締日超過の警告
      </DialogTitle>
      <DialogContent sx={{ pt: 3, pb: 2, bgcolor: '#fff8f8' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Typography sx={{
            fontSize: '1.15rem',
            fontWeight: 700,
            color: '#b71c1c',
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            🚨 サイト登録締日を過ぎています
          </Typography>
          <Typography sx={{
            fontSize: '1.05rem',
            fontWeight: 600,
            color: '#c62828',
            textAlign: 'center',
            bgcolor: '#ffebee',
            border: '2px solid #ef9a9a',
            borderRadius: 1,
            px: 3,
            py: 1.5,
          }}>
            担当に確認しましたか？
          </Typography>
          {fieldLabel && (
            <Typography variant="caption" sx={{ color: '#757575', mt: 0.5 }}>
              対象フィールド：{fieldLabel}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ bgcolor: '#fff8f8', pb: 2, px: 3 }}>
        <Button
          onClick={onClose}
          variant="contained"
          fullWidth
          sx={{
            bgcolor: '#d32f2f',
            '&:hover': { bgcolor: '#b71c1c' },
            fontWeight: 700,
            fontSize: '1rem',
            py: 1,
          }}
        >
          確認しました
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================
// バリデーション純粋関数（モジュールレベル）
// ============================================================

// フィールドの空欄判定（''、null、undefinedを空欄とみなす）
const isEmpty = (value: any): boolean =>
  value === '' || value === null || value === undefined;

// サイト登録確認グループのフィールド表示名マッピング
const SITE_REGISTRATION_FIELD_LABELS: Record<string, string> = {
  site_registration_confirmed: 'サイト登録確認',
  site_registration_ok_sent: 'サイト登録確認OK送信',
};

// 間取図グループのフィールド表示名マッピング
const FLOOR_PLAN_FIELD_LABELS: Record<string, string> = {
  floor_plan_confirmer: '間取図確認者',
  floor_plan_ok_sent: '間取図確認OK送信',
  floor_plan_completed_date: '間取図完了日',
  floor_plan_stored_email: '間取図格納済み確認メール',
};

// サイト登録確認グループのバリデーション
// XOR条件：片方だけ入力されている場合に警告
function checkSiteRegistrationWarning(getValue: (field: string) => any): {
  hasWarning: boolean;
  emptyFields: string[];
} {
  const confirmed = getValue('site_registration_confirmed');
  const okSent = getValue('site_registration_ok_sent');
  const confirmedEmpty = isEmpty(confirmed);
  const okSentEmpty = isEmpty(okSent);
  // XOR: 片方だけ入力されている場合に警告
  const hasWarning = confirmedEmpty !== okSentEmpty;
  const emptyFields: string[] = [];
  if (hasWarning) {
    if (confirmedEmpty) emptyFields.push(SITE_REGISTRATION_FIELD_LABELS['site_registration_confirmed']);
    if (okSentEmpty) emptyFields.push(SITE_REGISTRATION_FIELD_LABELS['site_registration_ok_sent']);
  }
  return { hasWarning, emptyFields };
}

// 間取図グループのバリデーション
// 一部入力・一部空欄の場合に警告（全て空欄または全て入力済みは正常）
function checkFloorPlanWarning(getValue: (field: string) => any): {
  hasWarning: boolean;
  emptyFields: string[];
} {
  const fields = Object.keys(FLOOR_PLAN_FIELD_LABELS);
  const emptyFields: string[] = [];
  let filledCount = 0;
  for (const field of fields) {
    const value = getValue(field);
    if (isEmpty(value)) {
      emptyFields.push(FLOOR_PLAN_FIELD_LABELS[field]);
    } else {
      filledCount++;
    }
  }
  // 一部入力・一部空欄の場合のみ警告
  const hasWarning = filledCount > 0 && emptyFields.length > 0;
  return { hasWarning, emptyFields: hasWarning ? emptyFields : [] };
}

const ASSIGNEE_OPTIONS = ['K', 'Y', 'I', '生', 'U', 'R', '久', 'H'];

export default function WorkTaskDetailModal({ open, onClose, propertyNumber, onUpdate, initialData }: WorkTaskDetailModalProps) {
  const [tabIndex, setTabIndex] = useState(0);
  const navigate = useNavigate();
  const normalInitials = useNormalInitials();
  const cwCounts = useCwCounts();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<WorkTaskData | null>(null);
  const [editedData, setEditedData] = useState<Partial<WorkTaskData>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  });
  const [warningDialog, setWarningDialog] = useState<{
    open: boolean;
    fieldLabel: string;
  }>({ open: false, fieldLabel: '' });
  const [rowAddWarningDialog, setRowAddWarningDialog] = useState<{ open: boolean }>({ open: false });
  const [validationWarningDialog, setValidationWarningDialog] = useState<{
    open: boolean;
    title: string;
    emptyFields: string[];
    onConfirmAction: 'site' | 'floor' | null;
  }>({ open: false, title: '', emptyFields: [], onConfirmAction: null });

  useEffect(() => {
    if (open && propertyNumber) {
      // 一覧データがあれば即座に表示（ローディングなし）
      if (initialData) {
        const taskData = initialData as WorkTaskData;
        setData(taskData);
        setLoading(false);
        // バックグラウンドで詳細データを取得（差し替え）
        fetchData(true);
      } else {
        fetchData(false);
      }
      setEditedData({});
    }
  }, [open, propertyNumber]);

  const checkDeadlineOnLoad = (taskData: WorkTaskData) => {
    const deadline = taskData.site_registration_deadline;
    const DEADLINE_CHECK_FIELDS: Record<string, string> = {
      site_registration_due_date: 'サイト登録納期予定日',
      floor_plan_due_date: '間取図完了予定',
    };
    for (const [field, label] of Object.entries(DEADLINE_CHECK_FIELDS)) {
      if (isDeadlineExceeded(taskData[field], deadline)) {
        setWarningDialog({ open: true, fieldLabel: label });
        return; // 最初に見つかったフィールドで1つだけ表示
      }
    }
  };

  const fetchData = async (background = false) => {
    if (!propertyNumber) return;
    if (!background) setLoading(true);
    try {
      const response = await api.get(`/api/work-tasks/${propertyNumber}`);
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch work task:', error);
      if (!background) setData(null);
    } finally {
      if (!background) setLoading(false);
    }
  };

  const handleNavigate = (path: string) => {
    onClose();
    navigate(path);
  };

  const executeSave = async () => {
    setSaving(true);
    try {
      await api.put(`/api/work-tasks/${propertyNumber}`, editedData);
      setSnackbar({ open: true, message: '保存しました', severity: 'success' });
      await fetchData(false);
      setEditedData({});
      onUpdate?.();
    } catch (error) {
      console.error('Failed to save:', error);
      setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!propertyNumber || Object.keys(editedData).length === 0) return;

    // 条件付きバリデーション
    const cwEmailSite = getValue('cw_request_email_site');
    const rowAdded = getValue('property_list_row_added');
    if (cwEmailSite && !rowAdded) {
      setRowAddWarningDialog({ open: true });
      return;
    }

    // 要件1チェック（サイト登録確認グループ）
    const siteResult = checkSiteRegistrationWarning(getValue);
    if (siteResult.hasWarning) {
      setValidationWarningDialog({
        open: true,
        title: 'サイト登録確認関連フィールドに未入力項目があります',
        emptyFields: siteResult.emptyFields,
        onConfirmAction: 'site',
      });
      return;
    }

    // 要件2チェック（間取図グループ）
    const floorResult = checkFloorPlanWarning(getValue);
    if (floorResult.hasWarning) {
      setValidationWarningDialog({
        open: true,
        title: '間取図関連フィールドに未入力項目があります',
        emptyFields: floorResult.emptyFields,
        onConfirmAction: 'floor',
      });
      return;
    }

    await executeSave();
  };

  const handleValidationWarningConfirm = async () => {
    const action = validationWarningDialog.onConfirmAction;
    setValidationWarningDialog(prev => ({ ...prev, open: false }));

    if (action === 'site') {
      // 要件1をスキップして要件2チェックへ
      const getValueLocal = (field: string) => editedData[field] !== undefined ? editedData[field] : data?.[field];
      const floorResult = checkFloorPlanWarning(getValueLocal);
      if (floorResult.hasWarning) {
        setValidationWarningDialog({
          open: true,
          title: '間取図関連フィールドに未入力項目があります',
          emptyFields: floorResult.emptyFields,
          onConfirmAction: 'floor',
        });
        return;
      }
    }

    await executeSave();
  };

  const handleValidationWarningCancel = () => {
    setValidationWarningDialog(prev => ({ ...prev, open: false }));
  };

  const handleFieldChange = (field: string, value: any) => {
    // 左右ペインのスクロール位置を保存
    leftScrollRef.current = leftPaneRef.current?.scrollTop ?? 0;
    rightScrollRef.current = rightPaneRef.current?.scrollTop ?? 0;
    setEditedData(prev => ({ ...prev, [field]: value }));

    // 締日超過チェック対象フィールド
    const DEADLINE_CHECK_FIELDS: Record<string, string> = {
      site_registration_due_date: 'サイト登録納期予定日',
      floor_plan_due_date: '間取図完了予定',
    };

    if (field in DEADLINE_CHECK_FIELDS) {
      const deadline = editedData['site_registration_deadline'] ?? data?.['site_registration_deadline'];
      if (isDeadlineExceeded(value, deadline)) {
        setWarningDialog({ open: true, fieldLabel: DEADLINE_CHECK_FIELDS[field] });
      }
    }
  };

  const getValue = (field: string) => {
    return editedData[field] !== undefined ? editedData[field] : data?.[field];
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  const formatDateForInput = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // TIMESTAMPTZ / ISO 8601 文字列を datetime-local 形式（YYYY-MM-DDTHH:mm）に変換
  const formatDateTimeForInput = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear();
      const MM = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      // DATE型からTIMESTAMPTZに変換された値はUTC 00:00:00 → JST 09:00になるため 12:00 にフォールバック
      if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
        return `${yyyy}-${MM}-${dd}T12:00`;
      }
      return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
    } catch {
      return '';
    }
  };

  const hasChanges = Object.keys(editedData).length > 0;

  // サイト登録タブ左右ペインのスクロール位置保持用 ref
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<number>(0);
  const rightScrollRef = useRef<number>(0);

  // editedData 変更後に左右ペインのスクロール位置を復元
  useEffect(() => {
    if (leftPaneRef.current) {
      leftPaneRef.current.scrollTop = leftScrollRef.current;
    }
    if (rightPaneRef.current) {
      rightPaneRef.current.scrollTop = rightScrollRef.current;
    }
  }, [editedData]);



  // 編集可能テキストフィールド
  const EditableField = ({ label, field, type = 'text' }: { label: string; field: string; type?: string }) => (
    <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
      <Grid item xs={4}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>{label}</Typography>
      </Grid>
      <Grid item xs={8}>
        {type === 'date' ? (
          <TextField
            size="small"
            type="date"
            value={formatDateForInput(getValue(field))}
            onChange={(e) => handleFieldChange(field, e.target.value || null)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            onClick={(e) => {
              const input = (e.currentTarget as HTMLElement).querySelector('input');
              (input as HTMLInputElement | null)?.showPicker?.();
            }}
          />
        ) : type === 'datetime-local' ? (
          <TextField
            size="small"
            type="datetime-local"
            value={formatDateTimeForInput(getValue(field))}
            onChange={(e) => handleFieldChange(field, e.target.value || null)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            onClick={(e) => {
              const input = (e.currentTarget as HTMLElement).querySelector('input');
              (input as HTMLInputElement | null)?.showPicker?.();
            }}
          />
        ) : type === 'number' ? (
          <TextField
            size="small"
            type="number"
            value={getValue(field) || ''}
            onChange={(e) => handleFieldChange(field, e.target.value ? Number(e.target.value) : null)}
            fullWidth
          />
        ) : type === 'url' ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              value={getValue(field) || ''}
              onChange={(e) => handleFieldChange(field, e.target.value)}
              fullWidth
            />
            {getValue(field) && (
              <Link href={getValue(field)} target="_blank" rel="noopener" sx={{ whiteSpace: 'nowrap' }}>開く</Link>
            )}
          </Box>
        ) : (
          <TextField
            size="small"
            value={getValue(field) || ''}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            fullWidth
          />
        )}
      </Grid>
    </Grid>
  );

  // 編集可能ボタン選択
  const EditableButtonSelect = ({ label, field, options, labelColor }: { label: string; field: string; options: string[]; labelColor?: 'error' | 'text.secondary' }) => (
    <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
      <Grid item xs={4}>
        <Typography variant="body2" color={labelColor || 'text.secondary'} sx={{ fontWeight: labelColor === 'error' ? 700 : 500 }}>{label}</Typography>
      </Grid>
      <Grid item xs={8}>
        <ButtonGroup size="small" variant="outlined">
          {options.map((opt) => (
            <Button
              key={opt}
              variant={getValue(field) === opt ? 'contained' : 'outlined'}
              color={getValue(field) === opt ? 'primary' : 'inherit'}
              onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, getValue(field) === opt ? null : opt); }}
            >
              {opt}
            </Button>
          ))}
        </ButtonGroup>
      </Grid>
    </Grid>
  );

  // Yes/No選択
  const EditableYesNo = ({ label, field }: { label: string; field: string }) => (
    <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
      <Grid item xs={4}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>{label}</Typography>
      </Grid>
      <Grid item xs={8}>
        <ButtonGroup size="small" variant="outlined">
          <Button
            variant={getValue(field) === 'Y' ? 'contained' : 'outlined'}
            color={getValue(field) === 'Y' ? 'primary' : 'inherit'}
            onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, getValue(field) === 'Y' ? null : 'Y'); }}
          >Y</Button>
          <Button
            variant={getValue(field) === 'N' ? 'contained' : 'outlined'}
            color={getValue(field) === 'N' ? 'inherit' : 'inherit'}
            onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, getValue(field) === 'N' ? null : 'N'); }}
          >N</Button>
        </ButtonGroup>
      </Grid>
    </Grid>
  );

  // 媒介契約セクション
  const MediationSection = () => (
    <Box sx={{ p: 2 }}>
      <EditableField label="物件番号" field="property_number" />
      <EditableField label="媒介備考" field="mediation_notes" />
      <EditableField label="物件所在" field="property_address" />
      <EditableField label="売主" field="seller_name" />
      <EditableField label="スプシURL" field="spreadsheet_url" type="url" />
      <EditableButtonSelect label="営業担当" field="sales_assignee" options={normalInitials} />
      <EditableField label="媒介形態" field="mediation_type" />
      <EditableField label="媒介作成締め日" field="mediation_deadline" type="date" />
      <EditableField label="媒介作成完了" field="mediation_completed" type="date" />
      <EditableButtonSelect label="媒介作成者" field="mediation_creator" options={normalInitials} />
      <EditableYesNo label="保留" field="on_hold" />
    </Box>
  );

  // セクションヘッダー
  const SectionHeader = ({ label }: { label: string }) => (
    <Typography variant="body2" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>{label}</Typography>
  );

  // 赤文字の注記
  const RedNote = ({ text }: { text: string }) => (
    <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mb: 1 }}>{text}</Typography>
  );

  // 地積測量図・字図ボタン選択コンポーネント（button-select-layout-rule.md に従った実装）
  const CADASTRAL_MAP_OPTIONS = ['格納済み＆スプシに「有、無」を入力済み', '未', '不要'];
  const CadastralMapFieldSelect = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 500 }}>
        地積測量図、字図
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
        {CADASTRAL_MAP_OPTIONS.map((opt) => (
          <Button
            key={opt}
            size="small"
            variant={getValue('cadastral_map_field') === opt ? 'contained' : 'outlined'}
            color="primary"
            onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange('cadastral_map_field', opt); }}
            sx={{ flex: 1, py: 0.5, fontWeight: getValue('cadastral_map_field') === opt ? 'bold' : 'normal', borderRadius: 1 }}
          >
            {opt}
          </Button>
        ))}
      </Box>
    </Box>
  );

  // サイト登録セクション
  const SiteRegistrationSection = ({ cwCounts, leftPaneRef, rightPaneRef }: { cwCounts: CwCountData; leftPaneRef: React.RefObject<HTMLDivElement>; rightPaneRef: React.RefObject<HTMLDivElement> }) => {
    // 変更4: サイト登録納期予定日の初期値ロジック
    const getDefaultDueDate = () => {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
      // 火曜(2)の場合は+3日、それ以外は+2日
      const daysToAdd = dayOfWeek === 2 ? 3 : 2;
      const result = new Date(today);
      result.setDate(today.getDate() + daysToAdd);
      return result.toISOString().split('T')[0];
    };

    // datetime-local 形式のデフォルト納期予定日（時刻 12:00）
    const getDefaultDueDatetime = () => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysToAdd = dayOfWeek === 2 ? 3 : 2;
      const result = new Date(today);
      result.setDate(today.getDate() + daysToAdd);
      const yyyy = result.getFullYear();
      const MM = String(result.getMonth() + 1).padStart(2, '0');
      const dd = String(result.getDate()).padStart(2, '0');
      return `${yyyy}-${MM}-${dd}T12:00`;
    };

    // 変更3: サイト登録依頼コメントのデフォルト値生成ロジック
    const formatDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      } catch { return ''; }
    };

    const generateDefaultRequestorComment = () => {
      const propertyNumber = getValue('property_number') || '';
      const propertyAddress = getValue('property_address') || '';
      const requestDate = formatDate(getValue('site_registration_request_date'));
      const requester = getValue('site_registration_requester') || '';
      const dueDate = formatDate(getValue('site_registration_due_date') || getDefaultDueDate());
      const panorama = getValue('panorama') || '';
      const floorPlanDue = formatDate(getValue('floor_plan_due_date'));
      const comment = getValue('site_registration_comment') || '';
      const spreadsheetUrl = getValue('spreadsheet_url') || '';
      const storageUrl = getValue('storage_url') || '';

      let text = `浅沼様\nお世話になっております。\nサイト登録関係お願いします。\n物件番号：${propertyNumber}\n物件所在地：${propertyAddress}\n当社依頼日：${requestDate}（${requester}）\n当社の希望納期：${dueDate}`;
      if (panorama) text += `\nパノラマ：${panorama}`;
      if (floorPlanDue) text += `\n間取図格納時期：${floorPlanDue}`;
      text += `\nコメント：${comment}\n詳細：${spreadsheetUrl}\n格納先：${storageUrl}\nご不明点等がございましたら、こちらに返信していただければと思います。`;
      return text;
    };

    // 変更2: email_distribution の値に応じた自動計算テキスト
    const getEmailDistributionAutoText = () => {
      const emailDist = getValue('email_distribution') || '';
      if (emailDist.includes('即') && emailDist.includes('不要')) {
        return '公開前配信メールは不要です。確認前に公開お願い致します。公開方法→https://docs.google.com/document/d/145LKr_Q7ftxnRVvNalaKPO1NH_FqncOlOY5bqP5P48c/edit?usp=sharing';
      }
      if (emailDist === '新着配信、即公開（期日関係無）') {
        return '公開前配信メールを「新着配信」に変更して、同時に公開もお願い致します。公開方法→https://docs.google.com/document/d/145LKr_Q7ftxnRVvNalaKPO1NH_FqncOlOY5bqP5P48c/edit?usp=sharing';
      }
      return '';
    };

    const emailDistAutoText = getEmailDistributionAutoText();

    // 変更4: cw_request_email_site が空でない場合は必須表示
    const isSiteDueDateRequired = !!(getValue('cw_request_email_site'));
    const siteDueDateLabel = `サイト登録納期予定日${isSiteDueDateRequired ? '*（必須）' : '*'}`;

    return (
    <Box sx={{ display: 'flex', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* 左側：登録関係 */}
      <Box ref={leftPaneRef} sx={{ flex: 1, p: 2, borderRight: '2px solid', borderColor: 'divider', overflowY: 'auto', minHeight: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1565c0' }}>【登録関係】</Typography>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            size="small"
            disabled={!hasChanges || saving}
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
            sx={hasChanges ? {
              animation: 'pulse-save 1s ease-in-out infinite',
              '@keyframes pulse-save': {
                '0%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.7)' },
                '70%': { boxShadow: '0 0 0 8px rgba(25, 118, 210, 0)' },
                '100%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0)' },
              },
            } : {}}
          >{saving ? '保存中...' : '保存'}</Button>
        </Box>
        <EditableField label="サイト登録締め日" field="site_registration_deadline" type="date" />
        <EditableField label="種別" field="property_type" />

        <Box sx={{ bgcolor: '#e3f2fd', borderRadius: 1, p: 1, mb: 1 }}>
        <SectionHeader label="【サイト登録依頼】" />
        <EditableField label="サイト備考" field="site_notes" />
        {getValue('property_type') === '土' && (
          <>
            <EditableButtonSelect label="字図、地積測量図URL*" field="cadastral_map_url" options={['URL入力済み', '未']} />
            <ReadOnlyDisplayField label="地積測量図・字図（営業入力）" value={getValue('cadastral_map_sales_input') || null} />
            <CadastralMapFieldSelect />
          </>
        )}
        {getValue('property_type') === '土' && (
          <RedNote text={'地積測量図や字図を格納→「リンク知っている人全員」\nの共有URLをスプシの「内覧前伝達事項」に貼り付ける'} />
        )}
        <EditableField label="格納先URL" field="storage_url" type="url" />
        <EditableYesNo label="CWの方へ依頼メール（サイト登録）" field="cw_request_email_site" />
        <EditableButtonSelect label="CWの方*" field="cw_person" options={['浅沼様（土日OK, 平日は中１日あけて納期）']} />
        <EditableField label="メール配信" field="email_distribution" />
        <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Grid item xs={4}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, pt: 1 }}>コメント（サイト登録）</Typography>
          </Grid>
          <Grid item xs={8}>
            <TextField
              size="small"
              value={getValue('site_registration_comment') || ''}
              onChange={(e) => handleFieldChange('site_registration_comment', e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Grid>
        </Grid>
        <ReadOnlyDisplayField label="サイト登録依頼コメント" value={generateDefaultRequestorComment()} />
        <EditableButtonSelect label="パノラマ" field="panorama" options={['あり']} />
        <EditableButtonSelect label="サイト登録依頼者*" field="site_registration_requester" options={normalInitials} />
        <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
          <Grid item xs={4}>
            <Typography
              variant="body2"
              color={isSiteDueDateRequired ? 'error' : 'text.secondary'}
              sx={{ fontWeight: isSiteDueDateRequired ? 700 : 500 }}
            >
              {siteDueDateLabel}
            </Typography>
          </Grid>
          <Grid item xs={8}>
            <TextField
              size="small"
              type="datetime-local"
              value={formatDateTimeForInput(getValue('site_registration_due_date')) || getDefaultDueDatetime()}
              onChange={(e) => handleFieldChange('site_registration_due_date', e.target.value || null)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>CWの方、広瀬さん記入↓↓</Typography>
        <EditableField label="サイト登録確認依頼日" field="site_registration_confirm_request_date" type="date" />

        </Box>

        <Box sx={{ bgcolor: '#e8f5e9', borderRadius: 1, p: 1, mb: 1 }}>
        <SectionHeader label="【図面作成依頼】" />
        <EditableButtonSelect label="間取図" field="floor_plan" options={['クラウドワークス', '他', '不要']} />
        <EditableButtonSelect label="方位記号" field="direction_symbol" options={['確認済', '不要（営業相談済）']} />
        <EditableField label="コメント（間取図関係）" field="floor_plan_comment" />
        {getValue('property_type') === '土' && (
          <EditableField label="道路寸法" field="road_dimensions" />
        )}
        <EditableYesNo label="CWの方へ依頼メール（間取り、区画図）" field="cw_request_email_floor_plan" />
        <EditableYesNo label="CWの方へ依頼メール（2階以上）" field="cw_request_email_2f_above" />
        <EditableField label="間取図完了予定*" field="floor_plan_due_date" type="datetime-local" />
        </Box>
        {/* 物件一覧に行追加（薄いピンク背景） */}
        <Box sx={{ bgcolor: '#fce4ec', borderRadius: 1, p: 1, mb: 1 }}>
          <EditableButtonSelect
            label="物件一覧に行追加*"
            field="property_list_row_added"
            options={['追加済', '未']}
            labelColor={getValue('cw_request_email_site') ? 'error' : 'text.secondary'}
          />
        </Box>
      </Box>

      {/* 右側：確認関係 */}
      <Box ref={rightPaneRef} sx={{ flex: 1, p: 2, overflowY: 'auto', minHeight: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#2e7d32' }}>【確認関係】</Typography>
          <Button
            onClick={handleSave}
            variant="contained"
            color="success"
            size="small"
            disabled={!hasChanges || saving}
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
            sx={hasChanges ? {
              animation: 'pulse-save 1s ease-in-out infinite',
              '@keyframes pulse-save': {
                '0%': { boxShadow: '0 0 0 0 rgba(46, 125, 50, 0.7)' },
                '70%': { boxShadow: '0 0 0 8px rgba(46, 125, 50, 0)' },
                '100%': { boxShadow: '0 0 0 0 rgba(46, 125, 50, 0)' },
              },
            } : {}}
          >{saving ? '保存中...' : '保存'}</Button>
        </Box>

        <Box sx={{ bgcolor: '#f3e5f5', borderRadius: 1, p: 1, mb: 1 }}>
        <SectionHeader label="【★サイト登録確認】" />
        <EditableButtonSelect label="サイト登録確認" field="site_registration_confirmed" options={['確認中', '完了', '他']} />
        <EditableField label="メール配信v" field="email_distribution" />
        <EditableField label="サイト登録確認OKコメント" field="site_registration_ok_comment" type="text" />
        <EditableYesNo label="サイト登録確認OK送信" field="site_registration_ok_sent" />
        <ReadOnlyDisplayField
          label=""
          value={cwCounts.siteRegistration ? `サイト登録（CW)計⇒ ${cwCounts.siteRegistration}` : '-'}
        />
        </Box>

        <Box sx={{ bgcolor: '#fff3e0', borderRadius: 1, p: 1, mb: 1 }}>
        <SectionHeader label="【★図面確認】" />
        <EditableButtonSelect label="間取図確認者*" field="floor_plan_confirmer" options={normalInitials} />
        <EditableField label="間取図確認OK/修正コメント" field="floor_plan_ok_comment" />
        <EditableYesNo label="間取図確認OK送信*" field="floor_plan_ok_sent" />
        <EditableButtonSelect label="間取図修正回数" field="floor_plan_revision_count" options={['1', '2', '3', '4']} />
        <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mb: 1, ml: '33.33%' }}>
          ここでの修正とは、当社のミスによる修正のことです。CWの方のミスによる修正はカウントNGです！！
        </Typography>
        <ReadOnlyDisplayField
          label=""
          value={
            getValue('cw_request_email_2f_above')
              ? (cwCounts.floorPlan500 ? `間取図500円（CW)計⇒ ${cwCounts.floorPlan500}` : '-')
              : (cwCounts.floorPlan300 ? `間取図300円（CW)計⇒ ${cwCounts.floorPlan300}` : '-')
          }
        />
        <EditableField label="間取図完了日*" field="floor_plan_completed_date" type="date" />
        <EditableYesNo label="間取図格納済み連絡メール" field="floor_plan_stored_email" />
        </Box>

        <Box sx={{ bgcolor: '#fafafa', borderRadius: 1, p: 1, mb: 1 }}>
        <SectionHeader label="【確認後処理】" />
        <EditableField label="配信日" field="distribution_date" type="date" />
        <EditableButtonSelect label="物件ファイル" field="property_file" options={['担当に渡し済み', '未']} />
        <EditableField label="公開予定日" field="publish_scheduled_date" type="date" />
        <ReadOnlyDisplayField
          label="メール配信"
          value={getValue('email_distribution') || null}
          labelColor="error"
        />
        <EditableField label="メール配信" field="pre_distribution_check" />
        <EditableField label="サイト登録締め日v" field="site_registration_deadline" type="date" />
        </Box>
      </Box>
    </Box>
    );
  };

  // 読み取り専用表示フィールド
  const ReadOnlyDisplayField = ({ label, value, labelColor }: {
    label: string;
    value: string | null;
    labelColor?: 'error' | 'text.secondary';
  }) => (
    <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
      <Grid item xs={4}>
        <Typography variant="body2" color={labelColor || 'text.secondary'} sx={{ fontWeight: 500, pt: 0.5 }}>
          {label}
        </Typography>
      </Grid>
      <Grid item xs={8}>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value || ''}</Typography>
      </Grid>
    </Grid>
  );

  // 依頼前に確認ポップアップのプロパティ定義
  interface PreRequestCheckPopupProps {
    open: boolean;
    text: string;
    onClose: () => void;
  }

  // 依頼前に確認ポップアップコンポーネント
  // URLをリンクに変換してテキストをレンダリングする
  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s\u3000\u3001\u3002\uff01\uff09\u300d\u300f]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) =>
      urlRegex.test(part) ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', wordBreak: 'break-all' }}>
          {part}
        </a>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const PreRequestCheckPopup = ({ open, text, onClose }: PreRequestCheckPopupProps) => (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>依頼前に確認</DialogTitle>
      <DialogContent dividers sx={{ overflowY: 'auto', maxHeight: '60vh' }}>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {renderTextWithLinks(text)}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );

  // 依頼前に確認ボタンコンポーネント
  const PreRequestCheckButton = () => {
    const [popupOpen, setPopupOpen] = useState(false);
    return (
      <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
        <Grid item xs={4}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            依頼前に確認
          </Typography>
        </Grid>
        <Grid item xs={8}>
          <Button
            variant="outlined"
            size="small"
            disabled={!getValue('pre_request_check')}
            onClick={() => setPopupOpen(true)}
          >
            確認する
          </Button>
          <PreRequestCheckPopup
            open={popupOpen}
            text={getValue('pre_request_check') || ''}
            onClose={() => setPopupOpen(false)}
          />
        </Grid>
      </Grid>
    );
  };

  // 複数行テキストフィールド
  const EditableMultilineField = ({ label, field }: { label: string; field: string }) => (
    <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
      <Grid item xs={4}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, pt: 1 }}>{label}</Typography>
      </Grid>
      <Grid item xs={8}>
        <TextField
          size="small"
          value={getValue(field) || ''}
          onChange={(e) => handleFieldChange(field, e.target.value)}
          fullWidth
          multiline
          rows={4}
        />
      </Grid>
    </Grid>
  );

  // 契約決済セクション（スクショ通り）
  const ContractSettlementSection = () => (
    <Box sx={{ display: 'flex', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* 左ペイン: 契約書・重説作成 */}
      <Box sx={{ flex: 1, p: 2, borderRight: '2px solid', borderColor: 'divider', overflowY: 'auto', minHeight: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1565c0' }}>【契約書、重説作成】</Typography>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            size="small"
            disabled={!hasChanges || saving}
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
            sx={hasChanges ? {
              animation: 'pulse-save 1s ease-in-out infinite',
              '@keyframes pulse-save': {
                '0%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.7)' },
                '70%': { boxShadow: '0 0 0 8px rgba(25, 118, 210, 0)' },
                '100%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0)' },
              },
            } : {}}
          >{saving ? '保存中...' : '保存'}</Button>
        </Box>
        <Box sx={{ bgcolor: '#e3f2fd', borderRadius: 1, p: 1, mb: 1 }}>
          <EditableField label="売買契約締め日" field="sales_contract_deadline" type="date" />
          <EditableField label="売買契約備考" field="sales_contract_notes" />
          <EditableField label="契約形態" field="contract_type" />
          {/* CW（浅沼様）全エリア・種別依頼OK - 表示のみ */}
          <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
            <Grid item xs={12}>
              <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 500 }}>
                ☆ CW（浅沼様）全エリア・種別依頼OK
              </Typography>
            </Grid>
          </Grid>
          <EditableField label="重説・契約書入力納期" field="contract_input_deadline" type="date" />
          <PreRequestCheckButton />
          <EditableButtonSelect label="社員が契約書作成" field="employee_contract_creation" options={normalInitials} />
          <EditableField label="製本予定日" field="binding_scheduled_date" type="date" />
          <EditableField label="製本完了" field="binding_completed" />
        </Box>
      </Box>

      {/* 右ペイン: 決済詳細 */}
      <Box sx={{ flex: 1, p: 2, overflowY: 'auto', minHeight: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#2e7d32' }}>【決済詳細】</Typography>
          <Button
            onClick={handleSave}
            variant="contained"
            color="success"
            size="small"
            disabled={!hasChanges || saving}
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
            sx={hasChanges ? {
              animation: 'pulse-save 1s ease-in-out infinite',
              '@keyframes pulse-save': {
                '0%': { boxShadow: '0 0 0 0 rgba(46, 125, 50, 0.7)' },
                '70%': { boxShadow: '0 0 0 8px rgba(46, 125, 50, 0)' },
                '100%': { boxShadow: '0 0 0 0 rgba(46, 125, 50, 0)' },
              },
            } : {}}
          >{saving ? '保存中...' : '保存'}</Button>
        </Box>
        <Box sx={{ bgcolor: '#f3e5f5', borderRadius: 1, p: 1, mb: 1 }}>
          <EditableField label="決済日" field="settlement_date" type="date" />
          <EditableField label="決済予定月" field="settlement_scheduled_month" />
          <EditableField label="売買価格" field="sales_price" type="number" />
          <EditableField label="仲介手数料（売）" field="brokerage_fee_seller" type="number" />
          <EditableField label="通常仲介手数料（売）" field="standard_brokerage_fee_seller" type="number" />
          <EditableButtonSelect label="キャンペーン" field="campaign" options={['あり', 'なし']} />
          <EditableField label="減額理由" field="discount_reason" />
          <EditableField label="減額理由他" field="discount_reason_other" />
          <EditableButtonSelect label="売・支払方法" field="seller_payment_method" options={['振込', '現金', '他']} />
          <EditableButtonSelect label="入金確認（売）" field="payment_confirmed_seller" options={['確認済み', '未']} />
          <EditableField label="仲介手数料（買）" field="brokerage_fee_buyer" type="number" />
          <EditableField label="通常仲介手数料（買）" field="standard_brokerage_fee_buyer" type="number" />
          <EditableButtonSelect label="買・支払方法" field="buyer_payment_method" options={['振込', '現金', '他']} />
          <EditableButtonSelect label="入金確認（買）" field="payment_confirmed_buyer" options={['確認済み', '未']} />
          <EditableButtonSelect label="経理確認済み" field="accounting_confirmed" options={['未', '済']} />
        </Box>
      </Box>
    </Box>
  );

  // 司法書士・相手側不動産情報セクション
  const JudicialScrivenerSection = () => (
    <Box sx={{ p: 2 }}>
      <EditableField label="司法書士" field="judicial_scrivener" />
      <EditableField label="司法書士連絡先" field="judicial_scrivener_contact" />
      <EditableField label="仲介業者" field="broker" />
      <EditableField label="仲介業者担当連絡先" field="broker_contact" />
    </Box>
  );

  const tabLabels = ['媒介契約', 'サイト登録', '契約決済', '司法書士、相手側不動産情報'];

  return (
    <>
      <Dialog
          open={open}
          onClose={onClose}
          fullScreen
          PaperProps={{ sx: { display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
        >
        <DialogTitle sx={{ p: 1, pb: 0 }}>
          {/* 1行目: ナビゲーションバー */}
          <Box sx={{ mb: 0.5 }}>
            <PageNavigation onNavigate={handleNavigate} />
          </Box>
          {/* 2行目: 既存のヘッダー */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, overflow: 'hidden' }}>
              <Button
                variant="contained"
                size="small"
                onClick={onClose}
                sx={{ bgcolor: '#8e24aa', '&:hover': { bgcolor: '#6a1b9a' }, fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                業務一覧
              </Button>
              <Typography variant="h6">業務詳細 -</Typography>
              <Box
                onClick={() => { navigator.clipboard.writeText(propertyNumber || ''); }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  px: 1.5, py: 0.5,
                  bgcolor: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: 1,
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  userSelect: 'all',
                  whiteSpace: 'nowrap',
                  '&:hover': { bgcolor: '#e3f2fd', borderColor: '#1565c0' },
                  '&:active': { bgcolor: '#bbdefb' },
                }}
                title="クリックでコピー"
              >
                {propertyNumber || ''}
                <ContentCopyIcon sx={{ fontSize: '1rem', color: '#1565c0', opacity: 0.7 }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflowX: 'auto', flexShrink: 1, flexWrap: 'nowrap' }}>
                {data?.property_address && (
                  <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#e3f2fd', borderRadius: '6px', px: 1.2, py: 0.4, border: '1px solid #90caf9', whiteSpace: 'nowrap' }}>
                    <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#1565c0', mr: 0.5 }}>物件住所</Typography>
                    <Typography component="span" sx={{ fontSize: '0.85rem', color: '#1a237e', fontWeight: 500 }}>{data.property_address}</Typography>
                  </Box>
                )}
                {data?.property_type && (
                  <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f3e5f5', borderRadius: '6px', px: 1.2, py: 0.4, border: '1px solid #ce93d8', whiteSpace: 'nowrap' }}>
                    <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#6a1b9a', mr: 0.5 }}>種別</Typography>
                    <Typography component="span" sx={{ fontSize: '0.85rem', color: '#4a148c', fontWeight: 500 }}>{data.property_type}</Typography>
                  </Box>
                )}
                {data?.seller_name && (
                  <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#e8f5e9', borderRadius: '6px', px: 1.2, py: 0.4, border: '1px solid #a5d6a7', whiteSpace: 'nowrap' }}>
                    <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#2e7d32', mr: 0.5 }}>売主氏名</Typography>
                    <Typography component="span" sx={{ fontSize: '0.85rem', color: '#1b5e20', fontWeight: 500 }}>{data.seller_name}</Typography>
                  </Box>
                )}
                {data?.sales_assignee && (
                  <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#fff8e1', borderRadius: '6px', px: 1.2, py: 0.4, border: '1px solid #ffe082', whiteSpace: 'nowrap' }}>
                    <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#e65100', mr: 0.5 }}>担当名</Typography>
                    <Typography component="span" sx={{ fontSize: '0.85rem', color: '#bf360c', fontWeight: 500 }}>{data.sales_assignee}</Typography>
                  </Box>
                )}
                {data?.mediation_type && (
                  <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#fce4ec', borderRadius: '6px', px: 1.2, py: 0.4, border: '1px solid #f48fb1', whiteSpace: 'nowrap' }}>
                    <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#880e4f', mr: 0.5 }}>媒介</Typography>
                    <Typography component="span" sx={{ fontSize: '0.85rem', color: '#560027', fontWeight: 500 }}>{data.mediation_type}</Typography>
                  </Box>
                )}
              </Box>
            </Box>
            <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': { minWidth: 120, px: 2, fontWeight: 600, borderRadius: '4px 4px 0 0', mr: 0.5, color: 'rgba(255,255,255,0.6)', opacity: 1 },
              '& .MuiTab-root:nth-of-type(1)': { bgcolor: '#2e7d32' },
              '& .MuiTab-root:nth-of-type(2)': { bgcolor: '#1565c0' },
              '& .MuiTab-root:nth-of-type(3)': { bgcolor: '#e65100' },
              '& .MuiTab-root:nth-of-type(4)': { bgcolor: '#6a1b9a' },
              '& .Mui-selected': {
                color: '#fff !important',
                fontWeight: 800,
                fontSize: '1rem',
                boxShadow: 'inset 0 -4px 0 rgba(255,255,255,0.8)',
                filter: 'brightness(1.25)',
              },
              '& .MuiTabs-indicator': { display: 'none' },
            }}
          >
            {tabLabels.map((label, index) => (<Tab key={index} label={label} />))}
          </Tabs>
        </Box>
        <DialogContent sx={{ p: 0, flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress />
            </Box>
          ) : !data ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <Typography color="text.secondary">データが見つかりません</Typography>
            </Box>
          ) : (
            <>
              {tabIndex === 0 && <MediationSection />}
              {tabIndex === 1 && <SiteRegistrationSection cwCounts={cwCounts} leftPaneRef={leftPaneRef} rightPaneRef={rightPaneRef} />}
              {tabIndex === 2 && <ContractSettlementSection />}
              {tabIndex === 3 && <JudicialScrivenerSection />}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">閉じる</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={!hasChanges || saving}
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            sx={hasChanges ? {
              animation: 'pulse-save 1s ease-in-out infinite',
              '@keyframes pulse-save': {
                '0%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.7)' },
                '70%': { boxShadow: '0 0 0 10px rgba(25, 118, 210, 0)' },
                '100%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0)' },
              },
            } : {}}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
      <DeadlineWarningDialog
        open={warningDialog.open}
        fieldLabel={warningDialog.fieldLabel}
        onClose={() => setWarningDialog({ open: false, fieldLabel: '' })}
      />
      <RowAddWarningDialog
        open={rowAddWarningDialog.open}
        onConfirm={() => { setRowAddWarningDialog({ open: false }); executeSave(); }}
        onCancel={() => setRowAddWarningDialog({ open: false })}
      />
      <ValidationWarningDialog
        open={validationWarningDialog.open}
        title={validationWarningDialog.title}
        emptyFields={validationWarningDialog.emptyFields}
        onConfirm={handleValidationWarningConfirm}
        onCancel={handleValidationWarningCancel}
      />
    </>
  );
}
