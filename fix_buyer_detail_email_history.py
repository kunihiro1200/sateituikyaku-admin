# -*- coding: utf-8 -*-
"""
買主詳細画面のメール・SMS送信履歴表示を修正するスクリプト
1. 「買主候補リスト」という言葉の重複を削除（templateNameを表示しない）
2. 物件番号の代わりに物件住所を表示
3. クリックでメール本文を表示するモーダルを実装
"""

import re

# ファイルを読み込む
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# 1. インポート文を追加（Dialogコンポーネント）
import_section = """import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  List,
  ListItem,
  Paper,
  TextField,
  Typography,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';"""

new_import_section = """import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  List,
  ListItem,
  Paper,
  TextField,
  Typography,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';"""

content = content.replace(import_section, new_import_section)

# 2. CloseIconのインポートを追加
close_icon_import = "import EmailIcon from '@mui/icons-material/Email';"
new_close_icon_import = """import EmailIcon from '@mui/icons-material/Email';
import CloseIcon from '@mui/icons-material/Close';"""

content = content.replace(close_icon_import, new_close_icon_import)

# 3. propertyListingApiのインポートを追加
api_import = "import { buyerApi } from '../services/api';"
new_api_import = "import { buyerApi, propertyListingApi } from '../services/api';"

content = content.replace(api_import, new_api_import)

# 4. useState追加（メール本文モーダル用）
# const [activities, setActivities] = useState<ActivityLog[]>([]);の後に追加
activities_state = "const [activities, setActivities] = useState<ActivityLog[]>([]);"
new_activities_state = """const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [selectedEmailBody, setSelectedEmailBody] = useState<string | null>(null);
  const [propertyAddresses, setPropertyAddresses] = useState<Record<string, string>>({});"""

content = content.replace(activities_state, new_activities_state)

# 5. 物件住所を取得する関数を追加（useEffect内に追加）
# activities取得後に物件住所を取得
fetch_activities_section = """      const activitiesData = await api.get(`/api/buyers/${buyer_number}/activities`);
      setActivities(activitiesData.data || []);"""

new_fetch_activities_section = """      const activitiesData = await api.get(`/api/buyers/${buyer_number}/activities`);
      setActivities(activitiesData.data || []);
      
      // メール履歴から物件番号を抽出して住所を取得
      const emailActivities = (activitiesData.data || []).filter((a: any) => a.action === 'email');
      const propertyNumbers = new Set<string>();
      emailActivities.forEach((activity: any) => {
        const metadata = activity.metadata || {};
        const numbers = metadata.propertyNumbers || metadata.property_numbers || [];
        numbers.forEach((pn: string) => propertyNumbers.add(pn));
      });
      
      // 物件番号から住所を取得
      const addresses: Record<string, string> = {};
      for (const propertyNumber of Array.from(propertyNumbers)) {
        try {
          const propertyData = await propertyListingApi.getByPropertyNumber(propertyNumber);
          addresses[propertyNumber] = propertyData.address || propertyNumber;
        } catch (error) {
          console.error(`Failed to fetch address for ${propertyNumber}:`, error);
          addresses[propertyNumber] = propertyNumber; // フォールバック
        }
      }
      setPropertyAddresses(addresses);"""

content = content.replace(fetch_activities_section, new_fetch_activities_section)

