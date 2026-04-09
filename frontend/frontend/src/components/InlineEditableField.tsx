import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  Typography,
  CircularProgress,
  Tooltip,
  Autocomplete,
} from '@mui/material';
import {
  Lock as LockIcon,
  Check as CheckIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from '@mui/icons-material';
import { useInlineEdit } from '../hooks/useInlineEdit';
import { ValidationRule, getValidationRulesForFieldType } from '../utils/fieldValidation';
import { FieldPermissions, getFieldMetadata } from '../types/fieldPermissions';
import { ConflictNotification } from './ConflictNotification';

export interface InlineEditableFieldProps {
  value: any;
  fieldName: string;
  fieldType: 'text' | 'email' | 'phone' | 'date' | 'time' | 'dropdown' | 'textarea' | 'number';
  onSave: (value: any) => Promise<void>;
  validation?: (value: any) => string | null;
  validationRules?: ValidationRule[];
  readOnly?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: any; category?: string }>;
  multiline?: boolean;
  permissions?: FieldPermissions;
  label?: string;
  buyerId?: string;
  enableConflictDetection?: boolean;
  alwaysShowBorder?: boolean;  // 常に囲い枠を表示するかどうか
  borderPlaceholder?: string;  // 囲い枠内に表示するプレースホルダー
  showEditIndicator?: boolean;  // 編集可能インジケーターを常時表示するか（デフォルト: true）
  onChange?: (fieldName: string, newValue: any) => void;  // 値変更時のコールバック（保存前）
  highlighted?: boolean;  // フィールドを強調表示するかどうか
  helperText?: string;  // フィールド下部に表示する説明文
}

