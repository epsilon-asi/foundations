import type * as React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { UiProvider } from '../theme';
import { DatePickerProvider } from '../providers/DatePickerProvider';

export function renderWithPickers(ui: React.ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: ({ children }) => <UiProvider><DatePickerProvider>{children}</DatePickerProvider></UiProvider>, ...options });
}
