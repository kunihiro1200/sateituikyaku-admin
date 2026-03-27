/**
 * Preservation Tests for RichTextCommentEditor
 *
 * **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
 *
 * このテストは未修正コードで**通過する**ことが期待される。
 * 通過することでベースライン動作（修正によって変わってはいけない動作）を確認する。
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import RichTextCommentEditor from '../RichTextCommentEditor';

function setupExecCommand() {
  const execCommandMock = jest.fn().mockReturnValue(true);
  Object.defineProperty(document, 'execCommand', {
    value: execCommandMock,
    writable: true,
    configurable: true,
  });
  return execCommandMock;
}

describe('RichTextCommentEditor - Preservation Tests', () => {
  let execCommandMock: jest.Mock;

  beforeEach(() => {
    execCommandMock = setupExecCommand();
  });

  afterEach(() => {
    Object.defineProperty(document, 'execCommand', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it('太字ボタンを押すと document.execCommand("bold", false) が呼ばれる', async () => {
    const handleChange = jest.fn();

    render(
      <RichTextCommentEditor
        value="テストテキスト"
        onChange={handleChange}
      />
    );

    const boldButton = screen.getByRole('button', { name: /太字/i });

    await act(async () => {
      fireEvent.click(boldButton);
    });

    const boldCalls = execCommandMock.mock.calls.filter(
      (call: unknown[]) => call[0] === 'bold' && call[1] === false
    );
    expect(boldCalls.length).toBeGreaterThan(0);
  });

  it('赤字ボタンを押すと document.execCommand("foreColor", false, "red") が呼ばれる', async () => {
    const handleChange = jest.fn();

    render(
      <RichTextCommentEditor
        value="テストテキスト"
        onChange={handleChange}
      />
    );

    const redButton = screen.getByRole('button', { name: /赤字/i });

    await act(async () => {
      fireEvent.click(redButton);
    });

    const foreColorCalls = execCommandMock.mock.calls.filter(
      (call: unknown[]) => call[0] === 'foreColor' && call[1] === false && call[2] === 'red'
    );
    expect(foreColorCalls.length).toBeGreaterThan(0);
  });

  it('onInput イベントが発火すると onChange コールバックが呼ばれる', async () => {
    const handleChange = jest.fn();

    const { container } = render(
      <RichTextCommentEditor
        value=""
        onChange={handleChange}
      />
    );

    const editor = container.querySelector('[contenteditable]') as HTMLElement;
    expect(editor).toBeTruthy();

    await act(async () => {
      editor.innerHTML = '<p>新しいテキスト</p>';
      fireEvent.input(editor);
    });

    expect(handleChange).toHaveBeenCalled();
  });

  it('onInput イベント発火時に onChange コールバックに最新HTMLが渡される', async () => {
    const handleChange = jest.fn();
    const expectedHtml = '<b>太字テキスト</b>通常テキスト';

    const { container } = render(
      <RichTextCommentEditor
        value=""
        onChange={handleChange}
      />
    );

    const editor = container.querySelector('[contenteditable]') as HTMLElement;
    expect(editor).toBeTruthy();

    await act(async () => {
      editor.innerHTML = expectedHtml;
      fireEvent.input(editor);
    });

    expect(handleChange).toHaveBeenCalledWith(expectedHtml);
  });
});
