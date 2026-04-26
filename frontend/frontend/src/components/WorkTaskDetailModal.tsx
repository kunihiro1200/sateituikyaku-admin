import React, { useState, useEffect, useRef } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Close as CloseIcon, Save as SaveIcon, ContentCopy as ContentCopyIcon, Check as CheckIcon, WarningAmber as WarningAmberIcon, Email as EmailIcon, Image as ImageIcon } from '@mui/icons-material';
import api from '../services/api';
import { supabase } from '../services/supabase';
import { isDeadlineExceeded } from '../utils/deadlineUtils';
import { buildLedgerSheetUrl, buildSheetUrl, MEDIATION_REQUEST_SHEET_GID, ATHOME_SHEET_GID } from '../utils/spreadsheetUrl';
import { normalizePhoneNumber } from '../utils/phoneNormalizer';
import { getActiveEmployees, Employee } from '../services/employeeService';
import { getSenderAddress, saveSenderAddress, validateSenderAddress } from '../utils/senderAddressStorage';
import SenderAddressSelector from './SenderAddressSelector';
import RichTextEmailEditor from './RichTextEmailEditor';
import ImageSelectorModal from './ImageSelectorModal';
import { useAuthStore } from '../store/authStore';



interface WorkTaskDetailModalProps {
  open: boolean;
  onClose: () => void;
  propertyNumber: string | null;
  onUpdate?: () => void;
  initialData?: Partial<WorkTaskData> | null;
  initialTabIndex?: number;
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
  mediation_checker: string;
  mediation_revision: string;
  mediation_revision_content: string;
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
  site_registration_revision: string;
  site_registration_revision_content: string;
  floor_plan_revision_correction: string;
  floor_plan_revision_correction_content: string;
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
  contract_revision_exists: string;
  contract_revision_content: string;
  mediation_revision_countermeasure: string;
  site_registration_revision_countermeasure: string;
  floor_plan_revision_countermeasure: string;
  contract_revision_countermeasure: string;
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
  athome_pre_visit_notice_hidden_confirmed: string;
  manager_confirmation_done: string;
  contract_to_settlement_admin_staff: string;
  contract_to_settlement_admin_approver: string;
  contract_to_settlement_admin_person: string;
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

// 媒介契約フォーマット警告ダイアログ
const MediationFormatWarningDialog = ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) => {
  const url = 'https://docs.google.com/spreadsheets/d/1PyMxyCHitJJyWH2dh3z6o7Wr6dTD_XPfd3Y9jJD9UEw/edit?usp=sharing';
  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon sx={{ color: 'warning.main' }} />
        <Typography component="span" sx={{ fontWeight: 700 }}>フォーマット警告</Typography>
      </DialogTitle>
      <DialogContent>
        <Typography>
          「媒介作成」シートの1行目が古い形式になっているので{' '}
          <Link href={url} target="_blank" rel="noopener">{url}</Link>
          {' '}に従って変更してください
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onConfirm} color="primary" variant="contained">OK</Button>
      </DialogActions>
    </Dialog>
  );
};

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


