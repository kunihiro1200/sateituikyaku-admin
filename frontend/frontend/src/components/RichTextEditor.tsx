import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-text-style';
import { Box, IconButton, Tooltip } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import { Underline } from '@tiptap/extension-underline';

interface RichTextEditorProps {
  value: string; // HTML文字列
  onChange: (html: string) => void;
  onBlur?: () => void;
  hasError?: boolean;
  minHeight?: number;
}

const TOOLBAR_BTN_SX = {
  width: 28,
  height: 28,
  borderRadius: '4px',
  '&.active': { bgcolor: 'action.selected' },
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  onBlur,
  hasError,
  minHeight = 80,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Underline,
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: () => {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        style: `min-height:${minHeight}px; outline:none; padding:6px 8px; font-size:0.875rem; line-height:1.5;`,
      },
    },
  });

  // 外部からvalueが変わった時に同期（初期ロード時のみ）
  const prevValue = React.useRef(value);
  React.useEffect(() => {
    if (!editor) return;
    if (value !== prevValue.current && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
    prevValue.current = value;
  }, [value, editor]);

  if (!editor) return null;

  return (
    <Box
      sx={{
        border: hasError ? '1px solid #d32f2f' : '1px solid rgba(0,0,0,0.23)',
        borderRadius: 1,
        '&:focus-within': {
          borderColor: hasError ? '#d32f2f' : 'primary.main',
          borderWidth: '2px',
        },
      }}
    >
      {/* ツールバー */}
      <Box
        sx={{
          display: 'flex',
          gap: 0.5,
          px: 0.5,
          py: 0.25,
          borderBottom: '1px solid rgba(0,0,0,0.12)',
          bgcolor: '#fafafa',
          borderRadius: '4px 4px 0 0',
        }}
      >
        <Tooltip title="太字">
          <IconButton
            size="small"
            sx={{ ...TOOLBAR_BTN_SX, ...(editor.isActive('bold') ? { bgcolor: 'action.selected' } : {}) }}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          >
            <FormatBoldIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="下線">
          <IconButton
            size="small"
            sx={{ ...TOOLBAR_BTN_SX, ...(editor.isActive('underline') ? { bgcolor: 'action.selected' } : {}) }}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
          >
            <FormatUnderlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* 赤字ボタン */}
        <Tooltip title="赤字">
          <IconButton
            size="small"
            sx={{
              ...TOOLBAR_BTN_SX,
              color: '#c62828',
              ...(editor.isActive('textStyle', { color: '#c62828' }) ? { bgcolor: 'action.selected' } : {}),
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              if (editor.isActive('textStyle', { color: '#c62828' })) {
                editor.chain().focus().unsetColor().run();
              } else {
                editor.chain().focus().setColor('#c62828').run();
              }
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1 }}>赤</span>
          </IconButton>
        </Tooltip>

        {/* 色リセット */}
        <Tooltip title="色をリセット">
          <IconButton
            size="small"
            sx={TOOLBAR_BTN_SX}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetColor().run(); }}
          >
            <span style={{ fontSize: '0.7rem', lineHeight: 1, color: '#555' }}>A</span>
          </IconButton>
        </Tooltip>
      </Box>

      {/* エディタ本体 */}
      <EditorContent editor={editor} />
    </Box>
  );
};

export default RichTextEditor;
