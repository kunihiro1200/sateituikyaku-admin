import { Button, CircularProgress } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { keyframes } from '@mui/system';

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(237, 108, 2, 0.7); }
  70% { box-shadow: 0 0 0 8px rgba(237, 108, 2, 0); }
  100% { box-shadow: 0 0 0 0 rgba(237, 108, 2, 0); }
`;

interface SectionSaveButtonProps {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
}

export function SectionSaveButton({ isDirty, isSaving, onSave }: SectionSaveButtonProps) {
  return (
    <Button
      size="small"
      variant={isDirty ? 'contained' : 'outlined'}
      color={isDirty ? 'warning' : 'inherit'}
      disabled={isSaving || !isDirty}
      onClick={onSave}
      startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
      sx={{
        minWidth: 80,
        ...(isDirty && !isSaving && {
          animation: `${pulse} 1.5s infinite`,
        }),
      }}
    >
      保存
    </Button>
  );
}
