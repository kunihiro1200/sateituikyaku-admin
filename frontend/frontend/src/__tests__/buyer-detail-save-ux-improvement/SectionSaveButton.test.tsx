import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionSaveButton } from '../../components/SectionSaveButton';

// MUI の keyframes を含む sx prop のテスト用にモック
jest.mock('@mui/system', () => ({
  ...jest.requireActual('@mui/system'),
  keyframes: () => 'pulse-animation',
}));

describe('SectionSaveButton', () => {
  const mockOnSave = jest.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
  });

  describe('isDirty: false のとき', () => {
    it('outlined variant で表示される', () => {
      render(
        <SectionSaveButton isDirty={false} isSaving={false} onSave={mockOnSave} />
      );
      const button = screen.getByRole('button', { name: /保存/ });
      expect(button).toBeInTheDocument();
      // outlined は MUI が class に反映する
      expect(button.className).toMatch(/outlined|MuiButton/);
    });

    it('disabled 状態になる（isDirty=false のため）', () => {
      render(
        <SectionSaveButton isDirty={false} isSaving={false} onSave={mockOnSave} />
      );
      const button = screen.getByRole('button', { name: /保存/ });
      expect(button).toBeDisabled();
    });

    it('クリックしても onSave が呼ばれない', () => {
      render(
        <SectionSaveButton isDirty={false} isSaving={false} onSave={mockOnSave} />
      );
      const button = screen.getByRole('button', { name: /保存/ });
      fireEvent.click(button);
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('isDirty: true のとき', () => {
    it('contained variant で表示される', () => {
      render(
        <SectionSaveButton isDirty={true} isSaving={false} onSave={mockOnSave} />
      );
      const button = screen.getByRole('button', { name: /保存/ });
      expect(button).toBeInTheDocument();
      expect(button.className).toMatch(/contained|MuiButton/);
    });

    it('disabled ではない', () => {
      render(
        <SectionSaveButton isDirty={true} isSaving={false} onSave={mockOnSave} />
      );
      const button = screen.getByRole('button', { name: /保存/ });
      expect(button).not.toBeDisabled();
    });

    it('クリックすると onSave が呼ばれる', () => {
      render(
        <SectionSaveButton isDirty={true} isSaving={false} onSave={mockOnSave} />
      );
      const button = screen.getByRole('button', { name: /保存/ });
      fireEvent.click(button);
      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('isSaving: true のとき', () => {
    it('disabled 状態になる', () => {
      render(
        <SectionSaveButton isDirty={true} isSaving={true} onSave={mockOnSave} />
      );
      const button = screen.getByRole('button', { name: /保存/ });
      expect(button).toBeDisabled();
    });

    it('CircularProgress が表示される', () => {
      render(
        <SectionSaveButton isDirty={true} isSaving={true} onSave={mockOnSave} />
      );
      // CircularProgress は role="progressbar" で描画される
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('クリックしても onSave が呼ばれない', () => {
      render(
        <SectionSaveButton isDirty={true} isSaving={true} onSave={mockOnSave} />
      );
      const button = screen.getByRole('button', { name: /保存/ });
      fireEvent.click(button);
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  it('「保存」テキストが表示される', () => {
    render(
      <SectionSaveButton isDirty={false} isSaving={false} onSave={mockOnSave} />
    );
    expect(screen.getByText('保存')).toBeInTheDocument();
  });
});