# 6. メール・SMS送信履歴セクションを修正
# 元のセクションを探す
old_email_history_section = """          {/* メール・SMS送信履歴セクション */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <EmailIcon sx={{ mr: 1, color: 'success.main' }} />
              <Typography variant="h6">メール・SMS送信履歴</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {activities.filter(a => a.action === 'email' || a.action === 'sms').length > 0 ? (
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {activities
                  .filter(a => a.action === 'email' || a.action === 'sms')
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((activity) => {
                    const metadata = activity.metadata || {};
                    const isSms = activity.action === 'sms';
                    const propertyNumbers = metadata.propertyNumbers || metadata.property_numbers || [];
                    
                    // 送信元を識別
                    const getSourceLabel = (source?: string): string => {
                      switch (source) {
                        case 'other_company_distribution':
                          return '他社物件新着配信';
                        case 'pre_public_price_reduction':
                          return '公開前・値下げメール';
                        case 'buyer_candidate_list':
                          return '買主候補リスト';
                        case 'nearby_buyers':
                          return '近隣買主';
                        default:
                          return '買主詳細画面';
                      }
                    };
                    
                    // 送信元によって色を変える
                    const getSourceColor = (source?: string): 'warning' | 'info' | 'success' | 'secondary' | 'default' => {
                      switch (source) {
                        case 'other_company_distribution':
                          return 'warning'; // 黄色
                        case 'pre_public_price_reduction':
                          return 'info'; // 青
                        case 'buyer_candidate_list':
                          return 'success'; // 緑
                        case 'nearby_buyers':
                          return 'secondary'; // グレー
                        default:
                          return 'default'; // デフォルト
                      }
                    };
                    
                    const sourceLabel = getSourceLabel(metadata.source);
                    const sourceColor = getSourceColor(metadata.source);
                    
                    const displayName = isSms
                      ? (metadata.senderName
                          ? metadata.senderName
                          : (activity.employee
                              ? (activity.employee.name
                                  ? activity.employee.name.split(/[\s\u3000]/)[0]
                                  : (activity.employee.initials || '担当者'))
                              : '担当者'))
                      : (activity.employee ? getDisplayName(activity.employee) : '不明');
                    return (
                      <ListItem
                        key={activity.id}
                        sx={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider', py: 2 }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {isSms ? (
                              <Chip label="SMS" size="small" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />
                            ) : (
                              <Chip label="メール" size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
                            )}
                            <Chip label={sourceLabel} size="small" color={sourceColor} sx={{ height: 20, fontSize: '0.7rem' }} />
                            <Typography variant="body2" fontWeight="bold">
                              {isSms
                                ? (metadata.templateName || 'テンプレート不明')
                                : (metadata.templateName || metadata.subject || '件名なし')}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(activity.created_at)}
                          </Typography>
                        </Box>
                        {isSms ? (
                          <Box sx={{ width: '100%', mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              送信者: {displayName} / 送信先: {metadata.phoneNumber || '-'}
                            </Typography>
                          </Box>
                        ) : (
                          <Box sx={{ width: '100%', mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              送信者: {displayName} ({metadata.senderEmail || '-'})
                            </Typography>
                          </Box>
                        )}
                        {!isSms && propertyNumbers.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>物件:</Typography>
                            {propertyNumbers.map((pn: string) => (
                              <Chip key={pn} label={pn} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                            ))}
                          </Box>
                        )}
                        {!isSms && metadata.preViewingNotes && (
                          <Box sx={{ width: '100%', mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>内覧前伝達事項:</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
                              {metadata.preViewingNotes}
                            </Typography>
                          </Box>
                        )}
                      </ListItem>
                    );
                  })}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                <EmailIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                <Typography variant="body2">メール送信履歴はありません</Typography>
              </Box>
            )}
          </Paper>"""