// 地積測量図・字図 未格納警告ダイアログ
const CadastralMapWarningDialog = ({ open, onCancel }: { open: boolean; onCancel: () => void }) => (
  <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth
    PaperProps={{ sx: { border: '4px solid #d32f2f', borderRadius: 2, boxShadow: '0 0 40px rgba(211,47,47,0.6)' } }}
  >
    <DialogTitle sx={{ bgcolor: '#d32f2f', color: '#fff', display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
      <WarningAmberIcon sx={{ fontSize: '2rem', color: '#ffeb3b' }} />
      <Typography component="span" sx={{ fontWeight: 700, fontSize: '1.15rem' }}>
        ⚠️ 地積測量図・字図が未格納です！
      </Typography>
    </DialogTitle>
    <DialogContent sx={{ pt: 3, pb: 2, bgcolor: '#fff8f8' }}>
      <Typography sx={{
        fontWeight: 700,
        fontSize: '1.3rem',
        color: '#b71c1c',
        textAlign: 'center',
        lineHeight: 1.7,
        mb: 2,
      }}>
        🚨 地積測量図、字図が格納されていません！
        <br />
        「未」のままです。
      </Typography>
      <Box sx={{
        bgcolor: '#ffebee',
        border: '2px solid #ef9a9a',
        borderRadius: 2,
        px: 3,
        py: 2,
      }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#c62828', lineHeight: 1.8 }}>
          格納後、スプシの「athome」シートの
          <br />
          「内覧前伝達事項の●●」を書き換えて、
          <br />
          物件シートの1行を差し替えてください。
        </Typography>
      </Box>
    </DialogContent>
    <DialogActions sx={{ bgcolor: '#fff8f8', pb: 2, px: 3 }}>
      <Button onClick={onCancel} color="error" variant="contained" fullWidth sx={{ fontWeight: 700, fontSize: '1rem', py: 1 }}>
        閉じる
      </Button>
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

const ValidationWarningDialog = ({ open, title, emptyFields, onConfirm, onCancel, isMandatory }: ValidationWarningDialogProps & { isMandatory?: boolean }) => (
  <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: isMandatory ? '#d32f2f' : undefined, color: isMandatory ? '#fff' : undefined }}>
      <WarningAmberIcon sx={{ color: isMandatory ? '#ffeb3b' : 'warning.main' }} />
      <Typography component="span" sx={{ fontWeight: 700, color: isMandatory ? '#fff' : undefined }}>{title}</Typography>
    </DialogTitle>
    <DialogContent sx={{ pt: 2 }}>
      {isMandatory && (
        <Typography sx={{ fontWeight: 700, color: '#d32f2f', mb: 1.5 }}>
          🚫 以下の必須項目を入力するまで保存できません：
        </Typography>
      )}
      {!isMandatory && (
        <Typography sx={{ fontWeight: 700, mb: 1 }}>以下のフィールドが未入力です：</Typography>
      )}
      {emptyFields.map((field) => (
        <Typography key={field} sx={{ color: isMandatory ? '#d32f2f' : undefined, fontWeight: isMandatory ? 600 : undefined }}>・未入力：{field}</Typography>
      ))}
    </DialogContent>
    <DialogActions>
      {isMandatory ? (
        <Button onClick={onCancel} color="error" variant="contained" fullWidth>閉じて入力する</Button>
      ) : (
        <>
          <Button onClick={onCancel} color="error" variant="outlined">キャンセル</Button>
          <Button onClick={onConfirm} color="primary" variant="contained">このまま保存する</Button>
        </>
      )}
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
  site_registration_confirmer: 'サイト登録確認者',
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
// 完了時はsite_registration_confirmerとsite_registration_ok_sentも必須
function checkSiteRegistrationWarning(getValue: (field: string) => any): {
  hasWarning: boolean;
  emptyFields: string[];
} {
  const confirmed = getValue('site_registration_confirmed');
  const okSent = getValue('site_registration_ok_sent');
  const confirmedEmpty = isEmpty(confirmed);
  const okSentEmpty = isEmpty(okSent);

  // 完了時：確認者とOK送信が必須
  if (confirmed === '完了') {
    const confirmerEmpty = isEmpty(getValue('site_registration_confirmer'));
    const emptyFields: string[] = [];
    if (confirmerEmpty) emptyFields.push(SITE_REGISTRATION_FIELD_LABELS['site_registration_confirmer']);
    if (okSentEmpty) emptyFields.push(SITE_REGISTRATION_FIELD_LABELS['site_registration_ok_sent']);
    return { hasWarning: emptyFields.length > 0, emptyFields };
  }

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
// 確認者に値がある場合：OK送信・完了日・格納済み連絡メールが必須
// 確認者が空の場合：一部入力・一部空欄の場合に警告（全て空欄または全て入力済みは正常）
function checkFloorPlanWarning(getValue: (field: string) => any): {
  hasWarning: boolean;
  emptyFields: string[];
} {
  const confirmer = getValue('floor_plan_confirmer');

  // 確認者に値がある場合：残り3つが必須
  if (!isEmpty(confirmer)) {
    const requiredFields: Record<string, string> = {
      floor_plan_ok_sent: FLOOR_PLAN_FIELD_LABELS['floor_plan_ok_sent'],
      floor_plan_completed_date: FLOOR_PLAN_FIELD_LABELS['floor_plan_completed_date'],
      floor_plan_stored_email: FLOOR_PLAN_FIELD_LABELS['floor_plan_stored_email'],
    };
    const emptyFields: string[] = [];
    for (const [field, label] of Object.entries(requiredFields)) {
      if (isEmpty(getValue(field))) emptyFields.push(label);
    }
    return { hasWarning: emptyFields.length > 0, emptyFields };
  }

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

// 媒介契約フォーマット警告チェック
// property_address === '不要' かつ mediation_creator が空欄でない場合に true を返す
function checkMediationFormatWarning(getValue: (field: string) => any): boolean {
  const propertyAddress = getValue('property_address');
  const mediationCreator = getValue('mediation_creator');
  return propertyAddress === '不要' && !isEmpty(mediationCreator);
}

// ============================================================
// 必須修正フィールドのバリデーション（2026/4/24以降 保存時に必ず通過）
// 「今回の保存操作で親フィールドを新たに変更した場合のみ」チェックを適用する
// 既にDBに保存済みで今回触っていない親フィールドはチェックしない
// ============================================================
function checkMandatoryRevisionFields(
  getValue: (field: string) => any,
  editedData: Record<string, any>
): {
  hasError: boolean;
  errorFields: string[];
} {
  const errorFields: string[] = [];

  // 1. サイト登録修正（当社ミス）
  //    親フィールド: site_registration_ok_sent を今回変更した場合のみチェック
  if (editedData.hasOwnProperty('site_registration_ok_sent') && !isEmpty(getValue('site_registration_ok_sent'))) {
    if (isEmpty(getValue('site_registration_revision'))) {
      errorFields.push('サイト登録修正（当社ミス）');
    }
    // 「あり」の場合は修正内容も必須
    if (getValue('site_registration_revision') === 'あり' && isEmpty(getValue('site_registration_revision_content'))) {
      errorFields.push('サイト登録修正内容');
    }
  }

  // 2. 契約書、重説他　修正点
  //    親フィールド: sales_contract_confirmed を今回「確認OK」に変更した場合のみチェック
  if (editedData.hasOwnProperty('sales_contract_confirmed') && getValue('sales_contract_confirmed') === '確認OK') {
    if (isEmpty(getValue('contract_revision_exists'))) {
      errorFields.push('契約書、重説他　修正点');
    }
    // 「あり」の場合は修正内容も必須
    if (getValue('contract_revision_exists') === 'あり' && isEmpty(getValue('contract_revision_content'))) {
      errorFields.push('契約書、重説他の修正内容');
    }
    // 山本マネージャーに確認（済）が必須
    if (isEmpty(getValue('manager_confirmation_done'))) {
      errorFields.push('山本マネージャーの契約書チェック（済）');
    }
    // 契約～決済担当者が必須
    if (isEmpty(getValue('contract_to_settlement_admin_staff'))) {
      errorFields.push('契約～決済までに事務担当者');
    }
    // 「他」の場合は許可者も必須
    if (getValue('contract_to_settlement_admin_staff') === '他') {
      if (isEmpty(getValue('contract_to_settlement_admin_approver'))) {
        errorFields.push('契約～決済担当者：許可済み？（山本/国広）');
      }
    }
    // 担当者（全社員）が必須
    if (isEmpty(getValue('contract_to_settlement_admin_person'))) {
      errorFields.push('契約～決済担当者：担当者');
    }
  }
  //    親フィールド: mediation_checker を今回変更した場合のみチェック
  if (editedData.hasOwnProperty('mediation_checker') && !isEmpty(getValue('mediation_checker'))) {
    if (isEmpty(getValue('mediation_revision'))) {
      errorFields.push('媒介契約修正');
    }
  }

  // 4. 間取図修正（当社ミス）
  //    親フィールド: floor_plan_ok_sent を今回変更した場合のみチェック
  if (editedData.hasOwnProperty('floor_plan_ok_sent') && !isEmpty(getValue('floor_plan_ok_sent'))) {
    if (isEmpty(getValue('floor_plan_revision_correction'))) {
      errorFields.push('間取図修正（当社ミス）');
    }
    // 「あり」の場合は修正内容も必須
    if (getValue('floor_plan_revision_correction') === 'あり' && isEmpty(getValue('floor_plan_revision_correction_content'))) {
      errorFields.push('間取図修正内容');
    }
  }

  return { hasError: errorFields.length > 0, errorFields };
}

const ASSIGNEE_OPTIONS = ['K', 'Y', 'I', '生', 'U', 'R', '久', 'H'];

// サイト登録修正内容入力フィールド（再マウント防止のためモーダル外で定義）
const SiteRevisionContentField = React.memo(({ value, hasError, onCommit }: {
  value: string;
  hasError: boolean;
  onCommit: (v: string) => void;
}) => {
  const [localValue, setLocalValue] = React.useState(value);
  React.useEffect(() => { setLocalValue(value); }, [value]);
  return (
    <Box sx={{ mb: 1.5 }}>
      <Grid container spacing={2} alignItems="flex-start">
        <Grid item xs={4}>
          <Typography variant="body2" color={hasError ? 'error' : 'text.secondary'} sx={{ fontWeight: 500, mt: 0.5 }}>
            {hasError ? 'サイト登録修正内容*（必須）' : 'サイト登録修正内容'}
          </Typography>
        </Grid>
        <Grid item xs={8}>
          <TextField
            size="small"
            multiline
            minRows={3}
            maxRows={8}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => onCommit(localValue)}
            fullWidth
            error={hasError}
          />
        </Grid>
      </Grid>
    </Box>
  );
});

// 間取図修正内容入力フィールド（再マウント防止のためモーダル外で定義）
const FloorPlanRevisionContentField = React.memo(({ value, hasError, onCommit }: {
  value: string;
  hasError: boolean;
  onCommit: (v: string) => void;
}) => {
  const [localValue, setLocalValue] = React.useState(value);
  React.useEffect(() => { setLocalValue(value); }, [value]);
  return (
    <Box sx={{ mb: 1.5 }}>
      <Grid container spacing={2} alignItems="flex-start">
        <Grid item xs={4}>
          <Typography variant="body2" color={hasError ? 'error' : 'text.secondary'} sx={{ fontWeight: 500, mt: 0.5 }}>
            {hasError ? '間取図修正内容*（必須）' : '間取図修正内容'}
          </Typography>
        </Grid>
        <Grid item xs={8}>
          <TextField
            size="small"
            multiline
            minRows={3}
            maxRows={8}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => onCommit(localValue)}
            fullWidth
            error={hasError}
          />
        </Grid>
      </Grid>
    </Box>
  );
});

// 対策案インライン編集セル（修正内容まとめテーブル用）
// フォーカスが外れたときに直接APIで保存する
const CountermeasureCell = React.memo(({ propertyNumber, field, value, onSaved }: {
  propertyNumber: string;
  field: string;
  value: string;
  onSaved: (val: string) => void;
}) => {
  const [localValue, setLocalValue] = React.useState(value);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { setLocalValue(value); }, [value]);

  const handleBlur = async () => {
    if (localValue === value) return;
    setSaving(true);
    try {
      await api.put(`/api/work-tasks/${propertyNumber}`, { [field]: localValue || null });
      onSaved(localValue);
    } catch {
      setLocalValue(value); // 失敗時は元に戻す
    } finally {
      setSaving(false);
    }
  };

  return (
    <TextField
      size="small"
      multiline
      minRows={3}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      fullWidth
      placeholder="対策案（イニシャルと日付）を入力..."
      disabled={saving}
      sx={{ fontSize: '0.8rem', '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
    />
  );
});

export default function WorkTaskDetailModal({ open, onClose, propertyNumber, onUpdate, initialData, initialTabIndex }: WorkTaskDetailModalProps) {
  const [tabIndex, setTabIndex] = useState(0);
  const navigate = useNavigate();
  const normalInitials = useNormalInitials();
  const cwCounts = useCwCounts();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(false);
  const [isSales, setIsSales] = useState(false);
  const { employee } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [copiedPropertyNumber, setCopiedPropertyNumber] = useState(false);
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
  const [athomePreVisitCheckRequired, setAthomePreVisitCheckRequired] = useState<boolean>(false);
  const [athomePreVisitDialog, setAthomePreVisitDialog] = useState<boolean>(false);
  const [mediationFormatWarningDialog, setMediationFormatWarningDialog] = useState<{ open: boolean }>({ open: false });
  const [validationWarningDialog, setValidationWarningDialog] = useState<{
    open: boolean;
    title: string;
    emptyFields: string[];
    onConfirmAction: 'site' | 'floor' | 'mandatory' | 'cadastral' | 'binding_completed' | 'sales_assignee' | null;
  }>({ open: false, title: '', emptyFields: [], onConfirmAction: null });

  // ログインユーザーの営業フラグを取得
  useEffect(() => {
    if (open && employee) {
      api.get('/api/employees/is-sales')
        .then(res => setIsSales(res.data.isSales === true))
        .catch(() => setIsSales(false));
    }
  }, [open, employee]);

  // モーダルが開くたびに initialTabIndex でタブをリセット
  useEffect(() => {
    if (open) {
      setTabIndex(initialTabIndex ?? 0);
    }
  }, [open, initialTabIndex]);

  // 売買価格から通常仲介手数料を計算するヘルパー
  const calcStandardBrokerageFeeFromPrice = (salesPrice: number | null | undefined): number => {
    if (!salesPrice || salesPrice <= 0) return 330000;
    return salesPrice >= 8000000
      ? Math.round((salesPrice * 0.03 + 60000) * 1.1)
      : 330000;
  };

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

  // データロード後、通常仲介手数料を売買価格から自動計算してeditedDataに反映
  useEffect(() => {
    if (!data) return;
    const salesPrice = data.sales_price ? Number(data.sales_price) : null;
    const calcFee = calcStandardBrokerageFeeFromPrice(salesPrice);
    const dbFeeSeller = data.standard_brokerage_fee_seller != null ? Math.round(Number(data.standard_brokerage_fee_seller)) : null;
    const dbFeeBuyer = data.standard_brokerage_fee_buyer != null ? Math.round(Number(data.standard_brokerage_fee_buyer)) : null;
    const updates: Partial<WorkTaskData> = {};
    if (dbFeeSeller !== calcFee) updates.standard_brokerage_fee_seller = calcFee;
    if (dbFeeBuyer !== calcFee) updates.standard_brokerage_fee_buyer = calcFee;
    if (Object.keys(updates).length > 0) {
      setEditedData(prev => ({ ...prev, ...updates }));
    }
  }, [data]);

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
      // 電話番号フィールドの先頭「0」補完
      const normalizedData = {
        ...editedData,
        ...(editedData.seller_contact_tel !== undefined && {
          seller_contact_tel: normalizePhoneNumber(editedData.seller_contact_tel) ?? null,
        }),
        ...(editedData.buyer_contact_tel !== undefined && {
          buyer_contact_tel: normalizePhoneNumber(editedData.buyer_contact_tel) ?? null,
        }),
      };
      await api.put(`/api/work-tasks/${propertyNumber}`, normalizedData);
      setSnackbar({ open: true, message: '保存しました', severity: 'success' });
      await fetchData(true);
      setEditedData({});
      onUpdate?.();
      // 修正履歴を再取得（保存後に表を更新）
      fetchRevisionHistories();
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

    // 物件一覧に行追加「追加済」かつ営業担当が空欄の場合はブロック
    if (rowAdded === '追加済' && !getValue('sales_assignee')) {
      setValidationWarningDialog({
        open: true,
        title: '「媒介契約」タブの"営業担当"が空欄です。必ず入力してください！',
        emptyFields: ['そのあと、必ず物件リスト（スプシ）のA列に担当名を入力してください！'],
        onConfirmAction: 'sales_assignee',
      });
      return;
    }

    // 物件一覧に行追加「追加済」かつ地積測量図・字図が「未」の場合、athome確認チェックを必須化
    if (rowAdded === '追加済') {
      const cadastralField = getValue('cadastral_map_field');
      const cadastralUrl = getValue('cadastral_map_url');
      if (cadastralField === '未' || cadastralUrl === '未') {
        const confirmed = getValue('athome_pre_visit_notice_hidden_confirmed');
        if (confirmed !== 'はい') {
          setAthomePreVisitCheckRequired(true);
          setAthomePreVisitDialog(true);
          return;
        }
      }
    }

    // 媒介契約フォーマット警告チェック
    if (checkMediationFormatWarning(getValue)) {
      setMediationFormatWarningDialog({ open: true });
      return;
    }

    // 製本完了チェック: 製本完了に値があり、売買契約確認が「確認OK」でなく、売買契約締め日が2025-04-25以降の場合はブロック
    const bindingCompleted = getValue('binding_completed');
    const salesContractConfirmed = getValue('sales_contract_confirmed');
    const salesContractDeadline = getValue('sales_contract_deadline');
    if (
      bindingCompleted &&
      salesContractConfirmed !== '確認OK' &&
      salesContractDeadline &&
      salesContractDeadline >= '2025-04-25'
    ) {
      setValidationWarningDialog({
        open: true,
        title: '「売買契約確認」が「確認OK」になっていないため保存できません',
        emptyFields: ['売買契約確認を「確認OK」にしてから保存してください'],
        onConfirmAction: 'binding_completed',
      });
      return;
    }

    // 必須修正フィールドチェック（2026/4/24以降 保存を完全ブロック）
    const mandatoryResult = checkMandatoryRevisionFields(getValue, editedData);
    if (mandatoryResult.hasError) {
      setValidationWarningDialog({
        open: true,
        title: '必須項目が未入力のため保存できません',
        emptyFields: mandatoryResult.errorFields,
        onConfirmAction: 'mandatory',
      });
      return;
    }

    // 地積測量図・字図 未格納チェック
    // site_registration_ok_sent に値が入っていて、かつ cadastral_map_field === '未' または cadastral_map_url === '未' の場合に警告
    if (!isEmpty(getValue('site_registration_ok_sent'))) {
      const cadastralField = getValue('cadastral_map_field');
      const cadastralUrl = getValue('cadastral_map_url');
      if (cadastralField === '未' || cadastralUrl === '未') {
        setValidationWarningDialog({
          open: true,
          title: '地積測量図・字図が未格納です',
          emptyFields: [],
          onConfirmAction: 'cadastral',
        });
        return;
      }
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

    if (action === 'cadastral') {
      // 地積測量図警告をスキップして要件1チェックへ
      const getValueLocal = (field: string) => editedData[field] !== undefined ? editedData[field] : data?.[field];
      const siteResult2 = checkSiteRegistrationWarning(getValueLocal);
      if (siteResult2.hasWarning) {
        setValidationWarningDialog({
          open: true,
          title: 'サイト登録確認関連フィールドに未入力項目があります',
          emptyFields: siteResult2.emptyFields,
          onConfirmAction: 'site',
        });
        return;
      }
      const floorResult2 = checkFloorPlanWarning(getValueLocal);
      if (floorResult2.hasWarning) {
        setValidationWarningDialog({
          open: true,
          title: '間取図関連フィールドに未入力項目があります',
          emptyFields: floorResult2.emptyFields,
          onConfirmAction: 'floor',
        });
        return;
      }
    }

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
    const action = validationWarningDialog.onConfirmAction;
    setValidationWarningDialog(prev => ({ ...prev, open: false }));

    // 営業担当空欄エラーの場合、媒介契約タブ（tabIndex=0）に切り替えてスクロール
    if (action === 'sales_assignee') {
      setTabIndex(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (salesAssigneeRef.current) {
            salesAssigneeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else if (mediationPaneRef.current) {
            mediationPaneRef.current.scrollTop = 0;
          }
        });
      });
    }

    // 製本完了チェックエラーの場合、売買契約確認フィールドまでスクロール
    if (action === 'binding_completed') {
      // 契約決済タブ（tabIndex=2）に切り替えてからスクロール
      setTabIndex(2);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (salesContractConfirmedRef.current) {
            salesContractConfirmedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else if (contractLeftPaneRef.current) {
            contractLeftPaneRef.current.scrollTop = 0;
          }
        });
      });
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    // 左右ペインのスクロール位置を保存
    leftScrollRef.current = leftPaneRef.current?.scrollTop ?? 0;
    rightScrollRef.current = rightPaneRef.current?.scrollTop ?? 0;
    sellerBuyerRightScrollRef.current = sellerBuyerRightPaneRef.current?.scrollTop ?? 0;
    contractLeftScrollRef.current = contractLeftPaneRef.current?.scrollTop ?? 0;
    contractRightScrollRef.current = contractRightPaneRef.current?.scrollTop ?? 0;
    // 売買価格変更時に通常仲介手数料を自動計算
    // IF(売買価格 >= 800万, (売買価格 * 0.03 + 60000) * 1.1, 330000)

    // 決済完了チャットに値が入ったら経理確認済みを「未」に自動リセット
    if (field === 'settlement_completed_chat' && value) {
      setEditedData(prev => ({ ...prev, [field]: value, accounting_confirmed: '未' }));
    } else if (field === 'sales_price') {
      // 売買価格変更時は通常仲介手数料（売）・（買）を自動計算
      const fee = calcStandardBrokerageFeeFromPrice(value ? Number(value) : null);
      setEditedData(prev => ({
        ...prev,
        [field]: value,
        standard_brokerage_fee_seller: fee,
        standard_brokerage_fee_buyer: fee,
      }));
    } else {
      setEditedData(prev => ({ ...prev, [field]: value }));
    }

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
    const raw = editedData[field] !== undefined ? editedData[field] : data?.[field];
    if (field === 'seller_contact_tel' || field === 'buyer_contact_tel') {
      return normalizePhoneNumber(raw) ?? raw;
    }
    return raw;
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  // ===== Email送信機能 =====
  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const [senderAddress, setSenderAddress] = useState<string>('tenant@ifoo-oita.com');
  const [emailDialog, setEmailDialog] = useState<{
    open: boolean;
    type: 'seller' | 'buyer' | 'judicial_scrivener' | null;
    templateId: string | null;
    templateLabel: string;
  }>({ open: false, type: null, templateId: null, templateLabel: '' });
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [templateSelectType, setTemplateSelectType] = useState<'seller' | 'buyer' | 'judicial_scrivener' | null>(null);
  const [emailHistoryRefreshKey, setEmailHistoryRefreshKey] = useState(0);
  // Email送信履歴（SellerBuyerDetailSectionから引き上げ）
  const [emailHistory, setEmailHistory] = useState<Array<{
    id: number;
    sentAt: string;
    subject: string;
    body: string;
    templateName: string;
    recipientEmail: string;
    senderEmail: string;
    senderName: string;
    senderInitials: string;
  }>>([]);
  const [emailHistoryLoading, setEmailHistoryLoading] = useState(false);
  const [selectedEmailRecord, setSelectedEmailRecord] = useState<{
    id: number;
    sentAt: string;
    subject: string;
    body: string;
    templateName: string;
    recipientEmail: string;
    senderEmail: string;
    senderName: string;
    senderInitials: string;
  } | null>(null);

  // 売主向けEmailテンプレート
  const SELLER_EMAIL_TEMPLATES = [
    {
      id: 'settlement_seller_unmanned',
      name: '金種表（売主様）無人決済',
      subject: '｛物件住所｝のご決済の件',
      body: `｛売主氏名｝様<br><br>いつもお世話になっております。<br>決済日は｛決済日｝になりましたので、よろしくお願いいたします。<br>金種表等を添付いたしましたので、お手数ですが、決済日までに内容のご確認をお願いいたします。<br>また領収書を添付しておりますのでご参考ください。<br>仲介手数料や司法書士へのお支払い分は、決済日の14時までに必ずご入金をいただくよう、お願い致します。<br>何かございましたら、お知らせください。<br>何卒よろしくお願いいたします。<br><br>【添付資料】<br>・固定資産税清算書<br>・金種表<br>・売主様に決済日にお支払いいただく金種表<br>・買主様より決済日に振り込まれる分の金種表<br><br>【決済日の流れ】<br>①｛買主氏名｝様より｛売主氏名｝様へ売買代金を入金後は、｛買主氏名｝様より司法書士事務所へご連絡していただきます。<br>②司法書士事務所より、｛売主氏名｝様へ売買代金の振込をしたことをご連絡致します。<br><strong>③｛売主氏名｝様は　着金の確認をしていただき、確認後、司法書士事務所へご連絡していただきます。<br>｛売主氏名｝様は　14時までに　司法書士への手数料（あれば）と不動産仲介手数料をお支払いしていただきます。</strong><br>④司法書士事務所が｛売主氏名｝様より着金確認のご連絡をうけたら、｛売主氏名｝様からの不動産仲介手数料の振込、司法書士への手数料（あれば）を確認後、所有権移転の手続きにはいります。<br>⑤司法書士事務所より不動産会社（当社）へご連絡いただき、当社で仲介手数料や売買代金の領収書の発行手続きにはいり、｛売主氏名｝様の代理で｛買主氏名｝様へ売買代金の領収書、固定資産税精算の領収書を発行致します。<br>不動産仲介手数料は｛売主氏名｝様宛てに発行して郵送手配させていただきます。<br><br>以上が　決済日の流れになります。<br>｛売主氏名｝様の主なアクションとしては③になりますので、よろしくお願い申し上げます。<br>ご不明点等ございましたらいつでもご連絡頂ければと思います。<br><br>***************************<br>株式会社 いふう<br>〒870-0044<br>大分市舞鶴町1丁目3-30<br>TEL：097-533-2022<br>FAX：097-529-7160<br>HP：https://ifoo-oita.com/<br>店休日：毎週水曜日　年末年始、GW、盆<br>***************************`,
      isHtml: true,
    },
    {
      id: 'settlement_seller_manned',
      name: '金種表（売主様）有人決済',
      subject: '｛物件住所｝のご決済の件',
      body: `｛売主氏名｝様<br><br>いつもお世話になっております。<br>決済日は｛決済日｝になりましたので、よろしくお願いいたします。<br>金種表等を添付いたしましたので、お手数ですが、決済日までに内容のご確認をお願いいたします。<br>仲介手数料や司法書士へのお支払い分（あれば）は、決済日の14時までに必ずご入金をいただくよう、お願い致します。<br>何かございましたら、お知らせください。<br>何卒よろしくお願いいたします。<br><br>【添付資料】<br>・固定資産税清算書<br>・金種表<br>・売主様に決済日にお支払いいただく金種表<br>・買主様より決済日に振り込まれる分の金種表<br>・決済連絡書<br><br>ご不明点等ございましたらいつでもご連絡頂ければと思います。<br><br>***************************<br>株式会社 いふう<br>〒870-0044<br>大分市舞鶴町1丁目3-30<br>TEL：097-533-2022<br>FAX：097-529-7160<br>HP：https://ifoo-oita.com/<br>店休日：毎週水曜日　年末年始、GW、盆<br>***************************`,
      isHtml: true,
    },
  ];

  // 買主向けEmailテンプレート
  const BUYER_EMAIL_TEMPLATES = [
    {
      id: 'settlement_buyer_unmanned',
      name: '金種表（買主様）無人決済',
      subject: '｛物件住所｝のご決済の件',
      body: `｛買主氏名｝様<br><br>いつもお世話になっております。<br>決済日は｛決済日｝になりましたので、よろしくお願いいたします。<br>金種表等を添付いたしましたので、お手数ですが、決済日までに内容のご確認をお願いいたします。<br>また領収書を添付しておりますのでご参考ください。<br>仲介手数料や司法書士へのお支払い分は、決済日の14時までに必ずご入金をいただくよう、お願い致します。<br>何かございましたら、お知らせください。<br>何卒よろしくお願いいたします。<br><br>【添付資料】<br>・固定資産税清算書<br>・金種表<br>・買主様より決済日にお支払いいただく分の金種表<br><br>【決済日の流れ】<br><strong>①｛買主氏名｝様より｛売主氏名｝様へ売買代金を入金後は、｛買主氏名｝様より司法書士事務所へご連絡していただきます。</strong><br>②司法書士事務所より、｛売主氏名｝様へ売買代金の振込をしたことをご連絡致します。<br>③｛売主氏名｝様は　着金の確認をしていただき、確認後、司法書士事務所へご連絡していただきます。<br>④司法書士事務所が｛売主氏名｝様より着金確認のご連絡をうけたら、所有権移転の手続きにはいります。<br>⑤司法書士事務所より不動産会社（当社）へご連絡いただき、当社で仲介手数料や売買代金の領収書の発行手続きにはいり、｛買主氏名｝様へ売買代金の領収書、固定資産税精算の領収書を発行致します。<br>不動産仲介手数料は｛買主氏名｝様宛てに発行して郵送手配させていただきます。<br><br>以上が　決済日の流れになります。<br>｛買主氏名｝様の主なアクションとしては①になりますので、よろしくお願い申し上げます。<br>ご不明点等ございましたらいつでもご連絡頂ければと思います。<br><br>***************************<br>株式会社 いふう<br>〒870-0044<br>大分市舞鶴町1丁目3-30<br>TEL：097-533-2022<br>FAX：097-529-7160<br>HP：https://ifoo-oita.com/<br>店休日：毎週水曜日　年末年始、GW、盆<br>***************************`,
      isHtml: true,
    },
    {
      id: 'settlement_buyer_manned',
      name: '金種表（買主様）有人決済',
      subject: '｛物件住所｝のご決済の件',
      body: `｛買主氏名｝様<br><br>いつもお世話になっております。<br>決済日は｛決済日｝になりましたので、よろしくお願いいたします。<br>金種表等を添付いたしましたので、お手数ですが、決済日までに内容のご確認をお願いいたします。<br>また領収書を添付しておりますのでご参考ください。<br>何かございましたら、お知らせください。<br>何卒よろしくお願いいたします。<br><br>【添付資料】<br>・固定資産税清算書<br>・金種表<br>・買主様より決済日にお支払いいただく分の金種表<br>・決済連絡書<br><br>ご不明点等ございましたらいつでもご連絡頂ければと思います。<br><br>***************************<br>株式会社 いふう<br>〒870-0044<br>大分市舞鶴町1丁目3-30<br>TEL：097-533-2022<br>FAX：097-529-7160<br>HP：https://ifoo-oita.com/<br>店休日：毎週水曜日　年末年始、GW、盆<br>***************************`,
      isHtml: true,
    },
  ];


  // 司法書士向けEmailテンプレート
  const JUDICIAL_SCRIVENER_EMAIL_TEMPLATES = [
    {
      id: 'judicial_riseacross',
      name: '司法書士法人中央ライズアクロスへメール',
      subject: '｛物件住所｝の契約が終わりました',
      body: `ご担当者様<br><br>お世話になっております。<br>株式会社いふうです。<br>先ほど売主様、買主様の売買契約が完了いたしました。<br><br>【添付資料】<br>・契約書、重説<br>・契約書（署名押印欄）<br>・謄本<br>・固定資産税公課証明<br><br>【売主様】<br>名前：｛売主名前｝　様<br>電話番号：｛売主TEL｝<br>メールアドレス：｛売主メアド｝<br>抵当権等は　謄本をご参考ください<br><br>【買主様】<br>名前：｛買主名前｝　様<br>電話番号：｛買主TEL｝<br>メールアドレス：｛買主メアド｝<br>融資：｛ローン｝<br>金融機関：｛金融機関名｝<br>引渡予定：｛引き渡し予定｝までとなっております。<br><br>御社より連絡がある旨伝えておりますのでよろしくお願いいたします。<br>費用がわかりましたらお見積りを頂ければと思います。<br>決済日が分かりましたら、金種表をお作りしますので教えて頂ければと思います。<br><br>***************************<br>株式会社 いふう<br>〒870-0044<br>大分市舞鶴町1丁目3-30<br>TEL：097-533-2022<br>FAX：097-529-7160<br>MAIL：tenant@ifoo-oita.com<br>HP：https://ifoo-oita.com/<br>店休日：毎週水曜日　年末年始、GW、盆<br>***************************`,
      isHtml: true,
      fixedRecipient: 'naruse@riseacross.com',
    },
    {
      id: 'judicial_other',
      name: '他の司法書士へメール',
      subject: '｛物件住所｝の契約が終わりました',
      body: `ご担当者様<br><br>お世話になっております。<br>株式会社いふうです。<br>先ほど売主様、買主様の売買契約が完了いたしました。<br><br>【添付資料】<br>・契約書、重説<br>・契約書（署名押印欄）<br>・謄本<br>・固定資産税公課証明<br><br>【売主様】<br>名前：｛売主名前｝　様<br>電話番号：｛売主TEL｝<br>メールアドレス：｛売主メアド｝<br>抵当権等は　謄本をご参考ください<br><br>【買主様】<br>名前：｛買主名前｝　様<br>電話番号：｛買主TEL｝<br>メールアドレス：｛買主メアド｝<br>融資：｛ローン｝<br>金融機関：｛金融機関名｝<br>引渡予定：｛引き渡し予定｝までとなっております。<br><br>御社より連絡がある旨伝えておりますのでよろしくお願いいたします。<br>費用がわかりましたらお見積りを頂ければと思います。<br>決済日が分かりましたら、金種表をお作りしますので教えて頂ければと思います。<br><br>***************************<br>株式会社 いふう<br>〒870-0044<br>大分市舞鶴町1丁目3-30<br>TEL：097-533-2022<br>FAX：097-529-7160<br>MAIL：tenant@ifoo-oita.com<br>HP：https://ifoo-oita.com/<br>店休日：毎週水曜日　年末年始、GW、盆<br>***************************`,
      isHtml: true,
      fixedRecipient: null,
    },
  ];

  // プレースホルダー置換
  const replaceWorkTaskPlaceholders = (text: string): string => {
    const sellerName = getValue('seller_contact_name') || getValue('seller_name') || '';
    const buyerName = getValue('buyer_contact_name') || '';
    const propertyAddress = getValue('property_address') || '';
    const settlementDate = getValue('settlement_date')
      ? (() => {
          try {
            const d = new Date(getValue('settlement_date'));
            return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
          } catch { return getValue('settlement_date'); }
        })()
      : '';
    const sellerTel = getValue('seller_contact_tel') || '';
    const sellerEmail = getValue('seller_contact_email') || '';
    const buyerTel = getValue('buyer_contact_tel') || '';
    const buyerEmail = getValue('buyer_contact_email') || '';
    const loan = getValue('loan') || '';
    const financialInstitution = getValue('financial_institution') || '';
    const deliveryDate = getValue('delivery_scheduled_date')
      ? (() => {
          try {
            const d = new Date(getValue('delivery_scheduled_date'));
            return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
          } catch { return getValue('delivery_scheduled_date'); }
        })()
      : '';
    const empty = '<span style="color:#d32f2f;font-weight:bold;">未入力です！！</span>';
    const v = (val: string) => val || empty;
    return text
      .replace(/｛売主氏名｝/g, v(sellerName))
      .replace(/｛売主名前｝/g, v(sellerName))
      .replace(/｛売主TEL｝/g, v(sellerTel))
      .replace(/｛売主メアド｝/g, v(sellerEmail))
      .replace(/｛買主氏名｝/g, v(buyerName))
      .replace(/｛買主名前｝/g, v(buyerName))
      .replace(/｛買主TEL｝/g, v(buyerTel))
      .replace(/｛買主メアド｝/g, v(buyerEmail))
      .replace(/｛物件住所｝/g, v(propertyAddress))
      .replace(/｛決済日｝/g, v(settlementDate))
      .replace(/｛ローン｝/g, v(loan))
      .replace(/｛金融機関名｝/g, v(financialInstitution))
      .replace(/｛引き渡し予定｝/g, v(deliveryDate));
  };

  // 社員データ取得
  useEffect(() => {
    if (open) {
      getActiveEmployees().then(emps => {
        setActiveEmployees(emps);
        const saved = getSenderAddress();
        const validEmails = ['tenant@ifoo-oita.com', ...emps.filter(e => e.email).map(e => e.email)];
        setSenderAddress(validateSenderAddress(saved, validEmails));
      }).catch(() => {});
    }
  }, [open]);

  const handleEmailTemplateSelect = (templateId: string, type: 'seller' | 'buyer' | 'judicial_scrivener') => {
    if (!templateId) return;
    const templates = type === 'seller' ? SELLER_EMAIL_TEMPLATES
      : type === 'buyer' ? BUYER_EMAIL_TEMPLATES
      : JUDICIAL_SCRIVENER_EMAIL_TEMPLATES;
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const replacedSubject = replaceWorkTaskPlaceholders(template.subject);
    const replacedBody = replaceWorkTaskPlaceholders(template.body);
    const htmlBody = (template as any).isHtml ? replacedBody : replacedBody.replace(/\n/g, '<br>');

    let recipientEmail = '';
    if (type === 'seller') {
      recipientEmail = getValue('seller_contact_email') || '';
    } else if (type === 'buyer') {
      recipientEmail = getValue('buyer_contact_email') || '';
    } else if (type === 'judicial_scrivener') {
      const fixedRecipient = (template as any).fixedRecipient;
      recipientEmail = fixedRecipient || getValue('judicial_scrivener_contact') || '';
    }

    setEmailRecipient(recipientEmail);
    setEmailSubject(replacedSubject);
    setEmailBody(htmlBody);
    setSelectedImages([]);
    setTemplateSelectType(null);
    setEmailDialog({
      open: true,
      type,
      templateId: template.id,
      templateLabel: template.name,
    });
  };

  const handleSenderAddressChange = (address: string) => {
    setSenderAddress(address);
    saveSenderAddress(address);
  };

  const handleConfirmEmailSend = async () => {
    if (!emailRecipient || !emailSubject) return;
    setSendingEmail(true);
    try {
      // 添付画像の処理
      const attachmentImages: any[] = [];
      for (const img of selectedImages) {
        if (img.source === 'drive') {
          attachmentImages.push({ id: img.driveFileId || img.id, name: img.name });
        } else if (img.source === 'local' && img.previewUrl) {
          const base64Match = (img.previewUrl as string).match(/^data:([^;]+);base64,(.+)$/);
          if (base64Match) {
            attachmentImages.push({ id: img.id, name: img.name, base64Data: base64Match[2], mimeType: base64Match[1] });
          }
        } else if (img.source === 'url' && img.url) {
          attachmentImages.push({ id: img.id, name: img.name, url: img.url });
        }
      }

      // 売主IDを取得してEmail送信APIを呼び出す
      // work_tasksにはseller_idがないため、seller_numberで検索
      const sellerNumber = getValue('property_number');
      const payload: any = {
        templateId: emailDialog.templateId || 'work_task_email',
        to: emailRecipient,
        subject: emailSubject,
        content: emailBody.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''),
        htmlBody: emailBody,
        from: senderAddress,
        templateName: emailDialog.templateLabel || emailDialog.templateId || '',
        ...(attachmentImages.length > 0 ? { attachments: attachmentImages } : {}),
      };

      // seller_numberでseller_idを取得してAPIを呼び出す
      const sellerRes = await api.get(`/api/sellers/by-number/${sellerNumber}`);
      const sellerData = sellerRes.data;

      if (sellerData?.id) {
        await api.post(`/api/emails/${sellerData.id}/send-template-email`, payload);
      } else {
        throw new Error('売主情報が見つかりません');
      }

      setSnackbar({ open: true, message: 'メールを送信しました', severity: 'success' });
      setEmailDialog({ open: false, type: null, templateId: null, templateLabel: '' });
      setSelectedImages([]);
      // Email送信後に履歴を再取得（SellerBuyerDetailSectionが再マウントされるため、
      // propertyNumberを変更してuseEffectを再トリガーする代わりに、
      // 送信成功フラグを使って履歴更新を通知する）
      setEmailHistoryRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Email送信エラー:', error);
      setSnackbar({ open: true, message: 'メール送信に失敗しました', severity: 'error' });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCancelEmailSend = () => {
    setEmailDialog({ open: false, type: null, templateId: null, templateLabel: '' });
    setEmailRecipient('');
    setEmailSubject('');
    setEmailBody('');
    setSelectedImages([]);
    setTemplateSelectType(null);
  };
  // ===== Email送信機能ここまで =====

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

  // 契約書修正内容まとめ用データ（ContractSettlementSection用）
  const [contractRevisionSummary, setContractRevisionSummary] = useState<Array<{
    property_number: string;
    property_address: string;
    contract_input_deadline: string | null;
    employee_contract_creation: string | null;
    contract_revision_content: string | null;
    contract_revision_countermeasure: string | null;
  }>>([]);

  useEffect(() => {
    if (!open) return;
    const fetchContractRevisionSummary = async () => {
      try {
        const { data: rows, error } = await supabase
          .from('work_tasks')
          .select('property_number, property_address, contract_input_deadline, employee_contract_creation, contract_revision_content, contract_revision_countermeasure')
          .eq('contract_revision_exists', 'あり')
          .not('contract_revision_content', 'is', null)
          .neq('contract_revision_content', '')
          .order('contract_input_deadline', { ascending: false, nullsFirst: false });
        if (!error && rows) {
          setContractRevisionSummary(rows.filter((r: any) => (r.contract_revision_content || '').trim() !== ''));
        }
      } catch {
        // エラー時は空のまま
      }
    };
    fetchContractRevisionSummary();
  }, [open, data]);

  // サイト登録タブ左右ペインのスクロール位置保持用 ref
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<number>(0);
  const rightScrollRef = useRef<number>(0);
  // 媒介契約タブのスクロール位置保持用 ref
  const mediationPaneRef = useRef<HTMLDivElement>(null);
  const mediationScrollRef = useRef<number>(0);
  // 売主・買主詳細タブのスクロール位置保持用 ref
  const sellerBuyerRightPaneRef = useRef<HTMLDivElement>(null);
  const sellerBuyerRightScrollRef = useRef<number>(0);

  // 契約決済タブのスクロール位置保持用 ref
  const contractLeftPaneRef = useRef<HTMLDivElement>(null);
  const contractRightPaneRef = useRef<HTMLDivElement>(null);
  const contractLeftScrollRef = useRef<number>(0);
  const contractRightScrollRef = useRef<number>(0);

  // 売買契約確認フィールドへのスクロール用 ref
  const salesContractConfirmedRef = useRef<HTMLDivElement>(null);

  // 営業担当フィールドへのスクロール用 ref
  const salesAssigneeRef = useRef<HTMLDivElement>(null);

  // editedData 変更後に左右ペインのスクロール位置を復元（サイト登録タブのみ）
  useEffect(() => {
    if (tabIndex !== 1) return;
    const raf = requestAnimationFrame(() => {
      if (leftPaneRef.current) {
        leftPaneRef.current.scrollTop = leftScrollRef.current;
      }
      if (rightPaneRef.current) {
        rightPaneRef.current.scrollTop = rightScrollRef.current;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [editedData, tabIndex]);

  // editedData 変更後に売主・買主詳細タブのスクロール位置を復元
  useEffect(() => {
    if (tabIndex !== 3) return;
    // 再マウント後にDOMが確定してからスクロール位置を復元する
    const raf = requestAnimationFrame(() => {
      if (sellerBuyerRightPaneRef.current) {
        sellerBuyerRightPaneRef.current.scrollTop = sellerBuyerRightScrollRef.current;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [editedData, tabIndex]);

  // editedData 変更後に契約決済タブのスクロール位置を復元
  useEffect(() => {
    if (tabIndex !== 2) return;
    const raf = requestAnimationFrame(() => {
      if (contractLeftPaneRef.current) {
        contractLeftPaneRef.current.scrollTop = contractLeftScrollRef.current;
      }
      if (contractRightPaneRef.current) {
        contractRightPaneRef.current.scrollTop = contractRightScrollRef.current;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [editedData, tabIndex]);



  // 編集可能テキストフィールド
  const EditableField = ({ label, field, type = 'text', labelColor, required, highlight, multiline }: { label: string; field: string; type?: string; labelColor?: 'error' | 'text.secondary'; required?: boolean; highlight?: boolean; multiline?: boolean }) => (
    <Grid container spacing={2} alignItems={multiline ? 'flex-start' : 'center'} sx={{ mb: 1.5, ...(highlight ? { bgcolor: '#fff3e0', borderRadius: 1, p: 0.5, border: '2px solid #ff9800' } : {}) }}>
      <Grid item xs={4}>
        <Typography variant="body2" color={highlight ? 'warning.dark' : (labelColor || 'text.secondary')} sx={{ fontWeight: (highlight || labelColor === 'error') ? 700 : 500, ...(multiline ? { mt: 0.5 } : {}) }}>
          {label}{required && !getValue(field) ? <span style={{ color: '#d32f2f', marginLeft: 2 }}>*（必須）</span> : null}
        </Typography>
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
            value={getValue(field) != null && getValue(field) !== '' ? Math.round(Number(getValue(field))) : ''}
            onChange={(e) => handleFieldChange(field, e.target.value ? Math.round(Number(e.target.value)) : null)}
            fullWidth
            inputProps={{ step: 1 }}
          />
        ) : type === 'url' ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              key={`${propertyNumber}_${field}`}
              defaultValue={getValue(field) || ''}
              onBlur={(e) => { if (e.target.value !== (getValue(field) || '')) handleFieldChange(field, e.target.value || null); }}
              fullWidth
            />
            {getValue(field) && (
              <Link href={getValue(field)} target="_blank" rel="noopener" sx={{ whiteSpace: 'nowrap' }}>開く</Link>
            )}
          </Box>
        ) : multiline ? (
          <TextField
            size="small"
            key={`${propertyNumber}_${field}`}
            defaultValue={getValue(field) || ''}
            onBlur={(e) => { if (e.target.value !== (getValue(field) || '')) handleFieldChange(field, e.target.value || null); }}
            fullWidth
            multiline
            minRows={3}
            error={required && !getValue(field)}
            helperText={required && !getValue(field) ? '必須項目です' : ''}
          />
        ) : (
          <TextField
            size="small"
            key={`${propertyNumber}_${field}`}
            defaultValue={getValue(field) || ''}
            onBlur={(e) => { if (e.target.value !== (getValue(field) || '')) handleFieldChange(field, e.target.value || null); }}
            fullWidth
          />
        )}
      </Grid>
    </Grid>
  );

  // 編集可能ボタン選択
  const EditableButtonSelect = ({ label, field, options, labelColor, required, highlight }: { label: string; field: string; options: string[]; labelColor?: 'error' | 'text.secondary'; required?: boolean; highlight?: boolean }) => (
    <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5, ...(highlight ? { bgcolor: '#fff3e0', borderRadius: 1, p: 0.5, border: '2px solid #ff9800' } : {}) }}>
      <Grid item xs={4}>
        <Typography variant="body2" color={highlight ? 'warning.dark' : (labelColor || 'text.secondary')} sx={{ fontWeight: (highlight || labelColor === 'error') ? 700 : 500 }}>
          {label}{required && !getValue(field) ? <span style={{ color: '#d32f2f', marginLeft: 2 }}>*（必須）</span> : null}
        </Typography>
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

  // チャット送信付きN/Yボタン
  const ChatSendButton = ({
    label,
    field,
    chatType,
    staffName,
    buildMessage,
    required,
    highlight,
  }: {
    label: string;
    field: string;
    chatType: 'settlement' | 'staff';
    staffName?: string;
    buildMessage: () => string;
    required?: boolean;
    highlight?: boolean;
  }) => {
    const [sending, setSending] = React.useState(false);

    const handleClick = async (val: 'Y' | 'N') => {
      // 同じ値を再度押した場合はトグル解除のみ（チャット送信なし）
      if (getValue(field) === val) {
        handleFieldChange(field, null);
        return;
      }
      setSending(true);
      try {
        const message = buildMessage();
        await api.post(`/api/work-tasks/${propertyNumber}/send-settlement-chat`, {
          type: chatType,
          staffName,
          message,
        });
        handleFieldChange(field, val);
        setSnackbar({ open: true, message: `${label}を送信しました`, severity: 'success' });
      } catch (err: any) {
        setSnackbar({ open: true, message: `チャット送信に失敗しました: ${err?.response?.data?.error || err.message}`, severity: 'error' });
      } finally {
        setSending(false);
      }
    };

    return (
      <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5, ...(highlight ? { bgcolor: '#fff3e0', borderRadius: 1, p: 0.5, border: '2px solid #ff9800' } : {}) }}>
        <Grid item xs={4}>
          <Typography variant="body2" color={highlight ? 'warning.dark' : 'text.secondary'} sx={{ fontWeight: (highlight || required) ? 700 : 500 }}>
            {label}{required && !getValue(field) ? <span style={{ color: '#d32f2f', marginLeft: 2 }}>*（必須）</span> : null}
          </Typography>
        </Grid>
        <Grid item xs={8}>
          <ButtonGroup size="small" variant="outlined" disabled={sending}>
            <Button
              variant={getValue(field) === 'N' ? 'contained' : 'outlined'}
              color={getValue(field) === 'N' ? 'error' : 'inherit'}
              onClick={() => handleClick('N')}
            >N</Button>
            <Button
              variant={getValue(field) === 'Y' ? 'contained' : 'outlined'}
              color={getValue(field) === 'Y' ? 'success' : 'inherit'}
              onClick={() => handleClick('Y')}
            >{sending ? '送信中...' : 'Y'}</Button>
          </ButtonGroup>
        </Grid>
      </Grid>
    );
  };

  // Yes/No選択
  const EditableYesNo = ({ label, field, labelColor }: { label: string; field: string; labelColor?: 'error' | 'text.secondary' }) => (
    <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
      <Grid item xs={4}>
        <Typography variant="body2" color={labelColor || 'text.secondary'} sx={{ fontWeight: labelColor === 'error' ? 700 : 500 }}>
          {label}
        </Typography>
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

  // 媒介確認者が必須かどうかの判定（媒介作成完了が2026/4/23以降）
  const isMediationCheckerRequired = (() => {
    const completed = getValue('mediation_completed');
    if (!completed) return false;
    try {
      return new Date(completed) >= new Date('2026-04-23');
    } catch {
      return false;
    }
  })();

  // 媒介契約修正履歴（全案件・全担当者）
  const [mediationRevisionHistory, setMediationRevisionHistory] = useState<Array<{
    property_number: string;
    mediation_completed: string | null;
    mediation_checker: string | null;
    mediation_creator: string;
    mediation_revision_content: string;
    mediation_revision_countermeasure: string | null;
  }>>([]);

  // サイト登録修正履歴（全案件）
  const [siteRegistrationRevisionHistory, setSiteRegistrationRevisionHistory] = useState<Array<{
    property_number: string;
    site_registration_confirmer: string | null;
    site_registration_requester: string | null;
    site_registration_revision_content: string;
    site_registration_revision_countermeasure: string | null;
  }>>([]);

  // 間取図修正（当社ミス）履歴（全案件）
  const [floorPlanRevisionCorrectionHistory, setFloorPlanRevisionCorrectionHistory] = useState<Array<{
    property_number: string;
    floor_plan_confirmer: string | null;
    site_registration_requester: string | null;
    floor_plan_revision_correction_content: string;
    floor_plan_revision_countermeasure: string | null;
  }>>([]);

  // 日付文字列をYYYY-MM-DD形式に整形
  const formatDateShort = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return dateStr;
    }
  };

  // モーダルが開いたとき（data取得後）に修正履歴を全件取得
  useEffect(() => {
    if (!open) return;
    const fetchHistory = async () => {
      try {
        const res = await api.get('/api/work-tasks/mediation-revisions');
        setMediationRevisionHistory(res.data || []);
      } catch {
        setMediationRevisionHistory([]);
      }
    };
    fetchHistory();
  }, [open]);

  // サイト登録修正履歴・間取図修正履歴を取得
  const fetchRevisionHistories = React.useCallback(async () => {
    try {
      const [siteRes, floorRes] = await Promise.all([
        api.get('/api/work-tasks/site-registration-revisions'),
        api.get('/api/work-tasks/floor-plan-revision-corrections'),
      ]);
      setSiteRegistrationRevisionHistory(siteRes.data || []);
      setFloorPlanRevisionCorrectionHistory(floorRes.data || []);
    } catch {
      setSiteRegistrationRevisionHistory([]);
      setFloorPlanRevisionCorrectionHistory([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchRevisionHistories();
  }, [open]);

  // 媒介契約セクション（コンポーネントではなく関数として定義し再マウントを防ぐ）
  const renderMediationSection = () => (
    <Box ref={mediationPaneRef} sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
      <EditableField label="物件番号" field="property_number" />
      <EditableField label="媒介備考" field="mediation_notes" />
      <EditableField label="物件所在" field="property_address" />
      <EditableField label="売主" field="seller_name" />
      <EditableField label="スプシURL" field="spreadsheet_url" type="url" />
      <Box ref={salesAssigneeRef}>
        <EditableButtonSelect label="営業担当" field="sales_assignee" options={normalInitials} />
      </Box>
      <EditableField label="媒介形態" field="mediation_type" />
      <EditableField label="媒介作成締め日" field="mediation_deadline" type="date" />
      <EditableField label="媒介作成完了" field="mediation_completed" type="date" />
      <EditableButtonSelect label="媒介作成者" field="mediation_creator" options={normalInitials} />

      {/* 媒介作成完了に値がある場合のみ媒介確認者を表示 */}
      {getValue('mediation_completed') && (
        <>
          <EditableButtonSelect
            label={isMediationCheckerRequired ? '媒介確認者*（必須）' : '媒介確認者'}
            field="mediation_checker"
            options={normalInitials}
            labelColor={isMediationCheckerRequired && !getValue('mediation_checker') ? 'error' : undefined}
          />

          {/* 媒介確認者に値がある場合のみ媒介契約修正を表示 */}
          {getValue('mediation_checker') && (
            <>
              <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>媒介契約修正*（必須）</Typography>
                </Grid>
                <Grid item xs={8}>
                  <ButtonGroup size="small" variant="outlined">
                    {['あり', 'なし'].map((opt) => (
                      <Button
                        key={opt}
                        variant={getValue('mediation_revision') === opt ? 'contained' : 'outlined'}
                        color={getValue('mediation_revision') === opt ? (opt === 'あり' ? 'error' : 'primary') : 'inherit'}
                        onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange('mediation_revision', getValue('mediation_revision') === opt ? null : opt); }}
                      >
                        {opt}
                      </Button>
                    ))}
                  </ButtonGroup>
                </Grid>
              </Grid>

              {/* 媒介契約修正が「あり」の場合のみ修正内容を表示 */}
              {getValue('mediation_revision') === 'あり' && (
                <Box sx={{ mb: 1.5 }}>
                  <Grid container spacing={2} alignItems="flex-start">
                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mt: 0.5 }}>媒介契約修正内容</Typography>
                    </Grid>
                    <Grid item xs={8}>
                      <TextField
                        size="small"
                        multiline
                        minRows={3}
                        maxRows={8}
                        value={getValue('mediation_revision_content') || ''}
                        onChange={(e) => handleFieldChange('mediation_revision_content', e.target.value)}
                        fullWidth
                      />
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                        ※ これは次回この作成担当者に注意点として表示されるので、分かりやすく具体的に記載してください
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </>
          )}
        </>
      )}

      <EditableYesNo label="保留" field="on_hold" />

      {/* 媒介契約修正内容まとめ（常時表示・全担当者） */}
      {mediationRevisionHistory.length > 0 && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#fff3e0', border: '2px solid #ff9800', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#e65100', mb: 1 }}>
            ⚠️ 媒介契約修正内容まとめ
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#ffe0b2' }}>
                  <th style={{ border: '1px solid #ffb74d', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>物件番号</th>
                  <th style={{ border: '1px solid #ffb74d', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>媒介作成完了日</th>
                  <th style={{ border: '1px solid #ffb74d', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>媒介確認者</th>
                  <th style={{ border: '1px solid #ffb74d', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>媒介作成者</th>
                  <th style={{ border: '1px solid #ffb74d', padding: '4px 8px', textAlign: 'left', width: '35%' }}>修正内容</th>
                  <th style={{ border: '1px solid #ffb74d', padding: '4px 8px', textAlign: 'left', width: '25%' }}>対策案</th>
                </tr>
              </thead>
              <tbody>
                {mediationRevisionHistory.map((item, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff8f0' : '#fff3e0' }}>
                    <td style={{ border: '1px solid #ffb74d', padding: '4px 8px', whiteSpace: 'nowrap' }}>{item.property_number || '-'}</td>
                    <td style={{ border: '1px solid #ffb74d', padding: '4px 8px', whiteSpace: 'nowrap' }}>{formatDateShort(item.mediation_completed)}</td>
                    <td style={{ border: '1px solid #ffb74d', padding: '4px 8px', whiteSpace: 'nowrap' }}>{item.mediation_checker || '-'}</td>
                    <td style={{ border: '1px solid #ffb74d', padding: '4px 8px', whiteSpace: 'nowrap' }}>{item.mediation_creator || '-'}</td>
                    <td style={{ border: '1px solid #ffb74d', padding: '4px 8px', whiteSpace: 'pre-wrap', width: '35%', color: '#c62828', fontWeight: 700 }}>{item.mediation_revision_content}</td>
                    <td style={{ border: '1px solid #ffb74d', padding: '4px 8px', width: '25%', color: '#c62828', fontWeight: 700 }}>
                      <CountermeasureCell
                        propertyNumber={item.property_number}
                        field="mediation_revision_countermeasure"
                        value={item.mediation_revision_countermeasure || ''}
                        onSaved={(val) => {
                          setMediationRevisionHistory(prev => prev.map((r, i) => i === idx ? { ...r, mediation_revision_countermeasure: val } : r));
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Box>
      )}
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
    <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 0, flex: isMobile ? 'none' : 1, minHeight: 0, overflow: isMobile ? 'visible' : 'hidden' }}>
      {/* 左側：登録関係 */}
      <Box ref={leftPaneRef} sx={{ flex: 1, p: 2, borderRight: isMobile ? 'none' : '2px solid', borderBottom: isMobile ? '2px solid' : 'none', borderColor: 'divider', overflowY: isMobile ? 'visible' : 'auto', minHeight: 0 }}>
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
          {/* 地積測量図・字図が「未」かつ「追加済」の場合、athome確認を必須表示 */}
          {getValue('property_list_row_added') === '追加済' &&
            (getValue('cadastral_map_field') === '未' || getValue('cadastral_map_url') === '未') && (
            <Box sx={{
              mt: 1,
              p: 1.5,
              bgcolor: athomePreVisitCheckRequired && getValue('athome_pre_visit_notice_hidden_confirmed') !== 'はい'
                ? '#ffebee'
                : '#fff8e1',
              border: athomePreVisitCheckRequired && getValue('athome_pre_visit_notice_hidden_confirmed') !== 'はい'
                ? '2px solid #d32f2f'
                : '1px solid #ffe082',
              borderRadius: 1,
            }}>
              <Typography variant="caption" sx={{
                fontWeight: 700,
                color: athomePreVisitCheckRequired && getValue('athome_pre_visit_notice_hidden_confirmed') !== 'はい'
                  ? '#d32f2f'
                  : '#e65100',
                display: 'block',
                mb: 0.5,
              }}>
                ⚠️ スプシathomeの内覧前伝達事項●●の表示を消しましたか？（必須）
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant={getValue('athome_pre_visit_notice_hidden_confirmed') === 'はい' ? 'contained' : 'outlined'}
                  color={getValue('athome_pre_visit_notice_hidden_confirmed') === 'はい' ? 'success' : 'warning'}
                  onClick={(e) => {
                    (e.currentTarget as HTMLButtonElement).blur();
                    handleFieldChange('athome_pre_visit_notice_hidden_confirmed', 'はい');
                    setAthomePreVisitCheckRequired(false);
                  }}
                  sx={{ fontWeight: 700 }}
                >
                  はい
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* 右側：確認関係 */}
      <Box ref={rightPaneRef} sx={{ flex: 1, p: 2, overflowY: isMobile ? 'visible' : 'auto', minHeight: 0 }}>
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
        {/* サイト登録確認が「完了」になったら確認者を表示（必須） */}
        {getValue('site_registration_confirmed') === '完了' && (
          <EditableButtonSelect
            label={!getValue('site_registration_confirmer') ? 'サイト登録確認者*（必須）' : 'サイト登録確認者'}
            field="site_registration_confirmer"
            options={normalInitials}
            labelColor={!getValue('site_registration_confirmer') ? 'error' : undefined}
          />
        )}
        <EditableField label="メール配信v" field="email_distribution" />
        <EditableField label="サイト登録確認OKコメント" field="site_registration_ok_comment" type="text" />
        <EditableYesNo
          label={getValue('site_registration_confirmed') === '完了' && !getValue('site_registration_ok_sent') ? 'サイト登録確認OK送信*（必須）' : 'サイト登録確認OK送信'}
          field="site_registration_ok_sent"
          labelColor={getValue('site_registration_confirmed') === '完了' && !getValue('site_registration_ok_sent') ? 'error' : undefined}
        />
        {/* サイト登録確認OK送信に値がある場合、サイト登録修正フィールドを表示 */}
        {getValue('site_registration_ok_sent') && (
          <>
            <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
              <Grid item xs={4}>
                <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>サイト登録修正（当社ミス）*（必須）</Typography>
              </Grid>
              <Grid item xs={8}>
                <ButtonGroup size="small" variant="outlined">
                  {['あり', 'なし'].map((opt) => (
                    <Button
                      key={opt}
                      variant={getValue('site_registration_revision') === opt ? 'contained' : 'outlined'}
                      color={getValue('site_registration_revision') === opt ? (opt === 'あり' ? 'error' : 'primary') : 'inherit'}
                      onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange('site_registration_revision', getValue('site_registration_revision') === opt ? null : opt); }}
                    >
                      {opt}
                    </Button>
                  ))}
                </ButtonGroup>
              </Grid>
            </Grid>
            {/* サイト登録修正が「あり」の場合のみ修正内容を表示 */}
            {getValue('site_registration_revision') === 'あり' && (
              <SiteRevisionContentField
                value={getValue('site_registration_revision_content') || ''}
                hasError={!getValue('site_registration_revision_content')}
                onCommit={(v) => handleFieldChange('site_registration_revision_content', v)}
              />
            )}
          </>
        )}
        <ReadOnlyDisplayField
          label=""
          value={cwCounts.siteRegistration ? `サイト登録（CW)計⇒ ${cwCounts.siteRegistration}` : '-'}
        />
        </Box>

        {/* サイト登録修正内容まとめ（【★サイト登録確認】の下に表示） */}
        {siteRegistrationRevisionHistory.length > 0 && (
          <Box sx={{ mt: 1, mb: 1, p: 1.5, bgcolor: '#fce4ec', border: '2px solid #e91e63', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#880e4f', mb: 1 }}>
              ⚠️ サイト登録修正内容まとめ
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8bbd0' }}>
                    <th style={{ border: '1px solid #f48fb1', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>物件番号</th>
                    <th style={{ border: '1px solid #f48fb1', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>サイト登録確認者</th>
                    <th style={{ border: '1px solid #f48fb1', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>サイト登録依頼者</th>
                    <th style={{ border: '1px solid #f48fb1', padding: '4px 8px', textAlign: 'left', width: '35%' }}>修正内容</th>
                    <th style={{ border: '1px solid #f48fb1', padding: '4px 8px', textAlign: 'left', width: '25%' }}>対策案</th>
                  </tr>
                </thead>
                <tbody>
                  {siteRegistrationRevisionHistory.map((item, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fce4ec' : '#fce4ec' }}>
                      <td style={{ border: '1px solid #f48fb1', padding: '4px 8px', whiteSpace: 'nowrap' }}>{item.property_number || '-'}</td>
                      <td style={{ border: '1px solid #f48fb1', padding: '4px 8px', whiteSpace: 'nowrap' }}>{item.site_registration_confirmer || '-'}</td>
                      <td style={{ border: '1px solid #f48fb1', padding: '4px 8px', whiteSpace: 'nowrap' }}>{item.site_registration_requester || '-'}</td>
                      <td style={{ border: '1px solid #f48fb1', padding: '4px 8px', whiteSpace: 'pre-wrap', width: '35%', color: '#c62828', fontWeight: 700 }}>{item.site_registration_revision_content}</td>
                      <td style={{ border: '1px solid #f48fb1', padding: '4px 8px', width: '25%', color: '#c62828', fontWeight: 700 }}>
                        <CountermeasureCell
                          propertyNumber={item.property_number}
                          field="site_registration_revision_countermeasure"
                          value={item.site_registration_revision_countermeasure || ''}
                          onSaved={(val) => {
                            setSiteRegistrationRevisionHistory(prev => prev.map((r, i) => i === idx ? { ...r, site_registration_revision_countermeasure: val } : r));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Box>
        )}

        <Box sx={{ bgcolor: '#fff3e0', borderRadius: 1, p: 1, mb: 1 }}>
        <SectionHeader label="【★図面確認】" />
        <EditableButtonSelect label="間取図確認者*" field="floor_plan_confirmer" options={normalInitials} />
        <EditableField label="間取図確認OK/修正コメント" field="floor_plan_ok_comment" />
        <EditableYesNo
          label={getValue('floor_plan_confirmer') && !getValue('floor_plan_ok_sent') ? '間取図確認OK送信*（必須）' : '間取図確認OK送信*'}
          field="floor_plan_ok_sent"
          labelColor={getValue('floor_plan_confirmer') && !getValue('floor_plan_ok_sent') ? 'error' : undefined}
        />
        {/* 間取図確認OK送信に値がある場合、間取図修正（当社ミス）フィールドを表示 */}
        {getValue('floor_plan_ok_sent') && (
          <>
            <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
              <Grid item xs={4}>
                <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>間取図修正（当社ミス）*（必須）</Typography>
              </Grid>
              <Grid item xs={8}>
                <ButtonGroup size="small" variant="outlined">
                  {['あり', 'なし'].map((opt) => (
                    <Button
                      key={opt}
                      variant={getValue('floor_plan_revision_correction') === opt ? 'contained' : 'outlined'}
                      color={getValue('floor_plan_revision_correction') === opt ? (opt === 'あり' ? 'error' : 'primary') : 'inherit'}
                      onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange('floor_plan_revision_correction', getValue('floor_plan_revision_correction') === opt ? null : opt); }}
                    >
                      {opt}
                    </Button>
                  ))}
                </ButtonGroup>
              </Grid>
            </Grid>
            {/* 間取図修正（当社ミス）が「あり」の場合のみ修正内容を表示 */}
            {getValue('floor_plan_revision_correction') === 'あり' && (
              <FloorPlanRevisionContentField
                value={getValue('floor_plan_revision_correction_content') || ''}
                hasError={!getValue('floor_plan_revision_correction_content')}
                onCommit={(v) => handleFieldChange('floor_plan_revision_correction_content', v)}
              />
            )}
          </>
        )}
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
        <EditableField
          label={getValue('floor_plan_confirmer') && !getValue('floor_plan_completed_date') ? '間取図完了日*（必須）' : '間取図完了日*'}
          field="floor_plan_completed_date"
          type="date"
          labelColor={getValue('floor_plan_confirmer') && !getValue('floor_plan_completed_date') ? 'error' : undefined}
        />
        <EditableYesNo
          label={getValue('floor_plan_confirmer') && !getValue('floor_plan_stored_email') ? '間取図格納済み連絡メール*（必須）' : '間取図格納済み連絡メール'}
          field="floor_plan_stored_email"
          labelColor={getValue('floor_plan_confirmer') && !getValue('floor_plan_stored_email') ? 'error' : undefined}
        />
        </Box>

        {/* 間取図修正内容まとめ（【★図面確認】の下に表示） */}
        {floorPlanRevisionCorrectionHistory.length > 0 && (
          <Box sx={{ mt: 1, mb: 1, p: 1.5, bgcolor: '#e8f5e9', border: '2px solid #4caf50', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1b5e20', mb: 1 }}>
              ⚠️ 間取図修正内容まとめ（当社ミス）
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#c8e6c9' }}>
                    <th style={{ border: '1px solid #81c784', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>物件番号</th>
                    <th style={{ border: '1px solid #81c784', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>間取図確認者</th>
                    <th style={{ border: '1px solid #81c784', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>サイト登録依頼者</th>
                    <th style={{ border: '1px solid #81c784', padding: '4px 8px', textAlign: 'left', width: '35%' }}>修正内容</th>
                    <th style={{ border: '1px solid #81c784', padding: '4px 8px', textAlign: 'left', width: '25%' }}>対策案</th>
                  </tr>
                </thead>
                <tbody>
                  {floorPlanRevisionCorrectionHistory.map((item, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f1f8e9' : '#e8f5e9' }}>
                      <td style={{ border: '1px solid #81c784', padding: '4px 8px', whiteSpace: 'nowrap' }}>{item.property_number || '-'}</td>
                      <td style={{ border: '1px solid #81c784', padding: '4px 8px', whiteSpace: 'nowrap' }}>{item.floor_plan_confirmer || '-'}</td>
                      <td style={{ border: '1px solid #81c784', padding: '4px 8px', whiteSpace: 'nowrap' }}>{item.site_registration_requester || '-'}</td>
                      <td style={{ border: '1px solid #81c784', padding: '4px 8px', whiteSpace: 'pre-wrap', width: '35%', color: '#c62828', fontWeight: 700 }}>{item.floor_plan_revision_correction_content}</td>
                      <td style={{ border: '1px solid #81c784', padding: '4px 8px', width: '25%', color: '#c62828', fontWeight: 700 }}>
                        <CountermeasureCell
                          propertyNumber={item.property_number}
                          field="floor_plan_revision_countermeasure"
                          value={item.floor_plan_revision_countermeasure || ''}
                          onSaved={(val) => {
                            setFloorPlanRevisionCorrectionHistory(prev => prev.map((r, i) => i === idx ? { ...r, floor_plan_revision_countermeasure: val } : r));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Box>
        )}

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
            disabled={false}
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

  // 契約決済セクション（関数呼び出し形式で再マウントを防ぐ）
  const renderContractSettlementSection = () => (
    <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 0, flex: isMobile ? 'none' : 1, minHeight: 0, overflow: isMobile ? 'visible' : 'hidden' }}>
      {/* 左ペイン: 契約書・重説作成 */}
      <Box ref={contractLeftPaneRef} sx={{ flex: 1, p: 2, borderRight: isMobile ? 'none' : '2px solid', borderBottom: isMobile ? '2px solid' : 'none', borderColor: 'divider', overflowY: isMobile ? 'visible' : 'auto', minHeight: 0 }}>
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

          <EditableField label="重説・契約書入力納期" field="contract_input_deadline" type="date" />
          <PreRequestCheckButton />
          <EditableButtonSelect label="社員が契約書作成" field="employee_contract_creation" options={normalInitials} />

          {/* 売買契約確認（スプシAM列と同期）- 「確認OK」は営業のみ押せる */}
          <div ref={salesContractConfirmedRef}>
          {isSales ? (
            <EditableButtonSelect label="売買契約確認" field="sales_contract_confirmed" options={['確認中', '確認OK']} />
          ) : (
            <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  売買契約確認
                </Typography>
              </Grid>
              <Grid item xs={8}>
                <ButtonGroup size="small" variant="outlined">
                  {['確認中', '確認OK'].map((opt) => (
                    <Button
                      key={opt}
                      variant={getValue('sales_contract_confirmed') === opt ? 'contained' : 'outlined'}
                      color={getValue('sales_contract_confirmed') === opt ? 'primary' : 'inherit'}
                      disabled={opt === '確認OK'}
                      title={opt === '確認OK' ? '営業のみ操作できます' : undefined}
                      onClick={opt !== '確認OK' ? (e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange('sales_contract_confirmed', getValue('sales_contract_confirmed') === opt ? null : opt); } : undefined}
                    >
                      {opt}
                    </Button>
                  ))}
                </ButtonGroup>
                {getValue('sales_contract_confirmed') !== '確認OK' && (
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                    「確認OK」は営業のみ操作できます
                  </Typography>
                )}
              </Grid>
            </Grid>
          )}
          </div>

          {/* 確認OKの場合のみ表示 */}
          {getValue('sales_contract_confirmed') === '確認OK' && (
            <Box sx={{ bgcolor: '#fff8e1', borderRadius: 1, p: 1.5, mb: 1 }}>
              {/* 契約書、重説他　修正点（必須） */}
              <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>
                    契約書、重説他　修正点*（必須）
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <ButtonGroup size="small" variant="outlined">
                    {['あり', 'なし'].map((opt) => (
                      <Button
                        key={opt}
                        variant={getValue('contract_revision_exists') === opt ? 'contained' : 'outlined'}
                        color={getValue('contract_revision_exists') === opt ? (opt === 'あり' ? 'error' : 'success') : 'inherit'}
                        onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange('contract_revision_exists', getValue('contract_revision_exists') === opt ? null : opt); }}
                      >
                        {opt}
                      </Button>
                    ))}
                  </ButtonGroup>
                  {!getValue('contract_revision_exists') && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                      必須項目です
                    </Typography>
                  )}
                </Grid>
              </Grid>

              {/* 「あり」の場合のみ修正内容を表示（必須） */}
              {getValue('contract_revision_exists') === 'あり' && (
                <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>
                      契約書、重説他の修正内容*（必須）
                    </Typography>
                  </Grid>
                  <Grid item xs={8}>
                    <TextField
                      key={`contract_revision_content_${propertyNumber}`}
                      fullWidth
                      multiline
                      minRows={4}
                      size="small"
                      defaultValue={getValue('contract_revision_content') || ''}
                      onBlur={(e) => {
                        if (e.target.value !== (getValue('contract_revision_content') || '')) {
                          handleFieldChange('contract_revision_content', e.target.value);
                        }
                      }}
                      placeholder="修正内容を入力してください"
                      error={!getValue('contract_revision_content')}
                      helperText={!getValue('contract_revision_content') ? '必須項目です' : ''}
                    />
                  </Grid>
                </Grid>
              )}
            </Box>
          )}

          {/* 山本マネージャーに確認: 今回確認OKに変更した場合のみ表示（過去データは対象外）、または既に済の場合は表示 */}
          {getValue('sales_contract_confirmed') === '確認OK' && (editedData.hasOwnProperty('sales_contract_confirmed') || getValue('manager_confirmation_done') === '済') && (
            <Box sx={{ bgcolor: '#fce4ec', borderRadius: 1, p: 1.5, mb: 1 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={4}>
                  <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>
                    山本マネージャーの契約書チェック*（必須）
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  {getValue('manager_confirmation_done') === '済' ? (
                    <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 700 }}>
                      ✓ 済（送信完了）
                    </Typography>
                  ) : (
                    <>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => {
                          // 保存前に必須チェック（manager_confirmation_done以外）
                          const contractRevisionExists = getValue('contract_revision_exists');
                          const contractRevisionContent = getValue('contract_revision_content');
                          const bindingScheduledDate = getValue('binding_scheduled_date');
                          if (!contractRevisionExists) {
                            alert('先に「契約書、重説他　修正点」を選択してください。');
                            return;
                          }
                          if (contractRevisionExists === 'あり' && !contractRevisionContent) {
                            alert('先に「契約書、重説他の修正内容」を入力してください。');
                            return;
                          }
                          if (!bindingScheduledDate) {
                            alert('先に「製本予定日」を入力してください。');
                            return;
                          }
                          // 「済」をセット（保存時にバックエンドがメール送信）
                          handleFieldChange('manager_confirmation_done', '済');
                        }}
                      >
                        済
                      </Button>
                      {!getValue('manager_confirmation_done') && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                          必須項目です（押すとメールが送信されます）
                        </Typography>
                      )}
                    </>
                  )}
                </Grid>
              </Grid>
            </Box>
          )}

          {/* 製本予定日: 売買契約確認=確認OKの場合は必須 */}
          {getValue('sales_contract_confirmed') === '確認OK' ? (
            <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
              <Grid item xs={4}>
                <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>
                  製本予定日*（必須）
                </Typography>
              </Grid>
              <Grid item xs={8}>
                <TextField
                  key={`binding_scheduled_date_${propertyNumber}`}
                  type="date"
                  size="small"
                  fullWidth
                  defaultValue={getValue('binding_scheduled_date') || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (getValue('binding_scheduled_date') || '')) {
                      handleFieldChange('binding_scheduled_date', e.target.value || null);
                    }
                  }}
                  error={!getValue('binding_scheduled_date')}
                  helperText={!getValue('binding_scheduled_date') ? '必須項目です' : ''}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          ) : (
            <EditableField label="製本予定日" field="binding_scheduled_date" type="date" />
          )}

          {/* 契約～決済までに事務担当者: 売買契約確認=確認OKの場合のみ表示・必須 */}
          {getValue('sales_contract_confirmed') === '確認OK' && (
            <Box sx={{ bgcolor: '#e8f5e9', borderRadius: 1, p: 1.5, mb: 1 }}>
              {/* 担当者選択（R/久/和/他） */}
              <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>
                    契約～決済担当者*（必須）
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <ButtonGroup size="small" variant="outlined">
                    {['R', '久', '和', '他'].map((opt) => (
                      <Button
                        key={opt}
                        variant={getValue('contract_to_settlement_admin_staff') === opt ? 'contained' : 'outlined'}
                        color={getValue('contract_to_settlement_admin_staff') === opt ? 'primary' : 'inherit'}
                        onClick={(e) => {
                          (e.currentTarget as HTMLButtonElement).blur();
                          const current = getValue('contract_to_settlement_admin_staff');
                          if (current === opt) {
                            handleFieldChange('contract_to_settlement_admin_staff', null);
                          } else {
                            handleFieldChange('contract_to_settlement_admin_staff', opt);
                            // 「他」以外に変更した場合は許可者をリセット
                            if (opt !== '他') {
                              handleFieldChange('contract_to_settlement_admin_approver', null);
                            }
                          }
                        }}
                      >
                        {opt}
                      </Button>
                    ))}
                  </ButtonGroup>
                  {!getValue('contract_to_settlement_admin_staff') && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                      必須項目です
                    </Typography>
                  )}
                </Grid>
              </Grid>

              {/* 「他」選択時：許可済み？（山本/国広） */}
              {getValue('contract_to_settlement_admin_staff') === '他' && (
                <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>
                      許可済み？*（必須）
                    </Typography>
                  </Grid>
                  <Grid item xs={8}>
                    <ButtonGroup size="small" variant="outlined">
                      {['山本', '国広'].map((opt) => (
                        <Button
                          key={opt}
                          variant={getValue('contract_to_settlement_admin_approver') === opt ? 'contained' : 'outlined'}
                          color={getValue('contract_to_settlement_admin_approver') === opt ? 'primary' : 'inherit'}
                          onClick={(e) => {
                            (e.currentTarget as HTMLButtonElement).blur();
                            handleFieldChange('contract_to_settlement_admin_approver', getValue('contract_to_settlement_admin_approver') === opt ? null : opt);
                          }}
                        >
                          {opt}
                        </Button>
                      ))}
                    </ButtonGroup>
                    {!getValue('contract_to_settlement_admin_approver') && (
                      <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                        必須項目です
                      </Typography>
                    )}
                  </Grid>
                </Grid>
              )}

              {/* 担当者（全社員から選択） */}
              <Grid container spacing={2} alignItems="center" sx={{ mb: 0.5 }}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>
                    担当者*（必須）
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {activeEmployees.map((emp) => (
                      <Button
                        key={emp.id}
                        size="small"
                        variant={getValue('contract_to_settlement_admin_person') === emp.name ? 'contained' : 'outlined'}
                        color={getValue('contract_to_settlement_admin_person') === emp.name ? 'primary' : 'inherit'}
                        onClick={(e) => {
                          (e.currentTarget as HTMLButtonElement).blur();
                          handleFieldChange('contract_to_settlement_admin_person', getValue('contract_to_settlement_admin_person') === emp.name ? null : emp.name);
                        }}
                        sx={{ minWidth: 'auto', px: 1 }}
                      >
                        {emp.name}
                      </Button>
                    ))}
                  </Box>
                  {!getValue('contract_to_settlement_admin_person') && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                      必須項目です
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </Box>
          )}

          <EditableField label="製本完了" field="binding_completed" type="date" />

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
                    <th style={{ border: '1px solid #e57373', padding: '6px 10px', textAlign: 'left', minWidth: '200px' }}>修正内容</th>
                    <th style={{ border: '1px solid #e57373', padding: '6px 10px', textAlign: 'left', minWidth: '180px' }}>対策案</th>
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
                      <td style={{ border: '1px solid #e0e0e0', padding: '6px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#c62828', fontWeight: 700 }}>
                        {row.contract_revision_content || '-'}
                      </td>
                      <td style={{ border: '1px solid #e0e0e0', padding: '6px 10px', color: '#c62828', fontWeight: 700 }}>
                        <CountermeasureCell
                          propertyNumber={row.property_number}
                          field="contract_revision_countermeasure"
                          value={row.contract_revision_countermeasure || ''}
                          onSaved={(val) => {
                            setContractRevisionSummary(prev => prev.map((r) => r.property_number === row.property_number ? { ...r, contract_revision_countermeasure: val } : r));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          )}
        </Box>
      </Box>

      {/* 右ペイン: 決済詳細 */}
      <Box ref={contractRightPaneRef} sx={{ flex: 1, p: 2, overflowY: isMobile ? 'visible' : 'auto', minHeight: 0 }}>
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
          {/* 仲介手数料（買）: 専任両手・一般両手・他社片手の場合のみ表示 */}
          {(() => {
            const ct = getValue('contract_type') || '';
            const showBuyer = ct === '専任両手' || ct === '一般両手' || ct === '他社片手';
            return showBuyer ? (
              <EditableField label="仲介手数料（買）" field="brokerage_fee_buyer" type="number" />
            ) : null;
          })()}
          {/* 通常仲介手数料（売）: 読み取り専用（売買価格から自動計算） */}
          <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
            <Grid item xs={4}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>通常仲介手数料（売）</Typography>
            </Grid>
            <Grid item xs={8}>
              <Typography variant="body2" sx={{ px: 1.5, py: 1, bgcolor: '#f5f5f5', borderRadius: 1, border: '1px solid #e0e0e0', color: 'text.secondary' }}>
                {getValue('standard_brokerage_fee_seller') != null && getValue('standard_brokerage_fee_seller') !== ''
                  ? Math.round(Number(getValue('standard_brokerage_fee_seller'))).toLocaleString()
                  : '—'}
              </Typography>
            </Grid>
          </Grid>
          {/* 通常仲介手数料（買）: 専任両手・一般両手・他社片手・自社含む の場合のみ表示（読み取り専用） */}
          {(() => {
            const ct = getValue('contract_type') || '';
            const showBuyer = ct === '専任両手' || ct === '一般両手' || ct === '他社片手' || ct.includes('自社');
            return showBuyer ? (
              <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>通常仲介手数料（買）</Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body2" sx={{ px: 1.5, py: 1, bgcolor: '#f5f5f5', borderRadius: 1, border: '1px solid #e0e0e0', color: 'text.secondary' }}>
                    {getValue('standard_brokerage_fee_buyer') != null && getValue('standard_brokerage_fee_buyer') !== ''
                      ? Math.round(Number(getValue('standard_brokerage_fee_buyer'))).toLocaleString()
                      : '—'}
                  </Typography>
                </Grid>
              </Grid>
            ) : null;
          })()}
          <EditableButtonSelect label="キャンペーン" field="campaign" options={['あり', 'なし']} />
          {/* 減額理由他: AND(売買契約締め日が入力済み かつ >2025/9/1, OR(仲介手数料（買）or（売）入力済み), OR(通常仲介手数料と異なる)) */}
          {(() => {
            const contractDate = getValue('sales_contract_deadline');
            const feeBuyer = getValue('brokerage_fee_buyer');
            const feeSeller = getValue('brokerage_fee_seller');
            const stdFeeBuyer = getValue('standard_brokerage_fee_buyer');
            const stdFeeSeller = getValue('standard_brokerage_fee_seller');
            // 条件1: 売買契約締め日が入力済み かつ 2025/9/1より後
            const cond1 = contractDate != null && contractDate !== '' && contractDate > '2025-09-01';
            // 条件2: 仲介手数料（買）または（売）のいずれかが入力済み
            const cond2 = (feeBuyer != null && feeBuyer !== '') || (feeSeller != null && feeSeller !== '');
            // 条件3: 通常仲介手数料（買）≠仲介手数料（買）または 通常仲介手数料（売）≠仲介手数料（売）
            const cond3 =
              (stdFeeBuyer != null && feeBuyer != null && feeBuyer !== '' && Math.round(Number(stdFeeBuyer)) !== Math.round(Number(feeBuyer))) ||
              (stdFeeSeller != null && feeSeller != null && feeSeller !== '' && Math.round(Number(stdFeeSeller)) !== Math.round(Number(feeSeller)));
            const isDiscountRequired = cond1 && cond2 && cond3;
            const isUnfilled = isDiscountRequired && !getValue('discount_reason_other');
            return (
              <EditableField
                label="減額理由他"
                field="discount_reason_other"
                multiline
                required={!!isDiscountRequired}
                highlight={!!isUnfilled}
              />
            );
          })()}
          <EditableButtonSelect label="売・支払方法" field="seller_payment_method" options={['振込', '現金', '他']} />
          {/* 買・支払方法: 専任両手・一般両手・他社片手の場合のみ表示 */}
          {(() => {
            const ct = getValue('contract_type') || '';
            const showBuyer = ct === '専任両手' || ct === '一般両手' || ct === '他社片手';
            return showBuyer ? (
              <EditableButtonSelect label="買・支払方法" field="buyer_payment_method" options={['振込', '現金', '他']} />
            ) : null;
          })()}
          {/* 入金確認（売）: 決済日>2025/10/20 かつ 決済完了チャット入力済みの場合は必須・ハイライト */}
          {(() => {
            const settlementDate = getValue('settlement_date');
            const settlementChat = getValue('settlement_completed_chat');
            const isRequired = settlementDate && settlementDate > '2025-10-20' && !!settlementChat;
            const isUnfilled = isRequired && !getValue('payment_confirmed_seller');
            return (
              <EditableButtonSelect
                label="入金確認（売）"
                field="payment_confirmed_seller"
                options={['確認済み', '未']}
                required={isRequired}
                highlight={isUnfilled}
              />
            );
          })()}
          {/* 入金確認（買）: 専任両手・一般両手・他社片手の場合のみ表示 */}
          {(() => {
            const ct = getValue('contract_type') || '';
            const showBuyer = ct === '専任両手' || ct === '一般両手' || ct === '他社片手';
            return showBuyer ? (
              <EditableButtonSelect label="入金確認（買）" field="payment_confirmed_buyer" options={['確認済み', '未']} />
            ) : null;
          })()}
          <EditableButtonSelect label="経理確認済み" field="accounting_confirmed" options={['未', '済']} />
        </Box>
        <Box sx={{ bgcolor: '#e8f5e9', borderRadius: 1, p: 1, mb: 1 }}>
          <EditableButtonSelect label="紹介チラシ渡し" field="referral_flyer_given" options={['OK', 'NG', '他']} />
          <EditableButtonSelect label="口コミ(売主)*" field="review_seller" options={['Google口コミ', 'アンケート用紙', 'NG', 'これから']} labelColor="error" />
          <EditableButtonSelect label="口コミ(買主)" field="review_buyer" options={['Google口コミ', 'アンケート用紙', 'NG', 'これから']} />
          <EditableField label="他コメント" field="other_comments" />
          {(() => {
            // 決済完了チャット必須条件:
            // 司法書士・紹介チラシ渡し・売支払方法・口コミ登録が全て入力済み かつ 決済日>=2025/6/27
            const settlementDate = getValue('settlement_date');
            const isSettlementChatRequired =
              !!getValue('judicial_scrivener') &&
              !!getValue('referral_flyer_given') &&
              !!getValue('seller_payment_method') &&
              !!settlementDate &&
              settlementDate >= '2025-06-27';
            const isSettlementChatUnfilled = isSettlementChatRequired && !getValue('settlement_completed_chat');
            return (
          <ChatSendButton
            label="決済完了チャット"
            field="settlement_completed_chat"
            chatType="settlement"
            required={isSettlementChatRequired}
            highlight={isSettlementChatUnfilled}
            buildMessage={() => {
              const pn = getValue('property_number') || propertyNumber || '';
              const addr = getValue('property_address') || '';
              const assignee = getValue('sales_assignee') || '';
              const reviewSeller = getValue('review_seller') || '';
              const reviewBuyer = getValue('review_buyer') || '';
              const referralFlyer = getValue('referral_flyer_given') || '';
              const campaign = getValue('campaign') || '';
              const brokerageSeller = getValue('brokerage_fee_seller') != null ? String(getValue('brokerage_fee_seller')) : '';
              const paymentSeller = getValue('seller_payment_method') || '';
              const brokerageBuyer = getValue('brokerage_fee_buyer') != null ? String(getValue('brokerage_fee_buyer')) : '';
              const paymentBuyer = getValue('buyer_payment_method') || '';
              const otherComments = getValue('other_comments') || '';
              const pageUrl = `${window.location.origin}/work-tasks`;
              return `決済おわりました
物件所在：${addr}
営業担当：${assignee}
口コミ売主:${reviewSeller}
口コミ買主:${reviewBuyer}
紹介チラシ渡し:${referralFlyer}
キャンペーン：${campaign}
仲介手数料（売）：${brokerageSeller}
支払方法（売）：${paymentSeller}
仲介手数料（買）：${brokerageBuyer}
買・支払方法：${paymentBuyer}
他コメント：${otherComments}
${pageUrl}`;
            }}
          />
            );
          })()}
          <EditableField label="台帳作成済み" field="ledger_created" type="date" />
          {/* 入金確認（売）: 決済日>2025/10/20 かつ 決済完了チャット入力済みの場合は必須・ハイライト */}
          {(() => {
            const settlementDate = getValue('settlement_date');
            const settlementChat = getValue('settlement_completed_chat');
            const isRequired = settlementDate && settlementDate > '2025-10-20' && !!settlementChat;
            const isUnfilled = isRequired && !getValue('payment_confirmed_seller');
            return (
              <EditableButtonSelect
                label="入金確認（売）"
                field="payment_confirmed_seller"
                options={['確認済み', '未']}
                required={isRequired}
                highlight={isUnfilled}
              />
            );
          })()}
          <EditableButtonSelect label="入金確認（買）" field="payment_confirmed_buyer" options={['確認済み', '未']} />
          {getValue('sales_assignee') === 'K' && (
            <ChatSendButton
              label="国広とチャット"
              field="kunihiro_chat"
              chatType="staff"
              staffName="国広"
              buildMessage={() => {
                const pn = getValue('property_number') || propertyNumber || '';
                const paymentSeller = getValue('payment_confirmed_seller') || '';
                const brokerageSeller = getValue('brokerage_fee_seller') != null ? String(getValue('brokerage_fee_seller')) : '';
                const sellerPaymentMethod = getValue('seller_payment_method') || '';
                const paymentBuyer = getValue('payment_confirmed_buyer') || '';
                const brokerageBuyer = getValue('brokerage_fee_buyer') != null ? String(getValue('brokerage_fee_buyer')) : '';
                const buyerPaymentMethod = getValue('buyer_payment_method') || '';
                const accountingConfirmed = getValue('accounting_confirmed') || '';
                const pageUrl = `${window.location.origin}/work-tasks`;
                return `経理確認しました
入金（売）の確認：${paymentSeller}
仲介手数料（売）：${brokerageSeller}
支払方法（売）：${sellerPaymentMethod}
入金（買）の確認：${paymentBuyer}
仲介手数料（買）：${brokerageBuyer}
買・支払方法：${buyerPaymentMethod}
経理確認：${accountingConfirmed}
${pageUrl}`;
              }}
            />
          )}
          {getValue('sales_assignee') === 'Y' && (
            <ChatSendButton
              label="山本へチャット送信"
              field="yamamoto_chat"
              chatType="staff"
              staffName="山本"
              buildMessage={() => {
                const pn = getValue('property_number') || propertyNumber || '';
                const paymentSeller = getValue('payment_confirmed_seller') || '';
                const brokerageSeller = getValue('brokerage_fee_seller') != null ? String(getValue('brokerage_fee_seller')) : '';
                const sellerPaymentMethod = getValue('seller_payment_method') || '';
                const paymentBuyer = getValue('payment_confirmed_buyer') || '';
                const brokerageBuyer = getValue('brokerage_fee_buyer') != null ? String(getValue('brokerage_fee_buyer')) : '';
                const buyerPaymentMethod = getValue('buyer_payment_method') || '';
                const accountingConfirmed = getValue('accounting_confirmed') || '';
                const pageUrl = `${window.location.origin}/work-tasks`;
                return `経理確認しました
入金（売）の確認：${paymentSeller}
仲介手数料（売）：${brokerageSeller}
支払方法（売）：${sellerPaymentMethod}
入金（買）の確認：${paymentBuyer}
仲介手数料（買）：${brokerageBuyer}
買・支払方法：${buyerPaymentMethod}
経理確認：${accountingConfirmed}
${pageUrl}`;
              }}
            />
          )}
          {getValue('sales_assignee') === 'U' && (
            <ChatSendButton
              label="裏へチャット送信"
              field="ura_chat"
              chatType="staff"
              staffName="裏"
              buildMessage={() => {
                const pn = getValue('property_number') || propertyNumber || '';
                const paymentSeller = getValue('payment_confirmed_seller') || '';
                const brokerageSeller = getValue('brokerage_fee_seller') != null ? String(getValue('brokerage_fee_seller')) : '';
                const sellerPaymentMethod = getValue('seller_payment_method') || '';
                const paymentBuyer = getValue('payment_confirmed_buyer') || '';
                const brokerageBuyer = getValue('brokerage_fee_buyer') != null ? String(getValue('brokerage_fee_buyer')) : '';
                const buyerPaymentMethod = getValue('buyer_payment_method') || '';
                const accountingConfirmed = getValue('accounting_confirmed') || '';
                const pageUrl = `${window.location.origin}/work-tasks`;
                return `経理確認しました
入金（売）の確認：${paymentSeller}
仲介手数料（売）：${brokerageSeller}
支払方法（売）：${sellerPaymentMethod}
入金（買）の確認：${paymentBuyer}
仲介手数料（買）：${brokerageBuyer}
買・支払方法：${buyerPaymentMethod}
経理確認：${accountingConfirmed}
${pageUrl}`;
              }}
            />
          )}
          {getValue('sales_assignee') === 'I' && (
            <ChatSendButton
              label="角井へチャット送信"
              field="kadoi_chat"
              chatType="staff"
              staffName="角井"
              buildMessage={() => {
                const pn = getValue('property_number') || propertyNumber || '';
                const paymentSeller = getValue('payment_confirmed_seller') || '';
                const brokerageSeller = getValue('brokerage_fee_seller') != null ? String(getValue('brokerage_fee_seller')) : '';
                const sellerPaymentMethod = getValue('seller_payment_method') || '';
                const paymentBuyer = getValue('payment_confirmed_buyer') || '';
                const brokerageBuyer = getValue('brokerage_fee_buyer') != null ? String(getValue('brokerage_fee_buyer')) : '';
                const buyerPaymentMethod = getValue('buyer_payment_method') || '';
                const accountingConfirmed = getValue('accounting_confirmed') || '';
                const pageUrl = `${window.location.origin}/work-tasks`;
                return `経理確認しました
入金（売）の確認：${paymentSeller}
仲介手数料（売）：${brokerageSeller}
支払方法（売）：${sellerPaymentMethod}
入金（買）の確認：${paymentBuyer}
仲介手数料（買）：${brokerageBuyer}
買・支払方法：${buyerPaymentMethod}
経理確認：${accountingConfirmed}
${pageUrl}`;
              }}
            />
          )}
        </Box>
      </Box>
    </Box>
  );

  // Email送信履歴取得（親stateを使用）
  useEffect(() => {
    if (!propertyNumber) return;
    setEmailHistoryLoading(true);
    api.get(`/api/work-tasks/${propertyNumber}/email-history`)
      .then(res => setEmailHistory(res.data.emailHistory || []))
      .catch(() => setEmailHistory([]))
      .finally(() => setEmailHistoryLoading(false));
  }, [propertyNumber, emailHistoryRefreshKey]);

  // 売主、買主詳細セクション（関数呼び出し形式で再マウントを防ぐ）
  const renderSellerBuyerDetailSection = () => (
    <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: isMobile ? 'auto' : '100%', overflow: isMobile ? 'visible' : 'hidden', width: '100%' }}>
      {/* 左ペイン: 契約後フィールド + Email送信履歴 */}
      <Box sx={{ width: isMobile ? '100%' : 320, minWidth: isMobile ? 0 : 260, overflowY: isMobile ? 'visible' : 'auto', bgcolor: '#f8f9fa', display: 'flex', flexDirection: 'column', borderRight: isMobile ? 'none' : '1px solid #e0e0e0', borderTop: isMobile ? '2px solid #e0e0e0' : 'none', order: isMobile ? 2 : 1 }}>
        {/* 契約後　司法書士へのメール */}
        <Box sx={{ p: 1.5, borderBottom: '1px solid #e0e0e0', bgcolor: '#fff3e0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#e65100' }}>
              契約後　司法書士へのメール
            </Typography>
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              startIcon={saving ? <CircularProgress size={12} /> : <SaveIcon sx={{ fontSize: '0.85rem !important' }} />}
              sx={{
                minWidth: 0,
                px: 1,
                py: 0.3,
                fontSize: '0.7rem',
                lineHeight: 1.4,
                ...(hasChanges && !saving ? {
                  animation: 'pulse-save 1s ease-in-out infinite',
                  '@keyframes pulse-save': {
                    '0%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.7)' },
                    '70%': { boxShadow: '0 0 0 8px rgba(25, 118, 210, 0)' },
                    '100%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0)' },
                  },
                } : {}),
              }}
            >
              {saving ? '保存中' : '保存'}
            </Button>
          </Box>
          <ButtonGroup size="small" variant="outlined" fullWidth>
            {['済', '不要'].map((opt) => (
              <Button
                key={opt}
                variant={getValue('judicial_scrivener_email_after_contract') === opt ? 'contained' : 'outlined'}
                color={getValue('judicial_scrivener_email_after_contract') === opt ? 'warning' : 'inherit'}
                onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange('judicial_scrivener_email_after_contract', getValue('judicial_scrivener_email_after_contract') === opt ? null : opt); }}
              >
                {opt}
              </Button>
            ))}
          </ButtonGroup>
        </Box>
        {/* 決済前、売主金種表連絡メール */}
        <Box sx={{ p: 1.5, borderBottom: '1px solid #e0e0e0', bgcolor: '#e8f5e9' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#2e7d32', display: 'block', mb: 0.5 }}>
            決済前、売主金種表連絡メール
          </Typography>
          <ButtonGroup size="small" variant="outlined" fullWidth>
            {['済', '不要'].map((opt) => (
              <Button
                key={opt}
                variant={getValue('settlement_seller_denomination_email') === opt ? 'contained' : 'outlined'}
                color={getValue('settlement_seller_denomination_email') === opt ? 'success' : 'inherit'}
                onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange('settlement_seller_denomination_email', getValue('settlement_seller_denomination_email') === opt ? null : opt); }}
              >
                {opt}
              </Button>
            ))}
          </ButtonGroup>
        </Box>
        {/* 決済前、買主金種表連絡メール */}
        <Box sx={{ p: 1.5, borderBottom: '1px solid #e0e0e0', bgcolor: '#e3f2fd' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#1565c0', display: 'block', mb: 0.5 }}>
            決済前、買主金種表連絡メール
          </Typography>
          <ButtonGroup size="small" variant="outlined" fullWidth>
            {['済', '不要'].map((opt) => (
              <Button
                key={opt}
                variant={getValue('settlement_buyer_denomination_email') === opt ? 'contained' : 'outlined'}
                color={getValue('settlement_buyer_denomination_email') === opt ? 'primary' : 'inherit'}
                onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange('settlement_buyer_denomination_email', getValue('settlement_buyer_denomination_email') === opt ? null : opt); }}
              >
                {opt}
              </Button>
            ))}
          </ButtonGroup>
        </Box>
        {/* Email送信履歴ヘッダー */}
        <Box sx={{ p: 1.5, borderBottom: '1px solid #e0e0e0', bgcolor: '#fff', position: isMobile ? 'static' : 'sticky', top: isMobile ? undefined : 0, zIndex: isMobile ? undefined : 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1565c0', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <EmailIcon sx={{ fontSize: '1rem' }} />
            Email送信履歴
          </Typography>
        </Box>
        <Box sx={{ flex: 1, p: 1 }}>
          {emailHistoryLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : emailHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 1.5, textAlign: 'center' }}>
              送信履歴はありません
            </Typography>
          ) : (
            emailHistory.map((record) => (
              <Box
                key={record.id}
                onClick={() => setSelectedEmailRecord(record)}
                sx={{
                  mb: 1,
                  p: 1.5,
                  bgcolor: '#fff',
                  borderRadius: 1,
                  border: '1px solid #e0e0e0',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: '#e3f2fd', borderColor: '#1565c0' },
                }}
              >
                <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 0.5 }}>
                  {new Date(record.sentAt).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Typography>
                {record.templateName && (
                  <Typography variant="caption" sx={{ display: 'inline-block', bgcolor: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', px: 0.8, py: 0.2, mb: 0.5, fontWeight: 600, fontSize: '0.7rem' }}>
                    {record.templateName}
                  </Typography>
                )}
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {record.subject || '（件名なし）'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#666' }}>
                  送信者: {record.senderName || record.senderInitials || record.senderEmail || '-'}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      </Box>

      {/* 右ペイン: 売主・買主詳細 */}
      <Box ref={sellerBuyerRightPaneRef} sx={{ flex: 1, minWidth: 0, overflowY: isMobile ? 'visible' : 'auto', overflowX: 'hidden', p: 2, order: isMobile ? 1 : 2 }}>
      {/* 司法書士へのメール */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel sx={{ color: '#6a1b9a', '&.Mui-focused': { color: '#6a1b9a' } }}>司法書士へのメール</InputLabel>
          <Select
            value=""
            label="司法書士へのメール"
            onChange={(e) => handleEmailTemplateSelect(e.target.value as string, 'judicial_scrivener')}
            sx={{
              bgcolor: '#f3e5f5',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#ce93d8', borderWidth: 2 },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6a1b9a' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#6a1b9a' },
              fontWeight: 700,
              color: '#6a1b9a',
            }}
          >
            {JUDICIAL_SCRIVENER_EMAIL_TEMPLATES.map(t => (
              <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#2e7d32' }}>【売主情報】</Typography>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel sx={{ color: '#2e7d32', '&.Mui-focused': { color: '#2e7d32' } }}>売主へEmail</InputLabel>
          <Select
            value=""
            label="売主へEmail"
            onChange={(e) => handleEmailTemplateSelect(e.target.value as string, 'seller')}
            sx={{
              bgcolor: '#e8f5e9',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#66bb6a', borderWidth: 2 },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2e7d32' },
              fontWeight: 700,
              color: '#2e7d32',
            }}
          >
            {SELLER_EMAIL_TEMPLATES.map(t => (
              <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <EditableField label="売主名前" field="seller_contact_name" />
      <EditableField label="売主メアド" field="seller_contact_email" />
      <EditableField label="売主TEL" field="seller_contact_tel" />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, mt: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1565c0' }}>【買主情報】</Typography>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel sx={{ color: '#1565c0', '&.Mui-focused': { color: '#1565c0' } }}>買主へEmail</InputLabel>
          <Select
            value=""
            label="買主へEmail"
            onChange={(e) => handleEmailTemplateSelect(e.target.value as string, 'buyer')}
            sx={{
              bgcolor: '#e3f2fd',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#64b5f6', borderWidth: 2 },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1565c0' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1565c0' },
              fontWeight: 700,
              color: '#1565c0',
            }}
          >
            {BUYER_EMAIL_TEMPLATES.map(t => (
              <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <EditableField label="買主名前" field="buyer_contact_name" />
      <EditableField label="買主メアド" field="buyer_contact_email" />
      <EditableField label="買主TEL" field="buyer_contact_tel" />

      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#e65100', mb: 1, mt: 2 }}>【ローン情報】</Typography>
      <EditableField label="ローン" field="loan" />
      <EditableField label="金融機関名" field="financial_institution" />

      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#6a1b9a', mb: 1, mt: 2 }}>【日程】</Typography>
      <EditableField label="引き渡し予定" field="delivery_scheduled_date" type="date" />
      <EditableField label="融資承認予定日" field="loan_approval_scheduled_date" type="date" />

      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#37474f', mb: 1, mt: 2 }}>【司法書士・仲介業者情報】</Typography>
      <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
        <Grid item xs={4}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>司法書士</Typography>
        </Grid>
        <Grid item xs={8}>
          <ButtonGroup size="small" variant="outlined">
            {['司法書士法人中央ライズアクロス', '他'].map((opt) => (
              <Button
                key={opt}
                variant={getValue('judicial_scrivener') === opt ? 'contained' : 'outlined'}
                color={getValue('judicial_scrivener') === opt ? 'primary' : 'inherit'}
                onClick={(e) => {
                  (e.currentTarget as HTMLButtonElement).blur();
                  const newVal = getValue('judicial_scrivener') === opt ? null : opt;
                  handleFieldChange('judicial_scrivener', newVal);
                  // 連絡先を自動設定
                  handleFieldChange(
                    'judicial_scrivener_contact',
                    newVal === '司法書士法人中央ライズアクロス' ? 'naruse@riseacross.com' : null
                  );
                }}
              >
                {opt}
              </Button>
            ))}
          </ButtonGroup>
        </Grid>
      </Grid>
      <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
        <Grid item xs={4}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>司法書士連絡先</Typography>
        </Grid>
        <Grid item xs={8}>
          <Typography variant="body2" sx={{ py: 0.5 }}>
            {getValue('judicial_scrivener_contact') ||
              (getValue('judicial_scrivener') === '司法書士法人中央ライズアクロス' ? 'naruse@riseacross.com' : '')}
          </Typography>
        </Grid>
      </Grid>
      <EditableField label="仲介業者" field="broker" />
      <EditableField label="仲介業者担当連絡先" field="broker_contact" />
      </Box>

      {/* Email本文モーダル */}
      <Dialog open={!!selectedEmailRecord} onClose={() => setSelectedEmailRecord(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {selectedEmailRecord?.subject || '（件名なし）'}
            </Typography>
            {selectedEmailRecord?.templateName && (
              <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 600 }}>
                {selectedEmailRecord.templateName}
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => setSelectedEmailRecord(null)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary">
              送信日時: {selectedEmailRecord ? new Date(selectedEmailRecord.sentAt).toLocaleString('ja-JP') : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              送信者: {selectedEmailRecord?.senderName || selectedEmailRecord?.senderInitials || selectedEmailRecord?.senderEmail || '-'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              宛先: {selectedEmailRecord?.recipientEmail || '-'}
            </Typography>
          </Box>
          {selectedEmailRecord?.body ? (
            <Box
              sx={{ fontSize: '0.875rem', lineHeight: 1.7, '& *': { maxWidth: '100%' } }}
              dangerouslySetInnerHTML={{ __html: selectedEmailRecord.body }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">本文なし</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedEmailRecord(null)} color="inherit">閉じる</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );

  const tabLabels = ['媒介契約', 'サイト登録', '契約決済', '売主、買主詳細'];

  return (
    <>
      <Dialog
          open={open}
          onClose={onClose}
          fullScreen
          PaperProps={{ sx: { display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
        >
        <DialogTitle sx={{ p: 1, pb: 0 }}>
          {isMobile ? (
            /* スマホ: コンパクトな1行ヘッダー */
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 0 }}>
              {/* 業務一覧ボタン */}
              <Button
                variant="contained"
                size="small"
                onClick={onClose}
                sx={{ bgcolor: '#8e24aa', '&:hover': { bgcolor: '#6a1b9a' }, fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.75rem', px: 1, py: 0.5, minWidth: 0 }}
              >
                一覧
              </Button>
              {/* 物件番号 */}
              <Box
                onClick={() => {
                  navigator.clipboard.writeText(propertyNumber || '');
                  setCopiedPropertyNumber(true);
                  setTimeout(() => setCopiedPropertyNumber(false), 2000);
                }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
                  px: 1, py: 0.4,
                  bgcolor: copiedPropertyNumber ? '#e8f5e9' : '#f5f5f5',
                  border: `1px solid ${copiedPropertyNumber ? '#66bb6a' : '#ddd'}`,
                  borderRadius: 1, fontWeight: 700, fontSize: '0.95rem',
                  userSelect: 'all', whiteSpace: 'nowrap',
                }}
                title="クリックでコピー"
              >
                {copiedPropertyNumber ? 'コピー！' : (propertyNumber || '')}
                {copiedPropertyNumber
                  ? <CheckIcon sx={{ fontSize: '0.85rem', color: '#2e7d32' }} />
                  : <ContentCopyIcon sx={{ fontSize: '0.85rem', color: '#1565c0', opacity: 0.7 }} />
                }
              </Box>
              {/* 物件住所（省略表示） */}
              {data?.property_address && (
                <Typography sx={{ fontSize: '0.75rem', color: '#1565c0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                  {data.property_address}
                </Typography>
              )}
              {/* スプシボタン */}
              {(tabIndex === 0 || tabIndex === 1) && (
                <Button variant="outlined" size="small" disabled={!getValue('spreadsheet_url')}
                  onClick={() => {
                    const rawUrl = getValue('spreadsheet_url');
                    if (rawUrl) {
                      const targetGid = tabIndex === 0 ? '1819926492' : '1725934947';
                      const base = rawUrl.split('#')[0].split('?')[0];
                      window.open(base + '?gid=' + targetGid + '#gid=' + targetGid, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  sx={{ whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.75rem', px: 1, py: 0.4, minWidth: 0 }}
                >スプシ</Button>
              )}
              {(tabIndex === 2 || tabIndex === 3) && (
                <Button variant="contained" size="small" disabled={!getValue('spreadsheet_url')}
                  onClick={() => { const url = getValue('spreadsheet_url'); if (url) window.open(buildLedgerSheetUrl(url), '_blank', 'noopener,noreferrer'); }}
                  sx={{ whiteSpace: 'nowrap', fontWeight: 700, bgcolor: '#1e8e3e', '&:hover': { bgcolor: '#166d30' }, fontSize: '0.75rem', px: 1, py: 0.4, minWidth: 0 }}
                >スプシ</Button>
              )}
              <IconButton onClick={onClose} size="small" sx={{ p: 0.5 }}><CloseIcon fontSize="small" /></IconButton>
            </Box>
          ) : (
            /* PC: 従来のヘッダー */
            <>
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
                    onClick={() => {
                      navigator.clipboard.writeText(propertyNumber || '');
                      setCopiedPropertyNumber(true);
                      setTimeout(() => setCopiedPropertyNumber(false), 2000);
                    }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
                      px: 1.5, py: 0.5,
                      bgcolor: copiedPropertyNumber ? '#e8f5e9' : '#f5f5f5',
                      border: `1px solid ${copiedPropertyNumber ? '#66bb6a' : '#ddd'}`,
                      borderRadius: 1, fontWeight: 700, fontSize: '1.1rem',
                      userSelect: 'all', whiteSpace: 'nowrap', transition: 'all 0.2s',
                      '&:hover': { bgcolor: copiedPropertyNumber ? '#e8f5e9' : '#e3f2fd', borderColor: copiedPropertyNumber ? '#66bb6a' : '#1565c0' },
                      '&:active': { bgcolor: '#bbdefb' },
                    }}
                    title="クリックでコピー"
                  >
                    {copiedPropertyNumber ? 'コピーしました！' : (propertyNumber || '')}
                    {copiedPropertyNumber
                      ? <CheckIcon sx={{ fontSize: '1rem', color: '#2e7d32' }} />
                      : <ContentCopyIcon sx={{ fontSize: '1rem', color: '#1565c0', opacity: 0.7 }} />
                    }
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflowX: 'auto', flexShrink: 1, flexWrap: 'nowrap' }}>
                    {data?.property_address && (
                      <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f5f5f5', borderRadius: '6px', px: 1.2, py: 0.4, border: '1px solid #e0e0e0', whiteSpace: 'nowrap' }}>
                        <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#1565c0', mr: 0.5, textDecoration: 'underline', textDecorationColor: '#90caf9' }}>物件住所</Typography>
                        <Typography component="span" sx={{ fontSize: '0.85rem', color: '#212121', fontWeight: 500 }}>{data.property_address}</Typography>
                      </Box>
                    )}
                    {data?.property_type && (
                      <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f5f5f5', borderRadius: '6px', px: 1.2, py: 0.4, border: '1px solid #e0e0e0', whiteSpace: 'nowrap' }}>
                        <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#1565c0', mr: 0.5, textDecoration: 'underline', textDecorationColor: '#90caf9' }}>種別</Typography>
                        <Typography component="span" sx={{ fontSize: '0.85rem', color: '#212121', fontWeight: 500 }}>{data.property_type}</Typography>
                      </Box>
                    )}
                    {data?.seller_name && (
                      <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f5f5f5', borderRadius: '6px', px: 1.2, py: 0.4, border: '1px solid #e0e0e0', whiteSpace: 'nowrap' }}>
                        <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#1565c0', mr: 0.5, textDecoration: 'underline', textDecorationColor: '#90caf9' }}>売主氏名</Typography>
                        <Typography component="span" sx={{ fontSize: '0.85rem', color: '#212121', fontWeight: 500 }}>{data.seller_name}</Typography>
                      </Box>
                    )}
                    {data?.sales_assignee && (
                      <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f5f5f5', borderRadius: '6px', px: 1.2, py: 0.4, border: '1px solid #e0e0e0', whiteSpace: 'nowrap' }}>
                        <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#1565c0', mr: 0.5, textDecoration: 'underline', textDecorationColor: '#90caf9' }}>担当名</Typography>
                        <Typography component="span" sx={{ fontSize: '0.85rem', color: '#212121', fontWeight: 500 }}>{data.sales_assignee}</Typography>
                      </Box>
                    )}
                    {data?.mediation_type && (
                      <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f5f5f5', borderRadius: '6px', px: 1.2, py: 0.4, border: '1px solid #e0e0e0', whiteSpace: 'nowrap' }}>
                        <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#1565c0', mr: 0.5, textDecoration: 'underline', textDecorationColor: '#90caf9' }}>媒介</Typography>
                        <Typography component="span" sx={{ fontSize: '0.85rem', color: '#212121', fontWeight: 500 }}>{data.mediation_type}</Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
                {/* スプシボタン: tabIndex=0（媒介契約）または tabIndex=1（サイト登録）のとき */}
                {(tabIndex === 0 || tabIndex === 1) && (
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={!getValue('spreadsheet_url')}
                    onClick={() => {
                      const rawUrl = getValue('spreadsheet_url');
                      if (rawUrl) {
                        const targetGid = tabIndex === 0 ? '1819926492' : '1725934947';
                        const base = rawUrl.split('#')[0].split('?')[0];
                        window.open(base + '?gid=' + targetGid + '#gid=' + targetGid, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}
                  >
                    スプシ
                  </Button>
                )}
                {(tabIndex === 2 || tabIndex === 3) && (
                  <Button
                    variant="contained"
                    size="small"
                    disabled={!getValue('spreadsheet_url')}
                    onClick={() => {
                      const url = getValue('spreadsheet_url');
                      if (url) {
                        window.open(buildLedgerSheetUrl(url), '_blank', 'noopener,noreferrer');
                      }
                    }}
                    sx={{ whiteSpace: 'nowrap', fontWeight: 700, bgcolor: '#1e8e3e', '&:hover': { bgcolor: '#166d30' }, fontSize: '0.85rem', px: 1.5 }}
                  >
                    スプシ
                  </Button>
                )}
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
              </Box>
            </>
          )}
        </DialogTitle>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          {isMobile ? (
            /* スマホ: プルダウン選択 */
            <FormControl fullWidth size="small" sx={{ my: 1 }}>
              <Select
                value={tabIndex}
                onChange={(e) => setTabIndex(Number(e.target.value))}
                sx={{
                  fontWeight: 700,
                  bgcolor: [
                    '#2e7d32', '#1565c0', '#e65100', '#6a1b9a'
                  ][tabIndex],
                  color: '#fff',
                  '& .MuiSelect-icon': { color: '#fff' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                }}
              >
                {tabLabels.map((label, index) => (
                  <MenuItem key={index} value={index} sx={{ fontWeight: 600 }}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            /* PC: 従来のタブ */
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
          )}
        </Box>
        <DialogContent sx={{ p: 0, flex: (tabIndex === 3 && isMobile) ? 'none' : 1, overflow: (tabIndex === 3 && !isMobile) ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', minHeight: (tabIndex === 3 && isMobile) ? 'unset' : 0 }}>
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
              {tabIndex === 0 && renderMediationSection()}
              {tabIndex === 1 && (
                isMobile
                  ? <Box sx={{ display: 'flex', flexDirection: 'column' }}><SiteRegistrationSection cwCounts={cwCounts} leftPaneRef={leftPaneRef} rightPaneRef={rightPaneRef} /></Box>
                  : <SiteRegistrationSection cwCounts={cwCounts} leftPaneRef={leftPaneRef} rightPaneRef={rightPaneRef} />
              )}
              {tabIndex === 2 && renderContractSettlementSection()}
              {tabIndex === 3 && <Box sx={isMobile ? { width: '100%' } : { flex: 1, display: 'flex', minHeight: 0, height: '100%', width: '100%', overflow: 'hidden' }}>{renderSellerBuyerDetailSection()}</Box>}
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
      {/* athome内覧前伝達事項確認ポップアップ */}
      <Dialog open={athomePreVisitDialog} onClose={() => setAthomePreVisitDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: '#d32f2f', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          ⚠️ 入力が必要な項目があります
        </DialogTitle>
        <DialogContent sx={{ pt: 2, pb: 1 }}>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>
            「スプシathomeの内覧前伝達事項●●の表示を消しましたか？」が未入力です。
          </Typography>
          <Typography variant="body2" color="text.secondary">
            「はい」を選択してから保存してください。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 2, gap: 1 }}>
          <Button
            onClick={() => setAthomePreVisitDialog(false)}
            color="inherit"
            variant="outlined"
          >
            閉じる
          </Button>
          <Button
            onClick={() => {
              setAthomePreVisitDialog(false);
              // サイト登録タブ（tabIndex=1）に切り替えてから左ペインを一番下にスクロール
              requestAnimationFrame(() => {
                if (leftPaneRef.current) {
                  leftPaneRef.current.scrollTop = leftPaneRef.current.scrollHeight;
                }
              });
            }}
            color="error"
            variant="contained"
            sx={{ fontWeight: 700 }}
          >
            入力する
          </Button>
        </DialogActions>
      </Dialog>
      <CadastralMapWarningDialog
        open={validationWarningDialog.open && validationWarningDialog.onConfirmAction === 'cadastral'}
        onConfirm={handleValidationWarningConfirm}
        onCancel={handleValidationWarningCancel}
      />
      <ValidationWarningDialog
        open={validationWarningDialog.open && validationWarningDialog.onConfirmAction !== 'cadastral'}
        title={validationWarningDialog.title}
        emptyFields={validationWarningDialog.emptyFields}
        onConfirm={handleValidationWarningConfirm}
        onCancel={handleValidationWarningCancel}
        isMandatory={validationWarningDialog.onConfirmAction === 'mandatory' || validationWarningDialog.onConfirmAction === 'binding_completed'}
      />
      <MediationFormatWarningDialog
        open={mediationFormatWarningDialog.open}
        onConfirm={() => { setMediationFormatWarningDialog({ open: false }); executeSave(); }}
      />

      {/* Email送信確認ダイアログ */}
      <Dialog open={emailDialog.open} onClose={handleCancelEmailSend} maxWidth="sm" fullWidth>
        <DialogTitle>
          {emailDialog.type === 'seller' ? '売主へEmail送信確認' : emailDialog.type === 'buyer' ? '買主へEmail送信確認' : '司法書士へEmail送信確認'}
        </DialogTitle>
        <DialogContent>
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', color: 'success.main' }}>
              {emailDialog.templateLabel}
            </Typography>

            <Box sx={{ mt: 2, mb: 2 }}>
              <SenderAddressSelector
                value={senderAddress}
                onChange={handleSenderAddressChange}
                employees={activeEmployees}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                label="送信先"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                size="small"
                type="email"
                error={!emailRecipient}
                helperText={!emailRecipient ? '⚠️ 送信先メールアドレスが未入力です。入力してから送信してください。' : ''}
                sx={!emailRecipient ? {
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#fff3e0',
                    '& fieldset': { borderColor: '#f44336', borderWidth: 2 },
                    '&:hover fieldset': { borderColor: '#d32f2f' },
                  },
                  '& .MuiInputLabel-root': { color: '#f44336' },
                } : {}}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                label="件名"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                size="small"
              />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                本文
              </Typography>
              <RichTextEmailEditor
                value={emailBody}
                onChange={setEmailBody}
                placeholder="メール本文を入力..."
                helperText="Ctrl+Vで画像を貼り付けられます"
              />
            </Box>

            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<ImageIcon />}
                onClick={() => setImageSelectorOpen(true)}
                fullWidth
              >
                画像を添付
              </Button>
              {selectedImages.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Alert severity="success">{selectedImages.length}枚の画像が選択されました</Alert>
                </Box>
              )}
              {imageError && (
                <Alert severity="error" sx={{ mt: 1 }}>{imageError}</Alert>
              )}
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              この内容でメールを送信します。よろしいですか？
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelEmailSend} color="inherit">キャンセル</Button>
          <Button
            onClick={handleConfirmEmailSend}
            variant="contained"
            color="primary"
            disabled={sendingEmail || !emailRecipient}
          >
            {sendingEmail ? <CircularProgress size={20} /> : '送信'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 画像選択モーダル */}
      <ImageSelectorModal
        open={imageSelectorOpen}
        onConfirm={(images: any[]) => { setSelectedImages(images); setImageSelectorOpen(false); setImageError(null); }}
        onCancel={() => setImageSelectorOpen(false)}
      />
    </>
  );
}
