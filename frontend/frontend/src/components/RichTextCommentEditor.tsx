import React, { useRef, useEffect, useImperativeHandle } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { FormatBold, FormatColorText } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// \u30ab\u30fc\u30bd\u30eb\u4f4d\u7f6e\u633f\u5165\u30e1\u30bd\u30c3\u30c9\u3092\u516c\u958b\u3059\u308b\u30cf\u30f3\u30c9\u30eb\u578b
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
  '& b, & strong': {
    fontWeight: 'bold',
  },
  '& font[color="red"]': {
    color: 'red',
  },
}));

const RichTextCommentEditor = React.forwardRef<RichTextCommentEditorHandle, RichTextCommentEditorProps>(
  (
    {
      value,
      onChange,
      placeholder = '\u30b3\u30e1\u30f3\u30c8\u3092\u5165\u529b...',
      disabled = false,
    },
    ref
  ) => {
    const editorRef = useRef<HTMLDivElement>(null);
    // \u30ab\u30fc\u30bd\u30eb\u4f4d\u7f6e\uff08Range\uff09\u3092\u4fdd\u5b58\u3059\u308bref
    // selectionchange \u3067\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u66f4\u65b0\u3059\u308b\u305f\u3081\u3001blur \u3088\u308a\u5148\u306b\u8a18\u9332\u3055\u308c\u308b
    const savedRangeRef = useRef<Range | null>(null);
    // insertAtCursor 実行中は selectionchange による savedRangeRef の上書きを防ぐ
    const isInsertingRef = useRef<boolean>(false);

    // \u521d\u671f\u5024\u306e\u8a2d\u5b9a
    useEffect(() => {
      if (editorRef.current && editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }, [value]);

    // selectionchange \u30a4\u30d9\u30f3\u30c8\u3067\u30ab\u30fc\u30bd\u30eb\u4f4d\u7f6e\u3092\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u4fdd\u5b58
    // blur \u3088\u308a\u5148\u306b\u767a\u706b\u3059\u308b\u305f\u3081\u3001\u30af\u30a4\u30c3\u30af\u30dc\u30bf\u30f3\u30af\u30ea\u30c3\u30af\u6642\u3082\u30ab\u30fc\u30bd\u30eb\u4f4d\u7f6e\u304c\u4fdd\u6301\u3055\u308c\u308b
    useEffect(() => {
      const handleSelectionChange = () => {
        // insertAtCursor 実行中は上書きしない
        if (isInsertingRef.current) return;
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && editorRef.current) {
          const range = selection.getRangeAt(0);
          if (editorRef.current.contains(range.commonAncestorContainer)) {
            savedRangeRef.current = range.cloneRange();
          }
        }
      };

      document.addEventListener('selectionchange', handleSelectionChange);
      return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
      };
    }, []);

    // \u30b3\u30f3\u30c6\u30f3\u30c4\u5909\u66f4\u6642\u306e\u30cf\u30f3\u30c9\u30e9\u30fc
    const handleInput = () => {
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    };

    // \u30b3\u30f3\u30c6\u30ca\u30af\u30ea\u30c3\u30af\u6642\u306b\u30a8\u30c7\u30a3\u30bf\u306b\u30d5\u30a9\u30fc\u30ab\u30b9
    const handleContainerClick = () => {
      if (editorRef.current && !disabled) {
        editorRef.current.focus();
      }
    };

    // \u592a\u5b57\u30dc\u30bf\u30f3\u306e\u30cf\u30f3\u30c9\u30e9\u30fc
    const handleBold = () => {
      document.execCommand('bold', false);
      handleInput();
    };

    // \u8d64\u5b57\u30dc\u30bf\u30f3\u306e\u30cf\u30f3\u30c9\u30e9\u30fc
    const handleRedText = () => {
      document.execCommand('foreColor', false, 'red');
      handleInput();
    };

    // ref \u7d4c\u7531\u3067 insertAtCursor \u3092\u516c\u958b\u3059\u308b
    // ref 経由で insertAtCursor を公開する
    useImperativeHandle(ref, () => ({
      insertAtCursor: (html: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        // selectionchange による savedRangeRef の上書きを防ぐ
        isInsertingRef.current = true;

        try {
          // カーソル位置を退避（focus() 前に必ず退避する）
          const savedRange = savedRangeRef.current ? savedRangeRef.current.cloneRange() : null;

          // エディタにフォーカスを戻す
          editor.focus();

          if (savedRange) {
            // 退避した Range を Selection に復元
            const selection = window.getSelection();
            if (selection) {
              selection.removeAllRanges();
              selection.addRange(savedRange);
            }

            // HTML を DocumentFragment に変換して挿入
            const fragment = savedRange.createContextualFragment(html);
            const lastNode = fragment.lastChild;
            savedRange.insertNode(fragment);

            // カーソルを挿入テキストの直後に移動
            if (lastNode) {
              const newRange = document.createRange();
              newRange.setStartAfter(lastNode);
              newRange.collapse(true);
              const sel = window.getSelection();
              if (sel) {
                sel.removeAllRanges();
                sel.addRange(newRange);
              }
              savedRangeRef.current = newRange.cloneRange();
            }
          } else {
            // フォールバック: カーソル位置が未設定の場合は末尾に追加
            const selection = window.getSelection();
            if (selection) {
              const range = document.createRange();
              range.selectNodeContents(editor);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);
              const fragment = range.createContextualFragment(html);
              const lastNode = fragment.lastChild;
              range.insertNode(fragment);
              if (lastNode) {
                const newRange = document.createRange();
                newRange.setStartAfter(lastNode);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                savedRangeRef.current = newRange.cloneRange();
              }
            } else {
              editor.innerHTML = editor.innerHTML + html;
            }
          }
        } catch (e) {
          // エラー時は末尾に追加
          editor.innerHTML = editor.innerHTML + html;
        } finally {
          isInsertingRef.current = false;
        }

        handleInput();
      },
    }));

    return (
      <Box>
        <Box sx={{ mb: 1, display: 'flex', gap: 1 }}>
          <Tooltip title="\u592a\u5b57">
            <IconButton size="small" onClick={handleBold} disabled={disabled}>
              <FormatBold />
            </IconButton>
          </Tooltip>
          <Tooltip title="\u8d64\u5b57">
            <IconButton size="small" onClick={handleRedText} disabled={disabled}>
              <FormatColorText sx={{ color: 'red' }} />
            </IconButton>
          </Tooltip>
        </Box>

        <EditorContainer
          onClick={handleContainerClick}
          className={disabled ? 'disabled' : ''}
        >
          <ContentEditable
            ref={editorRef}
            contentEditable={!disabled}
            onInput={handleInput}
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
