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

// ノードのテキストオフセットを取得するヘルパー
function getTextOffset(root: Node, targetNode: Node, targetOffset: number): number {
  let offset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node === targetNode) {
      return offset + targetOffset;
    }
    offset += (node.textContent || '').length;
    node = walker.nextNode();
  }
  return offset;
}

// テキストオフセットからノードと位置を取得するヘルパー
function getNodeFromOffset(root: Node, targetOffset: number): { node: Node; offset: number } | null {
  let offset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const len = (node.textContent || '').length;
    if (offset + len >= targetOffset) {
      return { node, offset: targetOffset - offset };
    }
    offset += len;
    node = walker.nextNode();
  }
  // 末尾
  if (root.lastChild) {
    return { node: root, offset: root.childNodes.length };
  }
  return null;
}

const RichTextCommentEditor = React.forwardRef<RichTextCommentEditorHandle, RichTextCommentEditorProps>(
  ({ value, onChange, placeholder = 'コメントを入力...', disabled = false }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    // カーソル位置をテキストオフセットで保存（-1は未設定）
    const cursorOffsetRef = useRef<number>(-1);
    const isFocusedRef = useRef<boolean>(false);

    // 初期値の設定（フォーカス中は上書きしない）
    useEffect(() => {
      if (editorRef.current && !isFocusedRef.current && editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }, [value]);

    // 現在のカーソルオフセットを保存
    const saveCursorOffset = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && editorRef.current) {
        const range = selection.getRangeAt(0);
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          cursorOffsetRef.current = getTextOffset(
            editorRef.current,
            range.startContainer,
            range.startOffset
          );
        }
      }
    };

    const handleInput = () => {
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    };

    const handleFocus = () => {
      isFocusedRef.current = true;
    };

    const handleBlur = () => {
      saveCursorOffset();
      isFocusedRef.current = false;
    };

    // selectionchange でリアルタイムにオフセットを更新
    useEffect(() => {
      const onSelectionChange = () => {
        if (isFocusedRef.current) {
          saveCursorOffset();
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

        // エディタにフォーカスを戻す
        editor.focus();

        // 保存済みオフセットがある場合はその位置にカーソルを復元してから挿入
        const savedOffset = cursorOffsetRef.current;
        if (savedOffset >= 0) {
          const pos = getNodeFromOffset(editor, savedOffset);
          if (pos) {
            try {
              const range = document.createRange();
              range.setStart(pos.node, pos.offset);
              range.collapse(true);
              const sel = window.getSelection();
              if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
              }
            } catch (e) {
              // カーソル復元失敗 → 現在位置のまま続行
            }
          }
        }

        // execCommand で挿入（フォーカスがある状態で実行）
        document.execCommand('insertHTML', false, html);
        handleInput();

        // 新しいカーソル位置を保存
        saveCursorOffset();
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
