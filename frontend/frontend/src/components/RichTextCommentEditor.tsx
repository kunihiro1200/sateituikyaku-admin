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
    // カーソル位置をテキストオフセットで保存
    const cursorOffsetRef = useRef<number | null>(null);
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

        const offset = cursorOffsetRef.current;

        if (offset !== null) {
          // テキストオフセットを使って innerHTML に直接挿入
          // 現在の innerHTML を取得
          const currentHtml = editor.innerHTML;

          // テキストオフセットを HTML オフセットに変換
          // テキストノードを走査して挿入位置を特定
          const pos = getNodeFromOffset(editor, offset);

          if (pos) {
            // Range を使って挿入（focus は呼ばない）
            const range = document.createRange();
            try {
              range.setStart(pos.node, pos.offset);
              range.collapse(true);

              // DocumentFragment を作成して挿入
              const fragment = range.createContextualFragment(html);
              const lastNode = fragment.lastChild;
              range.insertNode(fragment);

              // カーソルを挿入後に移動
              if (lastNode) {
                const newRange = document.createRange();
                newRange.setStartAfter(lastNode);
                newRange.collapse(true);

                // Selection を更新（focus なし）
                const sel = window.getSelection();
                if (sel) {
                  sel.removeAllRanges();
                  sel.addRange(newRange);
                }

                // 新しいオフセットを保存
                cursorOffsetRef.current = getTextOffset(
                  editor,
                  newRange.startContainer,
                  newRange.startOffset
                );
              }

              handleInput();
              return;
            } catch (e) {
              // フォールバックへ
            }
          }
        }

        // フォールバック: 末尾に追加
        editor.innerHTML = editor.innerHTML + html;
        handleInput();
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
