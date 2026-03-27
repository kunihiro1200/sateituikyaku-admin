/**
 * Bug Condition Exploration Tests for RichTextCommentEditor
 *
 * **Validates: Requirements 1.2, 1.3**
 *
 * このテストは未修正コードで**失敗する**ことが期待される。
 * 失敗することでバグの存在を確認する。
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import RichTextCommentEditor, { RichTextCommentEditorHandle } from '../RichTextCommentEditor';

function setCursorAtOffset(editor: HTMLElement, offset: number): void {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let node = walker.nextNode();

  while (node) {
    const len = (node.textContent || '').length;
    if (currentOffset + len >= offset) {
      const range = document.createRange();
      range.setStart(node, offset - currentOffset);
      range.collapse(true);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      document.dispatchEvent(new Event('selectionchange'));
      return;
    }
    currentOffset += len;
    node = walker.nextNode();
  }

  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
  document.dispatchEvent(new Event('selectionchange'));
}

function setupExecCommand() {
  const execCommandMock = jest.fn().mockReturnValue(true);
  Object.defineProperty(document, 'execCommand', {
    value: execCommandMock,
    writable: true,
    configurable: true,
  });
  return execCommandMock;
}

function setupQueryCommandState(boldValue: boolean) {
  const queryCommandStateMock = jest.fn().mockImplementation((cmd: string) => {
    if (cmd === 'bold') return boldValue;
    return false;
  });
  Object.defineProperty(document, 'queryCommandState', {
    value: queryCommandStateMock,
    writable: true,
    configurable: true,
  });
  return queryCommandStateMock;
}

describe('RichTextCommentEditor - Bug Condition Exploration Tests', () => {
  /**
   * テスト1 (バグ1): 2回目の insertAtCursor が正しいカーソル位置に挿入される
   * **EXPECTED TO FAIL on unfixed code**
   */
  it('テスト1 (バグ1): blur後にカーソルを移動しても2回目の insertAtCursor が正しい位置に挿入される', async () => {
    const execCommandMock = setupExecCommand();

    try {
      const handleRef = React.createRef<RichTextCommentEditorHandle>();
      let currentHtml = 'テストABC';

      const { container } = render(
        <RichTextCommentEditor
          ref={handleRef}
          value={currentHtml}
          onChange={(html) => { currentHtml = html; }}
        />
      );

      const editor = container.querySelector('[contenteditable]') as HTMLElement;
      expect(editor).toBeTruthy();

      await act(async () => {
        editor.innerHTML = 'テストABC';
      });

      await act(async () => {
        editor.focus();
        editor.dispatchEvent(new FocusEvent('focus'));
        setCursorAtOffset(editor, 1);
      });

      await act(async () => {
        handleRef.current?.insertAtCursor('<b>【挿入1】</b>');
      });

      const textAfterFirst = editor.textContent || '';
      expect(textAfterFirst).toMatch(/^テ【挿入1】/);

      await act(async () => {
        editor.blur();
        editor.dispatchEvent(new FocusEvent('blur'));
      });

      const sIndex = textAfterFirst.indexOf('ス');
      const targetOffset = sIndex + 1;

      await act(async () => {
        setCursorAtOffset(editor, targetOffset);
      });

      await act(async () => {
        handleRef.current?.insertAtCursor('<b>【挿入2】</b>');
      });

      const textAfterSecond = editor.textContent || '';
      const insert2Index = textAfterSecond.indexOf('【挿入2】');
      const sIndexAfter = textAfterSecond.indexOf('ス');
      const tIndexAfter = textAfterSecond.indexOf('ト');

      // 【挿入2】は「ス」の後、「ト」の前に挿入されるべき
      expect(insert2Index).toBeGreaterThan(sIndexAfter);
      expect(insert2Index).toBeLessThan(tIndexAfter);
    } finally {
      execCommandMock.mockRestore?.();
    }
  });

  /**
   * テスト2 (バグ2): insertAtCursor 後に bold コンテキストが解除される
   * **EXPECTED TO FAIL on unfixed code**
   */
  it('テスト2 (バグ2): insertAtCursor 後に document.execCommand("bold", false) が呼ばれる', async () => {
    const execCommandMock = setupExecCommand();
    setupQueryCommandState(true);

    try {
      const handleRef = React.createRef<RichTextCommentEditorHandle>();

      const { container } = render(
        <RichTextCommentEditor
          ref={handleRef}
          value=""
          onChange={() => {}}
        />
      );

      const editor = container.querySelector('[contenteditable]') as HTMLElement;
      expect(editor).toBeTruthy();

      await act(async () => {
        editor.innerHTML = '';
        editor.focus();
        editor.dispatchEvent(new FocusEvent('focus'));
        const range = document.createRange();
        range.setStart(editor, 0);
        range.collapse(true);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        document.dispatchEvent(new Event('selectionchange'));
      });

      execCommandMock.mockClear();

      await act(async () => {
        handleRef.current?.insertAtCursor('<b>太字テキスト</b>');
      });

      const boldOffCalls = execCommandMock.mock.calls.filter(
        (call: unknown[]) => call[0] === 'bold' && call[1] === false
      );

      expect(boldOffCalls.length).toBeGreaterThan(0);
    } finally {
      Object.defineProperty(document, 'execCommand', { value: undefined, writable: true, configurable: true });
      Object.defineProperty(document, 'queryCommandState', { value: undefined, writable: true, configurable: true });
    }
  });

  /**
   * テスト3: insertAtCursor 後にエディタがフォーカスを持っている
   * **EXPECTED TO FAIL on unfixed code**
   */
  it('テスト3: insertAtCursor 後にエディタがフォーカスを持っている', async () => {
    const execCommandMock = setupExecCommand();

    try {
      const handleRef = React.createRef<RichTextCommentEditorHandle>();

      const { container } = render(
        <RichTextCommentEditor
          ref={handleRef}
          value="テスト"
          onChange={() => {}}
        />
      );

      const editor = container.querySelector('[contenteditable]') as HTMLElement;
      expect(editor).toBeTruthy();

      await act(async () => {
        editor.innerHTML = 'テスト';
      });

      await act(async () => {
        editor.focus();
        editor.dispatchEvent(new FocusEvent('focus'));
      });

      await act(async () => {
        editor.blur();
        editor.dispatchEvent(new FocusEvent('blur'));
      });

      expect(document.activeElement).not.toBe(editor);

      await act(async () => {
        handleRef.current?.insertAtCursor('<b>クイックボタン挿入</b>');
      });

      expect(document.activeElement).toBe(editor);
    } finally {
      Object.defineProperty(document, 'execCommand', { value: undefined, writable: true, configurable: true });
    }
  });
});
