import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowBack as ArrowBackIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import {
  Container,
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import api from '../services/api';
import { SECTION_COLORS } from '../theme/sectionColors';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';
import { uploadFileToStorage, toggleStaff } from '../utils/sharedItemFormUtils';
import { useSharedItemPresenceTrack } from '../hooks/useListPresence';

// チームアンサーの型（契約率チーム・物件数チーム専用）
interface TeamAnswers {
  question: string;
  answer_kuniHiro: string;
  answer_yamamoto: string;
  answer_ura: string;
  answer_kadoi: string;
  answer_hayashida: string;
  answer_aso: string;
  summary: string;
}

const TEAM_ANSWER_MEMBERS: { key: keyof TeamAnswers; label: string }[] = [
  { key: 'answer_kuniHiro', label: '国広' },
  { key: 'answer_yamamoto', label: '山本' },
  { key: 'answer_ura', label: '裏' },
  { key: 'answer_kadoi', label: '角井' },
  { key: 'answer_hayashida', label: '林田' },
  { key: 'answer_aso', label: '麻生' },
];

const TEAM_MODES = ['契約率チーム', '物件数チーム'];

const EMPTY_TEAM_ANSWERS: TeamAnswers = {
  question: '',
  answer_kuniHiro: '',
  answer_yamamoto: '',
  answer_ura: '',
  answer_kadoi: '',
  answer_hayashida: '',
  answer_aso: '',
  summary: '',
};

interface SharedItem {
  id: string;
  [key: string]: any;
}

interface Staff {
  name: string;
  initials: string;
  is_active: boolean;
}

interface NewFile {
  file: File;
  name: string;
  comment?: string;
}

export default function SharedItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // プレゼンス発信（この共有項目を開いていることを他ユーザーに通知）
  useSharedItemPresenceTrack(id);
  const fromLocation = (location.state as { fromLocation?: string | null })?.fromLocation ?? null;
  const color = SECTION_COLORS.sharedItems;
  const [item, setItem] = useState<SharedItem | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 編集可能フィールド
  const [content, setContent] = useState('');
  const [sharingDate, setSharingDate] = useState('');
  const [confirmationDate, setConfirmationDate] = useState('');
  const [staffNotShared, setStaffNotShared] = useState<string[]>([]);

  // 追加ファイル
  const [newPdfs, setNewPdfs] = useState<NewFile[]>([]);
  const [newImages, setNewImages] = useState<NewFile[]>([]);

  // 画像コメント（既存画像用）
  const [imageComments, setImageComments] = useState<Record<number, string>>({});
  const [initialImageComments, setInitialImageComments] = useState<Record<number, string>>({});

  // チームアンサー（契約率チーム・物件数チーム専用、DB保存）
  const [teamAnswers, setTeamAnswers] = useState<TeamAnswers>(EMPTY_TEAM_ANSWERS);
  const [initialTeamAnswers, setInitialTeamAnswers] = useState<TeamAnswers>(EMPTY_TEAM_ANSWERS);
  const [teamAnswerSaving, setTeamAnswerSaving] = useState(false);
  const [teamAnswerSuccess, setTeamAnswerSuccess] = useState(false);
  const [teamAnswerError, setTeamAnswerError] = useState('');

  // 削除確認ダイアログ（契約率チーム・物件数チーム専用）
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // 完了ボタン・次へボタン
  const [completing, setCompleting] = useState(false);
  const [navigatingNext, setNavigatingNext] = useState(false);
  const [finishedDialogOpen, setFinishedDialogOpen] = useState(false);

  // 初期値（変更検知用）
  const [initialContent, setInitialContent] = useState('');
  const [initialSharingDate, setInitialSharingDate] = useState('');
  const [initialConfirmationDate, setInitialConfirmationDate] = useState('');
  const [initialStaffNotShared, setInitialStaffNotShared] = useState('');

  useEffect(() => {
    // idが変わったら古いデータをリセット
    setItem(null);
    setContent('');
    setSharingDate('');
    setConfirmationDate('');
    setStaffNotShared([]);
    setNewPdfs([]);
    setNewImages([]);
    setImageComments({});
    setInitialImageComments({});
    setTeamAnswers(EMPTY_TEAM_ANSWERS);
    setInitialTeamAnswers(EMPTY_TEAM_ANSWERS);
    fetchItem();
    fetchStaff();
  }, [id]);

  const fetchItem = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/shared-items');
      const items = response.data.data || [];
      const foundItem = items.find((i: SharedItem) => i.id === id);
      if (foundItem) {
        setItem(foundItem);
        const sd = foundItem['共有日'] || '';
        const cd = foundItem['確認日'] || '';
        const sns = foundItem['共有できていない'] || '';
        const ct = foundItem['内容'] || '';
        setSharingDate(sd);
        setConfirmationDate(cd);
        setStaffNotShared(sns ? sns.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
        setContent(ct);
        setInitialSharingDate(sd);
        setInitialConfirmationDate(cd);
        setInitialStaffNotShared(sns);
        setInitialContent(ct);

        // 画像コメントを読み込み（DBから取得）
        try {
          const commentResponse = await api.get(`/api/shared-items/${foundItem.id}/image-comments`);
          const comments: Record<number, string> = commentResponse.data.data || {};
          setImageComments(comments);
          setInitialImageComments({ ...comments });
        } catch (commentError) {
          console.error('Failed to fetch image comments:', commentError);
          // コメント取得失敗時は空のオブジェクトを設定
          setImageComments({});
          setInitialImageComments({});
        }

        // 画像5〜10をDBから読み込み
        try {
          const imagesResponse = await api.get(`/api/shared-items/${foundItem.id}/images`);
          const dbImages: Record<number, string> = imagesResponse.data.data || {};
          // DBから取得した画像5〜10をfoundItemにマージ
          Object.entries(dbImages).forEach(([num, url]) => {
            const key = `画像${num === '5' ? '５' : num === '6' ? '６' : num === '7' ? '７' : num === '8' ? '８' : num === '9' ? '９' : '１０'}`;
            foundItem[key] = url;
          });
        } catch (imageError) {
          console.error('Failed to fetch images 5-10:', imageError);
        }

        // 契約率チーム・物件数チームの場合はチームアンサーも取得
        if (TEAM_MODES.includes(foundItem['共有場'])) {
          fetchTeamAnswers(foundItem.id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch shared item:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamAnswers = async (itemId: string) => {
    try {
      const response = await api.get(`/api/shared-items/${itemId}/team-answers`);
      const data = response.data.data;
      if (data) {
        const answers: TeamAnswers = {
          question: data.question || '',
          answer_kuniHiro: data.answer_kunihiro || data.answer_kuniHiro || '',
          answer_yamamoto: data.answer_yamamoto || '',
          answer_ura: data.answer_ura || '',
          answer_kadoi: data.answer_kadoi || '',
          answer_hayashida: data.answer_hayashida || '',
          answer_aso: data.answer_aso || '',
          summary: data.summary || '',
        };
        setTeamAnswers(answers);
        setInitialTeamAnswers(answers);
      }
    } catch (error) {
      console.error('Failed to fetch team answers:', error);
    }
  };

  const handleTeamAnswerChange = useCallback((key: keyof TeamAnswers, value: string) => {
    setTeamAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleTeamAnswerSave = async () => {
    if (!item) return;
    setTeamAnswerSaving(true);
    setTeamAnswerError('');
    setTeamAnswerSuccess(false);
    try {
      await api.put(`/api/shared-items/${item.id}/team-answers`, teamAnswers);
      setInitialTeamAnswers({ ...teamAnswers });
      setTeamAnswerSuccess(true);
    } catch (error: any) {
      console.error('Team answer save error:', error);
      setTeamAnswerError(error.response?.data?.error || '保存に失敗しました');
    } finally {
      setTeamAnswerSaving(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await api.get('/api/shared-items/staff');
      setStaff(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch staff:', error);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/api/shared-items/${item.id}`);
      pageDataCache.invalidate(CACHE_KEYS.SHARED_ITEMS);
      setDeleteDialogOpen(false);
      handleBack();
    } catch (error: any) {
      console.error('Delete error:', error);
      setDeleteError(error.response?.data?.error || '削除に失敗しました。もう一度お試しください。');
    } finally {
      setDeleting(false);
    }
  };

  const handleBack = () => {
    if (fromLocation) {
      navigate('/shared-items', { state: { restoreLocation: fromLocation } });
    } else {
      navigate('/shared-items');
    }
  };

  // 完了ボタン：今日の日付を共有日にセットして保存
  const handleComplete = async () => {
    if (!item) return;
    // type="date" inputには YYYY-MM-DD 形式が必要
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setCompleting(true);
    setApiError('');
    setSaveSuccess(false);
    try {
      const pdfUrls = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => item[`PDF${n}`] || '');
      const imageUrls = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
        const key = `画像${n === 1 ? '１' : n === 2 ? '２' : n === 3 ? '３' : n === 4 ? '４' : n === 5 ? '５' : n === 6 ? '６' : n === 7 ? '７' : n === 8 ? '８' : n === 9 ? '９' : '１０'}`;
        return item[key] || '';
      });
      const payload: Record<string, string> = {
        'PDF1': pdfUrls[0], 'PDF2': pdfUrls[1], 'PDF3': pdfUrls[2], 'PDF4': pdfUrls[3], 'PDF5': pdfUrls[4],
        'PDF6': pdfUrls[5], 'PDF7': pdfUrls[6], 'PDF8': pdfUrls[7], 'PDF9': pdfUrls[8], 'PDF10': pdfUrls[9],
        '画像１': imageUrls[0], '画像２': imageUrls[1], '画像３': imageUrls[2], '画像４': imageUrls[3],
        '共有日': today,
        '確認日': confirmationDate,
        '共有できていない': staffNotShared.join(','),
        '内容': content,
      };
      await api.put(`/api/shared-items/${item.id}`, payload);
      
      // 画像コメントは別途DBに保存
      try {
        await api.put(`/api/shared-items/${item.id}/image-comments`, { comments: imageComments });
      } catch (commentError) {
        console.error('Failed to save image comments:', commentError);
        // コメント保存失敗は全体の保存を止めない
      }

      // 画像5〜10は別途DBに保存
      try {
        const dbImages: Record<number, string> = {
          5: imageUrls[4],
          6: imageUrls[5],
          7: imageUrls[6],
          8: imageUrls[7],
          9: imageUrls[8],
          10: imageUrls[9],
        };
        await api.put(`/api/shared-items/${item.id}/images`, { images: dbImages });
      } catch (imageError) {
        console.error('Failed to save images 5-10:', imageError);
        // 画像保存失敗は全体の保存を止めない
      }
      pageDataCache.invalidate(CACHE_KEYS.SHARED_ITEMS);
      // PDF/画像フィールドの空文字はsetItemに渡さない（hasChanges の誤検知を防ぐ）
      const payloadForState = Object.fromEntries(
        Object.entries(payload).filter(([k, v]) => !(
          (/^PDF\d+$/.test(k) || /^画像[１-９１０]+$/.test(k) || /^画像コメント[１-９１０]+$/.test(k)) && v === ''
        ))
      );
      setItem((prev) => (prev ? { ...prev, ...payloadForState } : prev));
      // 保存成功後にステートと初期値を同時に同じ値でセット → hasChanges が false になり保存ボタンがグレーに戻る
      setSharingDate(today);
      setInitialSharingDate(today);
      setInitialConfirmationDate(confirmationDate);
      setInitialStaffNotShared(staffNotShared.join(','));
      setInitialContent(content);
      setInitialImageComments({ ...imageComments });
      setNewPdfs([]);
      setNewImages([]);
      setSaveSuccess(true);
    } catch (error: any) {
      console.error('Complete error:', error);
      setApiError(error.response?.data?.error || '保存に失敗しました。もう一度お試しください。');
    } finally {
      setCompleting(false);
    }
  };

  // 次へボタン：同じ共有場カテゴリーで共有日が未入力（未完了）のものへ遷移
  const handleNext = async () => {
    if (!fromLocation) return;
    setNavigatingNext(true);
    try {
      const response = await api.get('/api/shared-items', {
        params: { limit: 1000, offset: 0, orderBy: 'created_at', orderDirection: 'desc' },
        timeout: 30000,
      });
      const allItems: SharedItem[] = response.data.data || [];
      const pending = allItems.filter(
        (i) => i['共有場'] === fromLocation && !i['共有日'] && i.id !== id
      );
      if (pending.length === 0) {
        setFinishedDialogOpen(true);
      } else {
        navigate(`/shared-items/${pending[0].id}`, { state: { fromLocation } });
      }
    } catch (error) {
      console.error('Next item fetch error:', error);
    } finally {
      setNavigatingNext(false);
    }
  };

  const handleStaffToggle = (name: string) => {
    setStaffNotShared((prev) => toggleStaff(prev, name));
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const existingCount = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((n) => item && item[`PDF${n}`]).length;
    const remaining = 10 - existingCount - newPdfs.length;
    setNewPdfs((prev) => [...prev, ...files.slice(0, remaining).map((f) => ({ file: f, name: f.name }))]);
    e.target.value = '';
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const existingCount = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((n) => {
      const key = `画像${n === 1 ? '１' : n === 2 ? '２' : n === 3 ? '３' : n === 4 ? '４' : n === 5 ? '５' : n === 6 ? '６' : n === 7 ? '７' : n === 8 ? '８' : n === 9 ? '９' : '１０'}`;
      return item && item[key];
    }).length;
    const remaining = 10 - existingCount - newImages.length;
    setNewImages((prev) => [...prev, ...files.slice(0, remaining).map((f) => ({ file: f, name: f.name, comment: '' }))]);
    e.target.value = '';
  };

  const handleDeleteExistingPdf = (url: string) => {
    setItem((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      for (let n = 1; n <= 10; n++) {
        if (updated[`PDF${n}`] === url) updated[`PDF${n}`] = '';
      }
      return updated;
    });
  };

  const handleDeleteExistingImage = (url: string) => {
    setItem((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        const key = `画像${n === 1 ? '１' : n === 2 ? '２' : n === 3 ? '３' : n === 4 ? '４' : n === 5 ? '５' : n === 6 ? '６' : n === 7 ? '７' : n === 8 ? '８' : n === 9 ? '９' : '１０'}`;
        if (updated[key] === url) updated[key] = '';
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    setApiError('');
    setSaveSuccess(false);

    try {
      const pdfUrls = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => item[`PDF${n}`] || '');
      const imageUrls = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
        const key = `画像${n === 1 ? '１' : n === 2 ? '２' : n === 3 ? '３' : n === 4 ? '４' : n === 5 ? '５' : n === 6 ? '６' : n === 7 ? '７' : n === 8 ? '８' : n === 9 ? '９' : '１０'}`;
        return item[key] || '';
      });

      for (const newPdf of newPdfs) {
        const url = await uploadFileToStorage(newPdf.file, 'pdf');
        const emptyIdx = pdfUrls.findIndex((u) => !u);
        if (emptyIdx !== -1) pdfUrls[emptyIdx] = url;
      }

      for (const newImg of newImages) {
        const url = await uploadFileToStorage(newImg.file, 'image');
        const emptyIdx = imageUrls.findIndex((u) => !u);
        if (emptyIdx !== -1) {
          imageUrls[emptyIdx] = url;
          // 新規画像のコメントも保存
          if (newImg.comment) {
            imageComments[emptyIdx + 1] = newImg.comment;
          }
        }
      }

      const payload: Record<string, string> = {
        'PDF1': pdfUrls[0],
        'PDF2': pdfUrls[1],
        'PDF3': pdfUrls[2],
        'PDF4': pdfUrls[3],
        'PDF5': pdfUrls[4],
        'PDF6': pdfUrls[5],
        'PDF7': pdfUrls[6],
        'PDF8': pdfUrls[7],
        'PDF9': pdfUrls[8],
        'PDF10': pdfUrls[9],
        '画像１': imageUrls[0],
        '画像２': imageUrls[1],
        '画像３': imageUrls[2],
        '画像４': imageUrls[3],
        '共有日': sharingDate,
        '確認日': confirmationDate,
        '共有できていない': staffNotShared.join(','),
        '内容': content,
      };

      await api.put(`/api/shared-items/${item.id}`, payload);

      // 画像コメントは別途DBに保存
      try {
        await api.put(`/api/shared-items/${item.id}/image-comments`, { comments: imageComments });
      } catch (commentError) {
        console.error('Failed to save image comments:', commentError);
        // コメント保存失敗は全体の保存を止めない
      }

      // 画像5〜10は別途DBに保存
      try {
        const dbImages: Record<number, string> = {
          5: imageUrls[4],
          6: imageUrls[5],
          7: imageUrls[6],
          8: imageUrls[7],
          9: imageUrls[8],
          10: imageUrls[9],
        };
        await api.put(`/api/shared-items/${item.id}/images`, { images: dbImages });
      } catch (imageError) {
        console.error('Failed to save images 5-10:', imageError);
        // 画像保存失敗は全体の保存を止めない
      }

      pageDataCache.invalidate(CACHE_KEYS.SHARED_ITEMS);
      // PDF/画像フィールドの空文字はsetItemに渡さない（hasChanges の誤検知を防ぐ）
      const payloadForState = Object.fromEntries(
        Object.entries(payload).filter(([k, v]) => !(
          (/^PDF\d+$/.test(k) || /^画像[１-９１０]+$/.test(k) || /^画像コメント[１-９１０]+$/.test(k)) && v === ''
        ))
      );
      setItem((prev) => (prev ? { ...prev, ...payloadForState } : prev));
      setNewPdfs([]);
      setNewImages([]);
      setInitialSharingDate(sharingDate);
      setInitialConfirmationDate(confirmationDate);
      setInitialStaffNotShared(staffNotShared.join(','));
      setInitialContent(content);
      setInitialImageComments({ ...imageComments });
      setSaveSuccess(true);
    } catch (error: any) {
      console.error('Save error:', error);
      setApiError(error.response?.data?.error || '保存に失敗しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography>読み込み中...</Typography>
      </Container>
    );
  }

  if (!item) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography>データが見つかりませんでした</Typography>
        <Button onClick={handleBack} sx={{ mt: 2 }}>戻る</Button>
      </Container>
    );
  }

  const existingPdfUrls = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => item[`PDF${n}`]).filter(Boolean);
  const existingImageUrls = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
    const key = `画像${n === 1 ? '１' : n === 2 ? '２' : n === 3 ? '３' : n === 4 ? '４' : n === 5 ? '５' : n === 6 ? '６' : n === 7 ? '７' : n === 8 ? '８' : n === 9 ? '９' : '１０'}`;
    return item[key];
  }).filter(Boolean);
  const canAddPdf = existingPdfUrls.length + newPdfs.length < 10;
  const canAddImage = existingImageUrls.length + newImages.length < 10;

  const hasChanges =
    newPdfs.length > 0 ||
    newImages.length > 0 ||
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].some((n) => item[`PDF${n}`] === '') ||
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].some((n) => {
      const key = `画像${n === 1 ? '１' : n === 2 ? '２' : n === 3 ? '３' : n === 4 ? '４' : n === 5 ? '５' : n === 6 ? '６' : n === 7 ? '７' : n === 8 ? '８' : n === 9 ? '９' : '１０'}`;
      return item[key] === '';
    }) ||
    content !== initialContent ||
    sharingDate !== initialSharingDate ||
    confirmationDate !== initialConfirmationDate ||
    staffNotShared.join(',') !== initialStaffNotShared ||
    JSON.stringify(imageComments) !== JSON.stringify(initialImageComments);

  const isTeamMode = TEAM_MODES.includes(item['共有場'] || '');
  const hasTeamAnswerChanges = JSON.stringify(teamAnswers) !== JSON.stringify(initialTeamAnswers);

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ color: color.main }}>
            {fromLocation ? `${fromLocation}に戻る` : '戻る'}
          </Button>
          {item && (
            <Typography variant="body2" color="text.secondary" fontWeight="bold">
              {item.id || ''}
            </Typography>
          )}
          <Typography variant="h5" fontWeight="bold" sx={{ color: color.main }}>
            共有詳細
          </Typography>
        </Box>
        {isTeamMode ? (
          <Button
            variant="outlined"
            color="error"
            onClick={() => setDeleteDialogOpen(true)}
            startIcon={<DeleteIcon />}
          >
            削除
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            sx={{ bgcolor: color.main, '&:hover': { bgcolor: color.dark } }}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        )}
      </Box>

      {apiError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setApiError('')}>{apiError}</Alert>
      )}
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveSuccess(false)}>保存しました</Alert>
      )}
      {deleteError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDeleteError('')}>{deleteError}</Alert>
      )}

      <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)}>
        <DialogTitle>この共有アイテムを削除しますか？</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            この操作は取り消せません。よろしいですか？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>キャンセル</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
          >
            {deleting ? '削除中...' : '削除する'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 終わりダイアログ */}
      <Dialog open={finishedDialogOpen} onClose={() => setFinishedDialogOpen(false)}>
        <DialogTitle>🎉 終わり</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            「{fromLocation}」の未完了アイテムはすべて完了しました！
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => {
              setFinishedDialogOpen(false);
              handleBack();
            }}
            sx={{ bgcolor: color.main, '&:hover': { bgcolor: color.dark } }}
          >
            一覧に戻る
          </Button>
        </DialogActions>
      </Dialog>

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* 日付・入力者 */}
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">日付</Typography>
            <TextField fullWidth value={item['日付'] || ''} disabled size="small"
              sx={{ mt: 1, '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#000' } }} />
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">入力者</Typography>
            <TextField fullWidth value={item['入力者'] || ''} disabled size="small"
              sx={{ mt: 1, '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#000' } }} />
          </Grid>

          {/* 共有場・項目 */}
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">共有場</Typography>
            <TextField fullWidth value={item['共有場'] || ''} disabled size="small"
              sx={{ mt: 1, '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#000' } }} />
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">項目</Typography>
            <TextField fullWidth value={item['項目'] || ''} disabled size="small"
              sx={{ mt: 1, '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#000' } }} />
          </Grid>

          {/* タイトル／問い */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              {isTeamMode ? '問い' : 'タイトル'}
            </Typography>
            {isTeamMode ? (
              <TextField
                fullWidth
                multiline
                minRows={3}
                value={teamAnswers.question}
                onChange={(e) => handleTeamAnswerChange('question', e.target.value)}
                placeholder="問いを入力"
                sx={{ mt: 1, '& .MuiOutlinedInput-root': { bgcolor: `${color.light}15` } }}
              />
            ) : (
              <TextField fullWidth value={item['タイトル'] || ''} disabled
                sx={{ mt: 1,
                  '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: color.main, fontWeight: 'bold', fontSize: '1.1rem' },
                  '& .MuiOutlinedInput-root': { bgcolor: `${color.light}15` },
                }} />
            )}
          </Grid>

          {/* 内容（通常モード）／各人回答＋まとめ（チームモード） */}
          {isTeamMode ? (
            <>
              {/* チームアンサーセクション */}
              <Grid item xs={12}>
                <Divider sx={{ mb: 1 }} />
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: color.main, mb: 2 }}>
                  内容（各担当者の回答）
                </Typography>
                {teamAnswerError && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setTeamAnswerError('')}>{teamAnswerError}</Alert>
                )}
                {teamAnswerSuccess && (
                  <Alert severity="success" sx={{ mb: 2 }} onClose={() => setTeamAnswerSuccess(false)}>保存しました</Alert>
                )}
                <Grid container spacing={2}>
                  {TEAM_ANSWER_MEMBERS.map(({ key, label }) => (
                    <Grid item xs={12} key={key}>
                      <Typography variant="caption" color="text.secondary">{label}</Typography>
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        value={teamAnswers[key]}
                        onChange={(e) => handleTeamAnswerChange(key, e.target.value)}
                        placeholder={`${label}の回答`}
                        sx={{ mt: 0.5, '& .MuiOutlinedInput-root': { bgcolor: `${color.light}08` } }}
                      />
                    </Grid>
                  ))}

                  {/* まとめ */}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">まとめ</Typography>
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      value={teamAnswers.summary}
                      onChange={(e) => handleTeamAnswerChange('summary', e.target.value)}
                      placeholder="まとめを入力"
                      sx={{ mt: 0.5, '& .MuiOutlinedInput-root': { bgcolor: `${color.light}15` } }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        variant="contained"
                        onClick={handleTeamAnswerSave}
                        disabled={teamAnswerSaving || !hasTeamAnswerChanges}
                        sx={{ bgcolor: color.main, '&:hover': { bgcolor: color.dark } }}
                        startIcon={teamAnswerSaving ? <CircularProgress size={16} color="inherit" /> : undefined}
                      >
                        {teamAnswerSaving ? '保存中...' : '内容を保存'}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
                <Divider sx={{ mt: 2 }} />
              </Grid>
            </>
          ) : (
            /* 通常の内容フィールド */
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">内容</Typography>
              <TextField fullWidth multiline minRows={4} value={content}
                onChange={(e) => setContent(e.target.value)}
                sx={{ mt: 1,
                  '& .MuiOutlinedInput-root': { bgcolor: `${color.light}15` },
                }} />
            </Grid>
          )}

          {/* PDF */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">PDF</Typography>
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {existingPdfUrls.map((url, i) => (
                <Box key={i} sx={{ border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
                    <Typography sx={{ mr: 0.5 }}>📄</Typography>
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      style={{ color: color.main, wordBreak: 'break-all', fontSize: '0.85rem', flex: 1 }}>
                      {decodeURIComponent(url.split('/').pop() || `PDF${i + 1}`)}
                    </a>
                    <IconButton size="small" onClick={() => handleDeleteExistingPdf(url)}
                      sx={{ color: '#f44336', flexShrink: 0 }} title="削除">
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <iframe
                    src={url}
                    title={`PDF${i + 1}`}
                    style={{ width: '100%', height: 600, border: 'none', display: 'block' }}
                  />
                </Box>
              ))}
              {newPdfs.map((f, i) => (
                <Chip key={i} label={f.name} size="small"
                  onDelete={() => setNewPdfs((prev) => prev.filter((_, idx) => idx !== i))}
                  deleteIcon={<CloseIcon />}
                  sx={{ bgcolor: `${color.main}15`, alignSelf: 'flex-start' }}
                />
              ))}
              {canAddPdf && (
                <Button component="label" variant="outlined" startIcon={<AttachFileIcon />} size="small"
                  sx={{ alignSelf: 'flex-start', borderColor: color.main, color: color.main }}>
                  PDFを追加
                  <input type="file" accept="application/pdf" multiple hidden onChange={handlePdfChange} />
                </Button>
              )}
            </Box>
          </Grid>

          {/* 画像 */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">画像</Typography>
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {existingImageUrls.map((url, i) => {
                const imageIndex = i + 1;
                return (
                  <Box key={i} sx={{ border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
                      <Typography sx={{ fontSize: '0.85rem', flex: 1, color: color.main, wordBreak: 'break-all', fontWeight: 'bold' }}>
                        🖼️ 画像 {imageIndex}: {decodeURIComponent(url.split('/').pop() || `画像${imageIndex}`)}
                      </Typography>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        style={{ color: color.main, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        別タブで開く
                      </a>
                      <IconButton size="small" onClick={() => handleDeleteExistingImage(url)}
                        sx={{ color: '#f44336', flexShrink: 0 }} title="削除">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Box sx={{ p: 2, bgcolor: '#f5f5f5', textAlign: 'center' }}>
                      <img src={url} alt={`画像${imageIndex}`}
                        style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain', borderRadius: 4, display: 'block', margin: '0 auto' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </Box>
                    <Box sx={{ p: 1.5, bgcolor: '#fff', borderTop: '1px solid #e0e0e0' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight="bold">コメント</Typography>
                      <TextField
                        fullWidth
                        placeholder={`画像 ${imageIndex} のコメントを入力`}
                        value={imageComments[imageIndex] || ''}
                        onChange={(e) => setImageComments((prev) => ({ ...prev, [imageIndex]: e.target.value }))}
                        size="small"
                        multiline
                        rows={2}
                        sx={{ 
                          mt: 0.5,
                          '& .MuiOutlinedInput-root': { 
                            bgcolor: '#fafafa',
                            fontSize: '0.9rem',
                          },
                          '& .MuiInputBase-input': {
                            color: '#d32f2f',
                            fontWeight: '600',
                          }
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
              {newImages.map((f, i) => (
                <Box key={i} sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 1.5, bgcolor: '#fafafa' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: color.main }}>
                      新規画像 {i + 1}: {f.name}
                    </Typography>
                    <IconButton size="small" onClick={() => setNewImages((prev) => prev.filter((_, idx) => idx !== i))} sx={{ color: '#f44336' }}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <TextField
                    fullWidth
                    placeholder={`画像 ${i + 1} のコメントを入力`}
                    value={f.comment || ''}
                    onChange={(e) => setNewImages((prev) => 
                      prev.map((img, idx) => idx === i ? { ...img, comment: e.target.value } : img)
                    )}
                    size="small"
                    multiline
                    rows={2}
                    sx={{ 
                      mt: 1,
                      '& .MuiOutlinedInput-root': { 
                        bgcolor: '#fff',
                        fontSize: '0.9rem',
                      },
                      '& .MuiInputBase-input': {
                        color: '#d32f2f',
                        fontWeight: '600',
                      }
                    }}
                  />
                </Box>
              ))}
              {canAddImage && (
                <Button component="label" variant="outlined" startIcon={<AttachFileIcon />} size="small"
                  sx={{ alignSelf: 'flex-start', borderColor: color.main, color: color.main }}>
                  画像を追加
                  <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple hidden onChange={handleImageChange} />
                </Button>
              )}
            </Box>
          </Grid>

          {/* URL */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">URL</Typography>
            {item['URL'] && item['URL'] !== 'http://' ? (
              <Box sx={{ mt: 1, p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa' }}>
                <a href={item['URL']} target="_blank" rel="noopener noreferrer"
                  style={{ color: color.main, wordBreak: 'break-all' }}>
                  {item['URL']}
                </a>
              </Box>
            ) : (
              <TextField fullWidth value={item['URL'] || ''} disabled size="small"
                sx={{ mt: 1, '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#aaa' } }} />
            )}
          </Grid>

          {/* 共有完了（編集可能） */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">共有完了</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <TextField
                type="date"
                value={sharingDate}
                onChange={(e) => setSharingDate(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={{ width: 180 }}
              />
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving || !hasChanges}
                sx={{ bgcolor: color.main, '&:hover': { bgcolor: color.dark }, whiteSpace: 'nowrap', flexShrink: 0 }}
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {saving ? '保存中...' : '保存'}
              </Button>
              {/* 共有完了ボタン：今日の日付を自動入力して保存 */}
              <Button
                variant="contained"
                color="success"
                onClick={handleComplete}
                disabled={completing}
                sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                startIcon={completing ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {completing ? '保存中...' : '✓ 共有完了'}
              </Button>
              {/* 朝礼等カテゴリーから来た場合のみ「次へ」ボタンを表示 */}
              {fromLocation && (
                <Button
                  variant="outlined"
                  onClick={handleNext}
                  disabled={navigatingNext}
                  sx={{ whiteSpace: 'nowrap', flexShrink: 0, borderColor: color.main, color: color.main }}
                  startIcon={navigatingNext ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                  {navigatingNext ? '...' : '次へ →'}
                </Button>
              )}
            </Box>
          </Grid>

          {/* 共有できていないスタッフ（ボタン選択・トグル可能） */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">共有できていないスタッフ</Typography>
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
              ＊複数いる場合は、確認後自分の名前だけ消して保存してください。確認日は入れないでください！最後の一人が「確認日」を入力してください
            </Typography>
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {staff.map((s, index) => {
                const initial = s.initials || s.name.charAt(0);
                const isSelected = staffNotShared.includes(s.name);
                return (
                  <Button
                    key={index}
                    variant={isSelected ? 'contained' : 'outlined'}
                    onClick={() => handleStaffToggle(s.name)}
                    sx={{
                      minWidth: '48px', height: '48px', borderRadius: '50%',
                      fontSize: '1.2rem', fontWeight: 'bold',
                      bgcolor: isSelected ? color.main : 'transparent',
                      color: isSelected ? '#fff' : color.main,
                      borderColor: color.main,
                      '&:hover': { bgcolor: isSelected ? color.dark : `${color.light}30` },
                    }}
                    title={s.name}
                  >{initial}</Button>
                );
              })}
            </Box>
          </Grid>

          {/* 確認日（編集可能） */}
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">確認日</Typography>
            <TextField
              fullWidth
              type="date"
              value={confirmationDate}
              onChange={(e) => setConfirmationDate(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ mt: 1 }}
            />
          </Grid>

          {/* 打ち合わせ内容 */}
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">打ち合わせ内容</Typography>
            <TextField fullWidth multiline rows={3} value={item['打ち合わせ内容'] || ''} disabled
              sx={{ mt: 1, '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#000' } }} />
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
}