export const InlineEditableField: React.FC<InlineEditableFieldProps> = memo(({
  value,
  fieldName,
  fieldType,
  onSave,
  validation,
  validationRules,
  readOnly = false,
  placeholder = '',
  options = [],
  multiline = false,
  permissions,
  label,
  buyerId,
  enableConflictDetection = true,
  alwaysShowBorder = false,
  borderPlaceholder,
  showEditIndicator = true,
  onChange,
  highlighted = false,
  helperText,
}) => {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  
  // handleBlurの重複呼び出しを防ぐためのフラグ
  const isBlurringRef = useRef(false);

  // Cache field metadata to avoid repeated lookups
  const fieldMetadata = useMemo(() => getFieldMetadata(fieldName), [fieldName]);
  
  // Memoize effective permissions to prevent unnecessary recalculations
  const effectivePermissions = useMemo(
    () => permissions || fieldMetadata?.permissions || { canEdit: true },
    [permissions, fieldMetadata]
  );
  
  // Memoize effective read-only state
  const effectiveReadOnly = useMemo(
    () => readOnly || fieldMetadata?.readOnly || false,
    [readOnly, fieldMetadata]
  );

  // Cache validation rules to avoid repeated lookups
  const effectiveValidationRules = useMemo(
    () => validationRules || fieldMetadata?.validation || getValidationRulesForFieldType(fieldType, fieldName),
    [validationRules, fieldMetadata, fieldType, fieldName]
  );

  const {
    isEditing,
    editValue,
    error,
    isSaving,
    saveSuccess,
    hasConflict,
    conflictInfo,
    startEdit,
    cancelEdit,
    updateValue,
    saveValue,
    resolveConflict,
    clearConflict,
  } = useInlineEdit({
    initialValue: value,
    onSave,
    validation,
    validationRules: effectiveValidationRules,
    fieldName,
    buyerId,
    enableConflictDetection,
  });

  // onChange コールバック付きの値更新ハンドラー
  const handleChange = (newValue: any) => {
    updateValue(newValue);
    if (onChange) {
      onChange(fieldName, newValue);
    }
  };

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Check if field is editable
  const isEditable = useMemo(
    () => !effectiveReadOnly && effectivePermissions.canEdit,
    [effectiveReadOnly, effectivePermissions]
  );

  // Handle click to activate edit mode
  const handleClick = () => {
    if (isEditable && !isEditing) {
      startEdit();
      // ドロップダウン型はクリック即座にプルダウンを開く
      if (fieldType === 'dropdown') {
        setSelectOpen(true);
      }
    }
  };

  // Handle blur to save (値が変わっていない場合はキャンセル)
  const handleBlur = async () => {
    // 既にblur処理中の場合は何もしない（重複呼び出しを防ぐ）
    if (isBlurringRef.current) {
      return;
    }
    
    // 既に保存処理中の場合は何もしない（重複呼び出しを防ぐ）
    if (isSaving) {
      return;
    }
    
    if (isEditing && !isSaving) {
      // blur処理開始フラグを立てる
      isBlurringRef.current = true;
      
      // 値が変わっていない場合はキャンセル
      const currentVal = editValue ?? '';
      const originalVal = value ?? '';
      if (String(currentVal) === String(originalVal)) {
        isBlurringRef.current = false;
        cancelEdit();
        return;
      }
      
      try {
        await saveValue();
      } finally {
        // blur処理終了フラグをリセット
        isBlurringRef.current = false;
      }
    }
  };

  // Handle keyboard events
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
      return;
    }

    if (e.key === 'Enter') {
      if (fieldType === 'textarea') {
        return; // Allow line breaks in textarea
      } else {
        e.preventDefault();
        await saveValue();
        return;
      }
    }
  };

  // Format display value
  const getDisplayValue = () => {
    if (value === null || value === undefined || value === '') {
      return borderPlaceholder || placeholder || '-';
    }

    if (fieldType === 'dropdown' && options.length > 0) {
      const option = options.find((opt) => opt.value === value);
      return option ? option.label : value;
    }

    if (fieldType === 'date' && value) {
      try {
        return new Date(value).toLocaleDateString('ja-JP');
      } catch {
        return value;
      }
    }

    if (fieldType === 'time' && value) {
      const strVal = String(value);
      // 数値文字列（シリアル値）の場合: 0.416667 = 10:00
      const num = parseFloat(strVal);
      if (!isNaN(num) && num >= 0 && num < 1) {
        const totalMinutes = Math.round(num * 24 * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
      // "HH:mm" や "HH:mm:ss" 形式
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(strVal)) {
        return strVal.substring(0, 5);
      }
      // "Sat Dec 30 1899 15:00:00 GMT+0900..." のような不正な日付文字列
      const timeMatch = strVal.match(/(\d{1,2}):(\d{2}):\d{2}\s+GMT/);
      if (timeMatch) {
        return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      }
    }

    return String(value);
  };

  // Render input based on field type
  const renderInput = () => {
    const commonProps = {
      inputRef: inputRef,
      value: editValue ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        handleChange(e.target.value),
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      placeholder,
      disabled: isSaving,
      error: !!error,
      helperText: error,
      fullWidth: true,
      size: 'small' as const,
      autoFocus: true,
      sx: { mt: 0.5 },
    };

    switch (fieldType) {
      case 'textarea':
        return (
          <TextField
            {...commonProps}
            multiline
            minRows={6}
            maxRows={20}
            sx={{
              ...commonProps.sx,
              '& .MuiInputBase-root': {
                minHeight: alwaysShowBorder ? 120 : 80,
              },
            }}
          />
        );

      case 'dropdown':
        // Check if options have categories (for grouped dropdown)
        const hasCategories = options.some(opt => opt.category);
        
        if (hasCategories) {
          return (
            <Autocomplete
              fullWidth
              size="small"
              options={options}
              groupBy={(option) => option.category || ''}
              getOptionLabel={(option) => option.label}
              value={options.find(opt => opt.value === editValue) || null}
              onChange={(_, newValue) => handleChange(newValue?.value || '')}
              onBlur={handleBlur}
              disabled={isSaving}
              open={selectOpen}
              onOpen={() => setSelectOpen(true)}
              onClose={() => setSelectOpen(false)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={placeholder || '選択してください'}
                  error={!!error}
                  helperText={error}
                  sx={{ mt: 0.5 }}
                  autoFocus
                />
              )}
              renderGroup={(params) => (
                <li key={params.key}>
                  <Typography
                    component="div"
                    sx={{
                      position: 'sticky',
                      top: -8,
                      padding: '4px 10px',
                      color: 'primary.main',
                      backgroundColor: 'background.paper',
                      fontWeight: 'bold',
                      fontSize: '0.875rem',
                    }}
                  >
                    {params.group}
                  </Typography>
                  <ul style={{ padding: 0 }}>{params.children}</ul>
                </li>
              )}
            />
          );
        }

        return (
          <FormControl fullWidth size="small" sx={{ mt: 0.5 }} error={!!error}>
            <Select
              value={editValue ?? ''}
              onChange={async (e) => {
                const newVal = e.target.value;
                updateValue(newVal);
                setSelectOpen(false);
                // ドロップダウン選択後は blur が発火しないため直接 onSave を呼ぶ
                // saveValue() は editValue の古い state を参照するため onSave を直接呼ぶ
                try {
                  await onSave(newVal);
                } catch (err) {
                  // エラーは handleBlur 経由の saveValue と同様に無視（呼び出し元でハンドル）
                }
              }}
              onBlur={handleBlur}
              disabled={isSaving}
              open={selectOpen}
              onOpen={() => setSelectOpen(true)}
              onClose={() => setSelectOpen(false)}
            >
              <MenuItem value="">選択してください</MenuItem>
              {options.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            {error && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                {error}
              </Typography>
            )}
          </FormControl>
        );

      case 'time':
        return (
          <TextField
            {...commonProps}
            type="time"
            InputLabelProps={{ shrink: true }}
            inputProps={{ step: 300 }}
          />
        );

      case 'date':
        // HTML5 date input requires YYYY-MM-DD format
        const dateValue = editValue ? String(editValue).split('T')[0] : '';
        return (
          <TextField
            {...commonProps}
            value={dateValue}
            type="date"
            InputLabelProps={{ shrink: true }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              // 空文字の場合はnullを設定（timestampエラーを防ぐ）
              const newValue = e.target.value === '' ? null : e.target.value;
              handleChange(newValue);
            }}
          />
        );

      case 'number':
        return <TextField {...commonProps} type="number" />;

      case 'email':
        return <TextField {...commonProps} type="email" />;

      case 'phone':
        return <TextField {...commonProps} type="tel" />;

      case 'text':
      default:
        return <TextField {...commonProps} type="text" />;
    }
  };

  return (
    <Box sx={{ mb: 1 }}>
      {label && (
        <Typography 
          variant="caption" 
          color={highlighted ? '#f57c00' : 'text.secondary'}
          sx={{ 
            display: 'block', 
            mb: 0.5,
            fontWeight: highlighted ? 600 : 400,
          }}
        >
          {label}
        </Typography>
      )}
      
      {isEditing ? (
        <Box sx={{ position: 'relative' }}>
          {renderInput()}
          {isSaving && (
            <Box sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
              <CircularProgress size={16} />
            </Box>
          )}
        </Box>
      ) : (
        <Box
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          sx={{
            display: 'flex',
            alignItems: (alwaysShowBorder || showEditIndicator) && fieldType === 'textarea' ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            px: 1.5,
            py: 1,
            borderRadius: 1,
            cursor: isEditable ? 'pointer' : 'default',
            border: '1px solid',
            // 強調表示の場合は太いボーダーと目立つ色
            borderWidth: highlighted ? 2 : 1,
            // 編集可能フィールドには常時ボーダーを表示（showEditIndicator有効時）
            borderColor: highlighted 
              ? (isHovered ? '#ff9800' : '#ffa726')  // オレンジ系の目立つ色
              : (isEditable && showEditIndicator
                ? (isHovered ? 'primary.main' : 'rgba(0, 0, 0, 0.23)')
                : (alwaysShowBorder 
                    ? (isEditable && isHovered ? 'primary.main' : 'rgba(0, 0, 0, 0.23)')
                    : (isEditable && isHovered ? 'primary.main' : 'transparent'))),
            bgcolor: highlighted
              ? (isHovered ? '#fff3e0' : '#fff8e1')  // 薄いオレンジの背景
              : (isEditable && isHovered ? 'action.hover' : 
                 (alwaysShowBorder || (isEditable && showEditIndicator) ? 'background.paper' : 'transparent')),
            transition: 'all 0.2s ease',
            minHeight: (alwaysShowBorder || showEditIndicator) && fieldType === 'textarea' ? 120 : 36,
            '&:hover': isEditable ? {
              borderColor: highlighted ? '#ff9800' : 'primary.main',
              bgcolor: highlighted ? '#fff3e0' : 'action.hover',
            } : {},
          }}
        >
          <Typography
            variant="body2"
            sx={{
              whiteSpace: fieldType === 'textarea' ? 'pre-wrap' : 'normal',
              wordBreak: 'break-word',
              flex: 1,
              color: (value === null || value === undefined || value === '') ? 'text.disabled' : 'text.primary',
            }}
          >
            {getDisplayValue()}
          </Typography>
          
          {/* ドロップダウンフィールドには常時矢印アイコンを表示 */}
          {isEditable && fieldType === 'dropdown' && showEditIndicator && (
            <ArrowDropDownIcon 
              sx={{ 
                ml: 0.5, 
                fontSize: 20, 
                color: isHovered ? 'primary.main' : 'text.secondary',
                transition: 'color 0.2s ease',
              }} 
            />
          )}
          
          {!isEditable && (
            <Tooltip title={effectivePermissions.reason || '編集不可'}>
              <LockIcon sx={{ ml: 1, fontSize: 16, color: 'text.disabled' }} />
            </Tooltip>
          )}
          
          {isEditable && isHovered && (
            <Typography variant="caption" color="primary" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
              クリックして編集
            </Typography>
          )}
        </Box>
      )}

      {/* Success message */}
      {saveSuccess && !isSaving && !error && (
        <Typography variant="caption" color="success.main" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
          <CheckIcon sx={{ fontSize: 14, mr: 0.5 }} />
          保存しました
        </Typography>
      )}

      {/* Helper text */}
      {helperText && !isEditing && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 1.5 }}>
          {helperText}
        </Typography>
      )}

      {/* Conflict notification */}
      {hasConflict && conflictInfo && (
        <ConflictNotification
          conflict={conflictInfo}
          fieldName={label || fieldName}
          onResolve={async (resolution) => {
            await resolveConflict(resolution);
          }}
          onCancel={() => {
            clearConflict();
            cancelEdit();
          }}
        />
      )}
    </Box>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.fieldName === nextProps.fieldName &&
    prevProps.fieldType === nextProps.fieldType &&
    prevProps.readOnly === nextProps.readOnly &&
    prevProps.placeholder === nextProps.placeholder &&
    prevProps.multiline === nextProps.multiline &&
    prevProps.label === nextProps.label &&
    prevProps.buyerId === nextProps.buyerId &&
    prevProps.enableConflictDetection === nextProps.enableConflictDetection &&
    prevProps.alwaysShowBorder === nextProps.alwaysShowBorder &&
    prevProps.borderPlaceholder === nextProps.borderPlaceholder &&
    prevProps.showEditIndicator === nextProps.showEditIndicator &&
    prevProps.onChange === nextProps.onChange &&
    prevProps.helperText === nextProps.helperText &&
    JSON.stringify(prevProps.options) === JSON.stringify(nextProps.options) &&
    JSON.stringify(prevProps.permissions) === JSON.stringify(nextProps.permissions)
  );
});
