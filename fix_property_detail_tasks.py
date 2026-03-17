# -*- coding: utf-8 -*-
"""
2つのタスクを実装:
1. GmailDistributionButton に priceReductionHistory プロップを追加して {priceChangeText} を正しく生成
2. サマリーエリア（所在地・売主氏名・ATBB状況・種別・現況・担当）を編集可能にする
"""

# ===== TASK 1: GmailDistributionButton.tsx の修正 =====
with open('frontend/frontend/src/components/GmailDistributionButton.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1-1. priceReductionHistory プロップを追加
old_props_interface = """interface GmailDistributionButtonProps {
  propertyNumber: string;
  propertyAddress?: string;
  publicUrl?: string;
  distributionAreas?: string;
  salesPrice?: number;
  previousSalesPrice?: number;
  propertyType?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'text' | 'outlined' | 'contained';
}"""

new_props_interface = """interface GmailDistributionButtonProps {
  propertyNumber: string;
  propertyAddress?: string;
  publicUrl?: string;
  distributionAreas?: string;
  salesPrice?: number;
  previousSalesPrice?: number;
  priceReductionHistory?: string;
  propertyType?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'text' | 'outlined' | 'contained';
}"""

text = text.replace(old_props_interface, new_props_interface)

# 1-2. 分割代入に priceReductionHistory を追加
old_destructure = """export default function GmailDistributionButton({
  propertyNumber,
  propertyAddress,
  publicUrl,
  distributionAreas,
  salesPrice,
  previousSalesPrice,
  propertyType,
  size = 'small',
  variant = 'outlined'
}: GmailDistributionButtonProps) {"""

new_destructure = """export default function GmailDistributionButton({
  propertyNumber,
  propertyAddress,
  publicUrl,
  distributionAreas,
  salesPrice,
  previousSalesPrice,
  priceReductionHistory,
  propertyType,
  size = 'small',
  variant = 'outlined'
}: GmailDistributionButtonProps) {"""

text = text.replace(old_destructure, new_destructure)

# 1-3. generatePriceChangeText を修正して priceReductionHistory からも取得できるようにする
old_generate = """  // 価格変更テキストを生成
  const generatePriceChangeText = (): string => {
    if (previousSalesPrice && salesPrice) {
      const oldMan = Math.floor(previousSalesPrice / 10000);
      const newMan = Math.floor(salesPrice / 10000);
      const diffMan = oldMan - newMan;
      if (diffMan > 0) {
        return `${oldMan}万円 → ${newMan}万円（${diffMan}万円値下げ）`;
      } else if (diffMan < 0) {
        return `${oldMan}万円 → ${newMan}万円（${Math.abs(diffMan)}万円値上げ）`;
      } else {
        return `${oldMan}万円（価格変更なし）`;
      }
    }
    if (salesPrice) {
      return `${Math.floor(salesPrice / 10000)}万円`;
    }
    if (previousSalesPrice) {
      return `${Math.floor(previousSalesPrice / 10000)}万円`;
    }
    return '';
  };"""

new_generate = """  // 値下げ履歴から前の価格を取得するヘルパー
  const getPrevPriceFromHistory = (history: string | undefined): number | undefined => {
    if (!history) return undefined;
    const lines = history.split('\\n').filter((l: string) => l.trim());
    if (lines.length === 0) return undefined;
    // 形式: "K3/17　1850万→1350万" または "K3/17 1850万→1350万"
    const match = lines[0].match(/(\\d+(?:\\.\\d+)?)万→(\\d+(?:\\.\\d+)?)万/);
    if (!match) return undefined;
    return Math.round(parseFloat(match[1]) * 10000);
  };

  // 価格変更テキストを生成
  const generatePriceChangeText = (): string => {
    // previousSalesPrice が未指定の場合、履歴から取得を試みる
    const prevPrice = previousSalesPrice ?? getPrevPriceFromHistory(priceReductionHistory);

    if (prevPrice && salesPrice) {
      const oldMan = Math.floor(prevPrice / 10000);
      const newMan = Math.floor(salesPrice / 10000);
      const diffMan = oldMan - newMan;
      if (diffMan > 0) {
        return `${oldMan}万円 → ${newMan}万円（${diffMan}万円値下げ）`;
      } else if (diffMan < 0) {
        return `${oldMan}万円 → ${newMan}万円（${Math.abs(diffMan)}万円値上げ）`;
      } else {
        return `${oldMan}万円（価格変更なし）`;
      }
    }
    if (salesPrice) {
      return `${Math.floor(salesPrice / 10000)}万円`;
    }
    if (prevPrice) {
      return `${Math.floor(prevPrice / 10000)}万円`;
    }
    return '';
  };"""

text = text.replace(old_generate, new_generate)

with open('frontend/frontend/src/components/GmailDistributionButton.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('GmailDistributionButton.tsx を修正しました')

# ===== TASK 2: PropertyListingDetailPage.tsx の修正 =====
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 2-1. isHeaderEditMode state を追加
old_edit_states = """  // Edit mode states for each section
  const [isPriceEditMode, setIsPriceEditMode] = useState(false);
  const [isBasicInfoEditMode, setIsBasicInfoEditMode] = useState(false);"""

new_edit_states = """  // Edit mode states for each section
  const [isHeaderEditMode, setIsHeaderEditMode] = useState(false);
  const [isPriceEditMode, setIsPriceEditMode] = useState(false);
  const [isBasicInfoEditMode, setIsBasicInfoEditMode] = useState(false);"""

text = text.replace(old_edit_states, new_edit_states)

# 2-2. handleSaveHeader と handleCancelHeader を追加（handleSaveBasicInfo の前に）
old_save_basic = """  const handleSaveBasicInfo = async () => {
    if (!propertyNumber || Object.keys(editedData).length === 0) return;
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, editedData);
      setSnackbar({
        open: true,
        message: '基本情報を保存しました',
        severity: 'success',
      });
      await fetchPropertyData();
      setEditedData({});
    } catch (error) {
      setSnackbar({
        open: true,
        message: '保存に失敗しました',
        severity: 'error',
      });
      throw error;
    }
  };"""

new_save_basic = """  const handleSaveHeader = async () => {
    if (!propertyNumber || Object.keys(editedData).length === 0) return;
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, editedData);
      setSnackbar({
        open: true,
        message: 'サマリー情報を保存しました',
        severity: 'success',
      });
      await fetchPropertyData();
      setEditedData({});
      setIsHeaderEditMode(false);
    } catch (error) {
      setSnackbar({
        open: true,
        message: '保存に失敗しました',
        severity: 'error',
      });
      throw error;
    }
  };

  const handleCancelHeader = () => {
    setEditedData({});
    setIsHeaderEditMode(false);
  };

  const handleSaveBasicInfo = async () => {
    if (!propertyNumber || Object.keys(editedData).length === 0) return;
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, editedData);
      setSnackbar({
        open: true,
        message: '基本情報を保存しました',
        severity: 'success',
      });
      await fetchPropertyData();
      setEditedData({});
    } catch (error) {
      setSnackbar({
        open: true,
        message: '保存に失敗しました',
        severity: 'error',
      });
      throw error;
    }
  };"""

text = text.replace(old_save_basic, new_save_basic)

# 2-3. GmailDistributionButton に priceReductionHistory プロップを追加
old_gmail_button = """          <GmailDistributionButton
            propertyNumber={data.property_number}
            propertyAddress={data.address || data.display_address}
            publicUrl={`https://property-site-frontend-kappa.vercel.app/public/properties/${data.property_number}`}
            distributionAreas={editedData.distribution_areas !== undefined ? editedData.distribution_areas : data.distribution_areas}
            salesPrice={editedData.sales_price !== undefined ? editedData.sales_price : data.sales_price}
            previousSalesPrice={getPreviousPriceFromHistory(data.price_reduction_history)}
            propertyType={editedData.property_type !== undefined ? editedData.property_type : data.property_type}
            size="medium"
            variant="contained"
          />"""

new_gmail_button = """          <GmailDistributionButton
            propertyNumber={data.property_number}
            propertyAddress={data.address || data.display_address}
            publicUrl={`https://property-site-frontend-kappa.vercel.app/public/properties/${data.property_number}`}
            distributionAreas={editedData.distribution_areas !== undefined ? editedData.distribution_areas : data.distribution_areas}
            salesPrice={editedData.sales_price !== undefined ? editedData.sales_price : data.sales_price}
            previousSalesPrice={getPreviousPriceFromHistory(data.price_reduction_history)}
            priceReductionHistory={data.price_reduction_history}
            propertyType={editedData.property_type !== undefined ? editedData.property_type : data.property_type}
            size="medium"
            variant="contained"
          />"""

text = text.replace(old_gmail_button, new_gmail_button)

# 2-4. サマリーエリアを編集可能にする
# ATBB状況の選択肢を定義し、編集モードのUIに変更
old_header_paper = """      {/* Property Header - Key Information */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">所在地</Typography>
            <Typography variant="body1" fontWeight="medium">
              {data.address || data.display_address || '-'}
            </Typography>
            {data.display_address && data.address && data.display_address !== data.address && (
              <Box sx={{ mt: 0.5 }}>
                <Typography variant="body2" color="text.secondary" fontWeight="bold">住居表示</Typography>
                <Typography variant="body2" color="text.secondary">
                  {data.display_address}
                </Typography>
              </Box>
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">売主氏名</Typography>
            <Typography variant="body1" fontWeight="medium">
              {data.seller_name || '-'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">ATBB状況</Typography>
            <Typography variant="body1" fontWeight="medium">
              {getDisplayStatus(data.atbb_status) || '-'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">種別</Typography>
            <Typography variant="body1" fontWeight="medium">
              {data.property_type || '-'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">現況</Typography>
            <Typography variant="body1" fontWeight="medium">
              {data.current_status || '-'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">担当</Typography>
            <Typography variant="body1" fontWeight="medium">
              {data.sales_assignee || '-'}
            </Typography>
          </Grid>
        </Grid>
      </Paper>"""

new_header_paper = """      {/* Property Header - Key Information */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="bold">物件概要</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isHeaderEditMode ? (
              <>
                <Button size="small" variant="contained" onClick={handleSaveHeader} disabled={Object.keys(editedData).length === 0}>
                  保存
                </Button>
                <Button size="small" variant="outlined" onClick={handleCancelHeader}>
                  キャンセル
                </Button>
              </>
            ) : (
              <Button size="small" variant="outlined" onClick={() => setIsHeaderEditMode(true)}>
                編集
              </Button>
            )}
          </Box>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">所在地</Typography>
            {isHeaderEditMode ? (
              <TextField
                size="small"
                fullWidth
                value={editedData.address !== undefined ? editedData.address : (data.address || '')}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                sx={{ mt: 0.5 }}
              />
            ) : (
              <Typography variant="body1" fontWeight="medium">
                {data.address || data.display_address || '-'}
              </Typography>
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">売主氏名</Typography>
            {isHeaderEditMode ? (
              <TextField
                size="small"
                fullWidth
                value={editedData.seller_name !== undefined ? editedData.seller_name : (data.seller_name || '')}
                onChange={(e) => handleFieldChange('seller_name', e.target.value)}
                sx={{ mt: 0.5 }}
              />
            ) : (
              <Typography variant="body1" fontWeight="medium">
                {data.seller_name || '-'}
              </Typography>
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">ATBB状況</Typography>
            {isHeaderEditMode ? (
              <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
                <Select
                  value={editedData.atbb_status !== undefined ? editedData.atbb_status : (data.atbb_status || '')}
                  onChange={(e) => handleFieldChange('atbb_status', e.target.value)}
                  displayEmpty
                >
                  <MenuItem value=""><em>未設定</em></MenuItem>
                  <MenuItem value="専任・公開中">専任・公開中</MenuItem>
                  <MenuItem value="一般・公開中">一般・公開中</MenuItem>
                  <MenuItem value="非公開（配信メールのみ）">非公開（配信メールのみ）</MenuItem>
                  <MenuItem value="非公開案件">非公開案件</MenuItem>
                  <MenuItem value="atbb成約済み">atbb成約済み</MenuItem>
                  <MenuItem value="atbb非公開">atbb非公開</MenuItem>
                </Select>
              </FormControl>
            ) : (
              <Typography variant="body1" fontWeight="medium">
                {getDisplayStatus(data.atbb_status) || '-'}
              </Typography>
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">種別</Typography>
            {isHeaderEditMode ? (
              <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
                <Select
                  value={editedData.property_type !== undefined ? editedData.property_type : (data.property_type || '')}
                  onChange={(e) => handleFieldChange('property_type', e.target.value)}
                  displayEmpty
                >
                  <MenuItem value=""><em>未設定</em></MenuItem>
                  <MenuItem value="土地">土地</MenuItem>
                  <MenuItem value="戸建て">戸建て</MenuItem>
                  <MenuItem value="マンション">マンション</MenuItem>
                  <MenuItem value="収益物件">収益物件</MenuItem>
                  <MenuItem value="その他">その他</MenuItem>
                </Select>
              </FormControl>
            ) : (
              <Typography variant="body1" fontWeight="medium">
                {data.property_type || '-'}
              </Typography>
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">現況</Typography>
            {isHeaderEditMode ? (
              <TextField
                size="small"
                fullWidth
                value={editedData.current_status !== undefined ? editedData.current_status : (data.current_status || '')}
                onChange={(e) => handleFieldChange('current_status', e.target.value)}
                sx={{ mt: 0.5 }}
              />
            ) : (
              <Typography variant="body1" fontWeight="medium">
                {data.current_status || '-'}
              </Typography>
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">担当</Typography>
            {isHeaderEditMode ? (
              <TextField
                size="small"
                fullWidth
                value={editedData.sales_assignee !== undefined ? editedData.sales_assignee : (data.sales_assignee || '')}
                onChange={(e) => handleFieldChange('sales_assignee', e.target.value)}
                sx={{ mt: 0.5 }}
              />
            ) : (
              <Typography variant="body1" fontWeight="medium">
                {data.sales_assignee || '-'}
              </Typography>
            )}
          </Grid>
        </Grid>
      </Paper>"""

text = text.replace(old_header_paper, new_header_paper)

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('PropertyListingDetailPage.tsx を修正しました')
print('完了！')
