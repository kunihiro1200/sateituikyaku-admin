import React, { useRef, useEffect, useState, useImperativeHandle } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { FormatBold, FormatColorText } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// カーソル位置挿入メソッドを公開するハンドル型
export interface RichTextCommentEditorHandle {
  /**
   * カーソル位置にHTMLテキストを挿入する。
   * カーソル位置が未設定の場合は先頭に挿入する。
   * @param html 挿入するHTML文字列（例: "<b>不通</b>"）
   */
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
  // 太字タグのスタイルを明示的に適用
  '& b, & strong': {
    fontWeight: 'bold',
  },
  // 赤字のスタイルを明示的に適用
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
    const [isFocused, setIsFocused] = useState(false);
    // onBlur 時にカーソル位置（Range）を保存するref
    const savedRangeRef = useRef<Range | null>(null);

    // 初期値の設定
    useEffect(() => {
      if (editorRef.current && editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }, [value]);

    // コンテンツ変更時のハンドラー
    const handleInput = () => {
      if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        onChange(html);
      }
    };

    // フォーカス管理
    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleBlur = () => {
      // エディタのblur時にカーソル位置を保存する
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && editorRef.current) {
        const range = selection.getRangeAt(0);
        // エディタの子孫ノードが含まれる場合のみ保存（他のフォーカス移動と区別）
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          savedRangeRef.current = range.cloneRange();
        }
      }
      setIsFocused(false);
    };

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
          if (savedRangeRef.current) {
            // 保存済みのカーソル位置に挿入
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(savedRangeRef.current);

            const range = savedRangeRef.current;
            range.deleteContents();

            // HTML文字列をDocumentFragmentに変換して挿入
            const fragment = range.createContextualFragment(html);
            const lastNode = fragment.lastChild;
            range.insertNode(fragment);

            // カーソルを挿入テキストの直後に移動
            if (lastNode) {
              range.setStartAfter(lastNode);
              range.collapse(true);
              selection?.removeAllRanges();
              selection?.addRange(range);
              savedRangeRef.current = range.cloneRange();
            }
          } else {
            // フォールバック: カーソル位置が未設定の場合は先頭に挿入
            editor.innerHTML = html + (editor.innerHTML ? '<br>' + editor.innerHTML : '');
          }
        } catch (e) {
          // エラー時はフォールバックとして先頭挿入
          editor.innerHTML = html + (editor.innerHTML ? '<br>' + editor.innerHTML : '');
        }

        // onChange を発火して親コンポーネントに変更を通知
        handleInput();
      },
    }));

    return (
      <Box>
        {/* ツールバー */}
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

        {/* エディタ */}
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