new_email_history_section = """          {/* メール・SMS送信履歴セクション */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <EmailIcon sx={{ mr: 1, color: 'success.main' }} />
              <Typography variant="h6">メール・SMS送信履歴</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {activities.filter(a => a.action === 'email' || a.action === 'sms').length > 0 ? (
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {activities
                  .filter(a => a.action === 'email' || a.action === 'sms')
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((activity) => {
                    const metadata = activity.metadata || {};
                    const isSms = activity.action === 'sms';
                    const propertyNumbers = metadata.propertyNumbers || metadata.property_numbers || [];
                    
                    // 送信元を識別
                    const getSourceLabel = (source?: string): string => {
                      switch (source) {
                        case 'other_company_distribution':
                          return '他社物件新着配信';
                        case 'pre_public_price_reduction':
                          return '公開前・値下げメール';
                        case 'buyer_candidate_list':
                          return '買主候補リスト';
                        case 'nearby_buyers':
                          return '近隣買主';
                        default:
                          return '買主詳細画面';
                      }
                    };
                    
                    // 送信元によって色を変える
                    const getSourceColor = (source?: string): 'warning' | 'info' | 'success' | 'secondary' | 'default' => {
                      switch (source) {
                        case 'other_company_distribution':
                          return 'warning'; // 黄色
                        case 'pre_public_price_reduction':
                          return 'info'; // 青
                        case 'buyer_candidate_list':
                          return 'success'; // 緑
                        case 'nearby_buyers':
                          return 'secondary'; // グレー
                        default:
                          return 'default'; // デフォルト
                      }
                    };
                    
                    const sourceLabel = getSourceLabel(metadata.source);
                    const sourceColor = getSourceColor(metadata.source);
                    
                    const displayName = isSms
                      ? (metadata.senderName
                          ? metadata.senderName
                          : (activity.employee
                              ? (activity.employee.name
                                  ? activity.employee.name.split(/[\s\u3000]/)[0]
                                  : (activity.employee.initials || '担当者'))
                              : '担当者'))
                      : (activity.employee ? getDisplayName(activity.employee) : '不明');
                    
                    // メール本文が存在するかチェック
                    const hasEmailBody = !isSms && metadata.body;
                    
                    return (
                      <ListItem
                        key={activity.id}
                        sx={{ 
                          flexDirection: 'column', 
                          alignItems: 'flex-start', 
                          borderBottom: '1px solid', 
                          borderColor: 'divider', 
                          py: 2,
                          cursor: hasEmailBody ? 'pointer' : 'default',
                          '&:hover': hasEmailBody ? { bgcolor: 'action.hover' } : {}
                        }}
                        onClick={() => {
                          if (hasEmailBody) {
                            setSelectedEmailBody(metadata.body);
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {isSms ? (
                              <Chip label="SMS" size="small" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />
                            ) : (
                              <Chip label="メール" size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
                            )}
                            <Chip label={sourceLabel} size="small" color={sourceColor} sx={{ height: 20, fontSize: '0.7rem' }} />
                            <Typography variant="body2" fontWeight="bold">
                              {isSms
                                ? (metadata.templateName || 'テンプレート不明')
                                : (metadata.subject || '件名なし')}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(activity.created_at)}
                          </Typography>
                        </Box>
                        {isSms ? (
                          <Box sx={{ width: '100%', mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              送信者: {displayName} / 送信先: {metadata.phoneNumber || '-'}
                            </Typography>
                          </Box>
                        ) : (
                          <Box sx={{ width: '100%', mb: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              送信者: {displayName} ({metadata.senderEmail || '-'})
                            </Typography>
                          </Box>
                        )}
                        {!isSms && propertyNumbers.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>物件:</Typography>
                            {propertyNumbers.map((pn: string) => (
                              <Chip 
                                key={pn} 
                                label={propertyAddresses[pn] || pn} 
                                size="small" 
                                variant="outlined" 
                                sx={{ height: 20, fontSize: '0.7rem' }} 
                              />
                            ))}
                          </Box>
                        )}
                        {!isSms && metadata.preViewingNotes && (
                          <Box sx={{ width: '100%', mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>内覧前伝達事項:</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
                              {metadata.preViewingNotes}
                            </Typography>
                          </Box>
                        )}
                      </ListItem>
                    );
                  })}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                <EmailIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                <Typography variant="body2">メール送信履歴はありません</Typography>
              </Box>
            )}
          </Paper>
          
          {/* メール本文表示モーダル */}
          <Dialog
            open={selectedEmailBody !== null}
            onClose={() => setSelectedEmailBody(null)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              メール本文
              <IconButton
                aria-label="close"
                onClick={() => setSelectedEmailBody(null)}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                  color: (theme) => theme.palette.grey[500],
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {selectedEmailBody}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedEmailBody(null)}>閉じる</Button>
            </DialogActions>
          </Dialog>"""

content = content.replace(old_email_history_section, new_email_history_section)

# ファイルに書き込む（UTF-8、BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ BuyerDetailPage.tsx を修正しました')
print('変更内容:')
print('1. templateNameを表示しない（送信元ラベルのみ表示）')
print('2. 物件番号の代わりに物件住所を表示')
print('3. クリックでメール本文を表示するモーダルを実装')
