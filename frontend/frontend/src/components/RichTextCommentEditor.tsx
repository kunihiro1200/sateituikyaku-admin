import React, { useRef, useEffect, useImperativeHandle } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { FormatBold, FormatColorText } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// カーソル位置挿入メソッドを公開するハンドル型
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
      placeholder = 'コメントを入力...',
      disabled = false,
    },
    ref
  ) => {
    const editorRef = useRef<HTMLDivElement>(null);
    // カーソル位置（Range）を保存する ref
    // mousedown と blur の両方で更新する
    const savedRangeRef = useRef<Range | null>(null);
    // エディタがフォーカス中かどうかを追跡する ref
    const isFocusedRef = useRef<boolean>(false);

    // 初期値の設定
    // 重要: フォーカス中は innerHTML を上書きしない
    useEffect(() => {
      if (editorRef.current && !isFocusedRef.current && editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }, [value]);

    // カーソル位置を保存するヘルパー関数
    const saveCurrentRange = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && editorRef.current) {
        const range = selection.getRangeAt(0);
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          savedRangeRef.current = range.cloneRange();
        }
      }
    };

    // コンテンツ変更時のハンドラー
    const handleInput = () => {
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    };

    // focus 時に isFocusedRef を true にする
    const handleFocus = () => {
      isFocusedRef.current = true;
    };

    // blur 時にカーソル位置を保存し、isFocusedRef を false にする
    const handleBlur = () => {
      saveCurrentRange();
      isFocusedRef.current = false;
    };

    // selectionchange 時にカーソル位置を保存する
    // （エディタがフォーカス中のみ）
    useEffect(() => {
      const handleSelectionChange = () => {
        if (isFocusedRef.current) {
          saveCurrentRange();
        }
      };
      document.addEventListener('selectionchange', handleSelectionChange);
      return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
      };
    }, []);

    // コンテナクリック時にエディタにフォーカス
    const handleContainerClick = () => {
      if (editorRef.current && !disabled) {
        editorRef.current.focus();
      }
    };

    // 太字ボタンのハンドラー
    const handleBold = () => {
      document.execCommand('bold', false);
      handleInput();
    };

    // 赤字ボタンのハンドラー
    const handleRedText = () => {
      document.execCommand('foreColor', false, 'red');
      handleInput();
    };

    // ref 経由で insertAtCursor を公開する
    useImperativeHandle(ref, () => ({
      insertAtCursor: (html: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        try {
          // 保存したカーソル位置を取得
          const savedRange = savedRangeRef.current ? savedRangeRef.current.cloneRange() : null;

          if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
            // エディタにフォーカスを戻す
            editor.focus();

            // 保存した Range を Selection に復元
            const selection = window.getSelection();
            if (selection) {
              selection.removeAllRanges();
              selection.addRange(savedRange);
            }

            // HTML を DocumentFragment に変換して挿入
            const fragment = savedRange.createContextualFragment(html);
            const lastNode = fragment.lastChild;
            savedRange.deleteContents();
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
            // フォールバック: カーソル位置が未設定または無効な場合は末尾に追加
            editor.focus();
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
        }

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

        <EditorContainer
          onClick={handleContainerClick}
          className={disabled ? 'disabled' : ''}
        >
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
