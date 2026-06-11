import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '../../../app/providers/AppProviders';
import { Spreadsheet } from './Spreadsheet';
import { useSpreadsheetStore } from '../store/spreadsheetStore';

function renderSpreadsheet() {
  return render(
    <AppProviders>
      <Spreadsheet />
    </AppProviders>,
  );
}

describe('Spreadsheet integration', () => {
  beforeEach(() => {
    useSpreadsheetStore.getState().reset();
  });

  it('edits cells and evaluates a formula through the UI', async () => {
    const user = userEvent.setup();
    const { container } = renderSpreadsheet();
    const formulaBar = screen.getByLabelText('Formula bar');

    await user.click(formulaBar);
    await user.clear(formulaBar);
    await user.type(formulaBar, '10{Enter}');
    await user.click(container.querySelector('[data-cell-id="B1"]') as Element);

    await waitFor(() => {
      expect(container.querySelector('[data-cell-id="A1"]')).toHaveTextContent('10');
    });

    await user.click(formulaBar);
    await user.clear(formulaBar);
    await user.type(formulaBar, '=SUM(A1:A1){Enter}');

    await waitFor(() => {
      expect(container.querySelector('[data-cell-id="B1"]')).toHaveTextContent('10');
    });
  });

  it('moves selection with keyboard arrows', async () => {
    const user = userEvent.setup();
    const { container } = renderSpreadsheet();
    const grid = screen.getByRole('grid');

    await user.click(grid);
    await user.keyboard('{ArrowRight}{ArrowDown}');

    expect(container.querySelector('[data-cell-id="B2"]')).toHaveAttribute('aria-selected', 'true');
  });
});
