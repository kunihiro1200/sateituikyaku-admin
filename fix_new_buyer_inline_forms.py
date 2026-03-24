#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NewBuyerPage.tsx に希望条件・内覧フォームをインラインで追加する
"""

import re

filepath = 'frontend/frontend/src/pages/NewBuyerPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== 1. import 追加 =====
old_import = "import { LATEST_STATUS_OPTIONS } from '../utils/buyerLatestStatusOptions';"
new_import = """import { LATEST_STATUS_OPTIONS } from '../utils/buyerLatestStatusOptions';
import {
  AREA_OPTIONS,
  DESIRED_PROPERTY_TYPE_OPTIONS,
  PARKING_SPACES_OPTIONS,
  PRICE_RANGE_DETACHED_OPTIONS,
  PRICE_RANGE_MANSION_OPTIONS,
  PRICE_RANGE_LAND_OPTIONS,
  BUILDING_AGE_OPTIONS,
  FLOOR_PLAN_OPTIONS,
} from '../utils/buyerDesiredConditionsOptions';"""

text = text.replace(old_import, new_import)

# ===== 2. state 追加（希望条件・内覧） =====
old_state = """  // 希望条件
  const [desiredArea, setDesiredArea] = useState('');
  const [desiredPropertyType, setDesiredPropertyType] = useState('');
  const [budget, setBudget] = useState('');"""

new_state = """  // 希望条件（詳細）
  const [desiredArea, setDesiredArea] = useState<string[]>([]);
  const [desiredPropertyType, setDesiredPropertyType] = useState('');
  const [desiredBuildingAge, setDesiredBuildingAge] = useState('');
  const [desiredFloorPlan, setDesiredFloorPlan] = useState('');
  const [budget, setBudget] = useState('');
  const [priceRangeHouse, setPriceRangeHouse] = useState('');
  const [priceRangeApartment, setPriceRangeApartment] = useState('');
  const [priceRangeLand, setPriceRangeLand] = useState('');
  const [parkingSpaces, setParkingSpaces] = useState('');

  // 内覧情報
  const [latestViewingDate, setLatestViewingDate] = useState('');
  const [viewingTime, setViewingTime] = useState('');
  const [followUpAssignee, setFollowUpAssignee] = useState('');
  const [viewingResultFollowUp, setViewingResultFollowUp] = useState('');"""

text = text.replace(old_state, new_state)

# ===== 3. handleSubmit の buyerData に追加フィールドを追加 =====
old_buyer_data = """      const buyerData = {
        name,
        phone_number: phoneNumber,
        email,
        company_name: companyName,
        broker_inquiry: companyName.trim() ? brokerInquiry : '',
        property_number: propertyNumberField,
        reception_date: receptionDate,
        inquiry_source: inquirySource,
        inquiry_hearing: inquiryHearing,
        latest_status: latestStatus,
        initial_assignee: initialAssignee,
        desired_area: desiredArea,
        desired_property_type: desiredPropertyType,
        budget,
      };"""

new_buyer_data = """      const buyerData = {
        name,
        phone_number: phoneNumber,
        email,
        company_name: companyName,
        broker_inquiry: companyName.trim() ? brokerInquiry : '',
        property_number: propertyNumberField,
        reception_date: receptionDate,
        inquiry_source: inquirySource,
        inquiry_hearing: inquiryHearing,
        latest_status: latestStatus,
        initial_assignee: initialAssignee,
        // 希望条件
        desired_area: desiredArea.join('|'),
        desired_property_type: desiredPropertyType,
        desired_building_age: desiredBuildingAge,
        desired_floor_plan: desiredFloorPlan,
        budget,
        price_range_house: priceRangeHouse,
        price_range_apartment: priceRangeApartment,
        price_range_land: priceRangeLand,
        parking_spaces: parkingSpaces,
        // 内覧情報
        latest_viewing_date: latestViewingDate || null,
        viewing_time: viewingTime || null,
        follow_up_assignee: followUpAssignee || null,
        viewing_result_follow_up: viewingResultFollowUp || null,
      };"""

text = text.replace(old_buyer_data, new_buyer_data)

# ===== 4. 希望条件セクションのフォームを置き換え =====
old_desired_section = """                {/* 希望条件 */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>希望条件</Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="希望エリア"
                    value={desiredArea}
                    onChange={(e) => setDesiredArea(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="希望種別"
                    value={desiredPropertyType}
                    onChange={(e) => setDesiredPropertyType(e.target.value)}
                    placeholder="例: 戸建て、マンション"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="予算"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="例: 3000万円"
                  />
                </Grid>"""

new_desired_section = """                {/* 希望条件 */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>希望条件</Typography>
                </Grid>

                {/* エリア（複数選択） */}
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    ★エリア（複数選択可）
                  </Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      multiple
                      value={desiredArea}
                      onChange={(e) => setDesiredArea(e.target.value as string[])}
                      input={<OutlinedInput />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((val) => {
                            const opt = AREA_OPTIONS.find((o) => o.value === val);
                            return (
                              <Chip
                                key={val}
                                label={opt ? opt.label : val}
                                size="small"
                                onDelete={(e) => {
                                  e.stopPropagation();
                                  setDesiredArea(desiredArea.filter((v) => v !== val));
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                              />
                            );
                          })}
                        </Box>
                      )}
                      MenuProps={{ PaperProps: { style: { maxHeight: 400 } } }}
                    >
                      {AREA_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value} dense>
                          <Checkbox size="small" checked={desiredArea.includes(opt.value)} sx={{ p: 0, mr: 1 }} />
                          <Typography variant="body2">{opt.label}</Typography>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>★希望種別</InputLabel>
                    <Select
                      value={desiredPropertyType}
                      label="★希望種別"
                      onChange={(e) => setDesiredPropertyType(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {DESIRED_PROPERTY_TYPE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>★築年数</InputLabel>
                    <Select
                      value={desiredBuildingAge}
                      label="★築年数"
                      onChange={(e) => setDesiredBuildingAge(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {BUILDING_AGE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>★間取り</InputLabel>
                    <Select
                      value={desiredFloorPlan}
                      label="★間取り"
                      onChange={(e) => setDesiredFloorPlan(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {FLOOR_PLAN_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="予算"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="例: 3000万円"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>価格帯（戸建）</InputLabel>
                    <Select
                      value={priceRangeHouse}
                      label="価格帯（戸建）"
                      onChange={(e) => setPriceRangeHouse(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {PRICE_RANGE_DETACHED_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>価格帯（マンション）</InputLabel>
                    <Select
                      value={priceRangeApartment}
                      label="価格帯（マンション）"
                      onChange={(e) => setPriceRangeApartment(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {PRICE_RANGE_MANSION_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>価格帯（土地）</InputLabel>
                    <Select
                      value={priceRangeLand}
                      label="価格帯（土地）"
                      onChange={(e) => setPriceRangeLand(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {PRICE_RANGE_LAND_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>●P台数</InputLabel>
                    <Select
                      value={parkingSpaces}
                      label="●P台数"
                      onChange={(e) => setParkingSpaces(e.target.value)}
                    >
                      <MenuItem value=""><em>未選択</em></MenuItem>
                      {PARKING_SPACES_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* 内覧情報 */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>内覧情報（任意）</Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="内覧日"
                    type="date"
                    value={latestViewingDate}
                    onChange={(e) => setLatestViewingDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="内覧時間"
                    value={viewingTime}
                    onChange={(e) => setViewingTime(e.target.value)}
                    placeholder="例: 14:00"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    後続担当
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {normalInitials.map((initial) => (
                      <Chip
                        key={initial}
                        label={initial}
                        size="small"
                        onClick={() => setFollowUpAssignee(followUpAssignee === initial ? '' : initial)}
                        color={followUpAssignee === initial ? 'success' : 'default'}
                        variant={followUpAssignee === initial ? 'filled' : 'outlined'}
                        sx={{ cursor: 'pointer', fontWeight: followUpAssignee === initial ? 'bold' : 'normal' }}
                      />
                    ))}
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="内覧結果・後続対応"
                    multiline
                    rows={3}
                    value={viewingResultFollowUp}
                    onChange={(e) => setViewingResultFollowUp(e.target.value)}
                    placeholder="内覧結果や後続対応の内容を入力してください"
                  />
                </Grid>"""

text = text.replace(old_desired_section, new_desired_section)

# ===== 5. Checkbox import を追加（MUI） =====
old_mui_import = """import {
  Container,
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Autocomplete,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
} from '@mui/material';"""

new_mui_import = """import {
  Container,
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Autocomplete,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  OutlinedInput,
  Checkbox,
} from '@mui/material';"""

text = text.replace(old_mui_import, new_mui_import)

# UTF-8 で書き込み
with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! NewBuyerPage.tsx updated successfully.')
