import React, { useRef, useEffect, useImperativeHandle } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { FormatBold, FormatColorText } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

export interface RichTextCommentEditorHandle {
  insertAtCursor: (html: string) => void;
}

interface RichTextCommentEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const EditorContainer = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  minHeight: '300px',
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  cursor: 'text',
  '&:focus-within': {
    borderColor: theme.palette.primary.main,
    borderWidth: '2px',
    padding: `calc(${theme.spacing(2)} - 1px)`,
  },
  '&.disabled': {
    backgroundColor: theme.palette.action.disabledBackground,
    cursor: 'not-allowed',
  },
}));

const ContentEditable = styled('div')(({ theme }) => ({
  minHeight: '280px',
  outline: 'none',
  fontFamily: theme.typography.fontFamily,
  fontSize: theme.typography.body1.fontSize,
  lineHeight: 1.6,
  color: theme.palette.text.primary,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  '&:empty:before': {
    content: 'attr(data-placeholder)',
    color: theme.palette.text.disabled,
    pointerEvents: 'none',
  },
  '& b, & strong': { fontWeight: 'bold' },
  '& font[color="red"]': { color: 'red' },
}));

const RichTextCommentEditor = React.forwardRef<RichTextCommentEditorHandle, RichTextCommentEditorProps>(
  ({ value, onChange, placeholder = 'コメントを入力...', disabled = false }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const isFocusedRef = useRef<boolean>(false);
    const isInsertingRef = useRef<boolean>(false);
    // カーソル位置を Range として保存（フォーカスが外れた後も使える）
    const savedRangeRef = useRef<Range | null>(null);

    // 初期値の設定（フォーカス中・挿入中は上書きしない）
    useEffect(() => {
      if (
        editorRef.current &&
        !isFocusedRef.current &&
        !isInsertingRef.current &&
        editorRef.current.innerHTML !== value
      ) {
        editorRef.current.innerHTML = value;
        // 値が外部から変わったらカーソル位置をリセット
        savedRangeRef.current = null;
      }
    }, [value]);

    const handleInput = () => {
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    };

    const handleFocus = () => {
      isFocusedRef.current = true;
    };

    const handleBlur = () => {
      // フォーカスが外れる直前のカーソル位置を保存
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current) {
        const range = sel.getRangeAt(0);
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          savedRangeRef.current = range.cloneRange();
        }
      }
      isFocusedRef.current = false;
    };

    // selectionchange でリアルタイムにカーソル位置を保存
    useEffect(() => {
      const onSelectionChange = () => {
        if (isFocusedRef.current && editorRef.current) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (editorRef.current.contains(range.commonAncestorContainer)) {
              savedRangeRef.current = range.cloneRange();
            }
          }
        }
      };
      document.addEventListener('selectionchange', onSelectionChange);
      return () => document.removeEventListener('selectionchange', onSelectionChange);
    }, []);

    const handleContainerClick = () => {
      if (editorRef.current && !disabled) {
        editorRef.current.focus();
      }
    };

    const handleBold = () => {
      document.execCommand('bold', false);
      handleInput();
    };

    const handleRedText = () => {
      document.execCommand('foreColor', false, 'red');
      handleInput();
    };

    useImperativeHandle(ref, () => ({
      insertAtCursor: (html: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        isInsertingRef.current = true;

        const savedRange = savedRangeRef.current;

        if (savedRange) {
          // 保存済みカーソル位置に挿入
          try {
            const range = savedRange.cloneRange();
            range.deleteContents();

            const fragment = range.createContextualFragment(html);
            const lastNode = fragment.lastChild;
            range.insertNode(fragment);

            // 挿入後のカーソル位置を更新
            if (lastNode) {
              const newRange = document.createRange();
              newRange.setStartAfter(lastNode);
              newRange.collapse(true);
              savedRangeRef.current = newRange.cloneRange();

              // Selectionも更新（エディタがフォーカスされていれば見た目にも反映）
              const sel = window.getSelection();
              if (sel) {
                sel.removeAllRanges();
                sel.addRange(newRange);
              }
            }

            handleInput();
            isInsertingRef.current = false;
            return;
          } catch (e) {
            // フォールバックへ
          }
        }

        // フォールバック: カーソル位置不明 → 先頭に挿入
        editor.innerHTML = html + editor.innerHTML;
        handleInput();
        isInsertingRef.current = false;
      },
    }));

    return (
      <Box>
        <Box sx={{ mb: 1, display: 'flex', gap: 1 }}>
          <Tooltip title="太字">
            <IconButton size="small" onClick={handleBold} disabled={disabled}>
              <FormatBold />
            </IconButton>
          </Tooltip>
          <Tooltip title="赤字">
            <IconButton size="small" onClick={handleRedText} disabled={disabled}>
              <FormatColorText sx={{ color: 'red' }} />
            </IconButton>
          </Tooltip>
        </Box>
        <EditorContainer onClick={handleContainerClick} className={disabled ? 'disabled' : ''}>
          <ContentEditable
            ref={editorRef}
            contentEditable={!disabled}
            onInput={handleInput}
            onFocus={handleFocus}
            onBlur={handleBlur}
            data-placeholder={placeholder}
            suppressContentEditableWarning
          />
        </EditorContainer>
      </Box>
    );
  }
);

RichTextCommentEditor.displayName = 'RichTextCommentEditor';

export default RichTextCommentEditor;
