import * as React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { UiProvider } from '../theme';

export function renderWithUi(ui: React.ReactElement, options?: RenderOptions) {
  return render(<UiProvider>{ui}</UiProvider>, options);
}
