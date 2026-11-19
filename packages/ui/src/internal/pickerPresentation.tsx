import * as React from 'react';
import { DialogActions, type IconButtonProps as MuiIconButtonProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { DatePickerProps as MuiDatePickerProps } from '@mui/x-date-pickers/DatePicker';
import type { PickersActionBarProps } from '@mui/x-date-pickers/PickersActionBar';
import { useIsValidValue, usePickerContext, usePickerTranslations } from '@mui/x-date-pickers/hooks';
import { IconButton } from '../components/IconButton';
import { ActionButton } from '../components/ActionButton';

export interface PickerPresentationProps {
  density?: 'compact' | 'comfortable';
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  helperText?: React.ReactNode;
  /** Adds application validation without masking MUI's date/time validation. */
  error?: boolean;
  clearable?: boolean;
}

export const PickerIconButton = React.forwardRef<HTMLButtonElement, MuiIconButtonProps>(function PickerIconButton({ sx, ...props }, ref) {
  return <IconButton {...props} ref={ref} aria-label={props['aria-label'] ?? props.title ?? 'Picker action'} outlined={false} size="small"
    sx={[{ width: 28, height: 28, flexShrink: 0 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} />;
});

/** Public MUI context actions preserve accept/cancel/step and localization contracts. */
export function PickerActionBar({ actions, sx, ...props }: PickersActionBarProps) {
  const translations = usePickerTranslations();
  const { value, disabled, readOnly, clearValue, setValueToToday, acceptValueChanges, cancelValueChanges, goToNextStep, hasNextStep } = usePickerContext();
  const isValid = useIsValidValue();
  if (!actions?.length) return null;
  return <DialogActions {...props} sx={[{ flexWrap: 'wrap', p: 2, gap: 1, '& > :not(style) ~ :not(style)': { ml: 0 } }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    {actions.map(action => {
      const next = action === 'next' || (action === 'nextOrAccept' && hasNextStep);
      const accept = action === 'accept' || (action === 'nextOrAccept' && !hasNextStep);
      const label = action === 'clear' ? translations.clearButtonLabel : action === 'today' ? translations.todayButtonLabel : action === 'cancel' ? translations.cancelButtonLabel
        : next ? translations.nextStepButtonLabel : translations.okButtonLabel;
      const click = action === 'clear' ? clearValue : action === 'today' ? setValueToToday : action === 'cancel' ? cancelValueChanges : next ? goToNextStep : acceptValueChanges;
      return <ActionButton key={action} size="small" color={action === 'cancel' ? 'inherit' : 'primary'} variant={accept ? 'contained' : 'text'}
        disabled={action === 'cancel' ? false : disabled || ((action === 'clear' || action === 'today') && readOnly) || (accept && !isValid(value))} onClick={click}>{label}</ActionButton>;
    })}
  </DialogActions>;
}

type CommonSlotProps = Pick<NonNullable<MuiDatePickerProps['slotProps']>, 'textField' | 'field' | 'layout' | 'desktopPaper' | 'mobilePaper' | 'dialog' | 'actionBar'>;
const styles = (base: SxProps<Theme>, supplied?: SxProps<Theme>): SxProps<Theme> => [
  ...(Array.isArray(base) ? base : [base]), ...(Array.isArray(supplied) ? supplied : supplied ? [supplied] : [])
];
function layoutStyles(compact: boolean): SxProps<Theme> {
  const day = compact ? 28 : 36; const width = compact ? 280 : 320;
  return {
    minWidth: 0, maxWidth: '100%',
    '& .MuiDateCalendar-root': { width, maxWidth: '100%', height: 'auto' },
    '& .MuiPickersCalendarHeader-root': { m: 0, px: 2, py: 1, minHeight: compact ? 36 : 44, maxHeight: 'none' },
    '& .MuiPickerDay-root': { '--PickerDay-size': `${day}px`, '--PickerDay-horizontalMargin': '2px' },
    '& .MuiDayCalendar-weekDayLabel, & .MuiDayCalendar-weekNumberLabel': { width: day, height: day, mx: '2px' },
    '& .MuiDayCalendar-weekNumber': { width: day, height: day },
    '& .MuiDayCalendar-slideTransition, & .MuiDayCalendar-loadingContainer': { minHeight: (day + 4) * 6 },
    '& .MuiYearCalendar-root, & .MuiMonthCalendar-root': { width, maxWidth: '100%', maxHeight: 240 },
    '& .MuiYearCalendar-button, & .MuiMonthCalendar-button': { fontSize: '0.8125rem', minHeight: 28 },
    // The combined desktop picker adds its own clock sizing. Increase selector
    // specificity so its 336px view does not stretch our compact calendar grid.
    '&& .MuiMultiSectionDigitalClock-root, && .MuiDigitalClock-root, && .MuiMultiSectionDigitalClockSection-root': { maxHeight: compact ? 256 : 320 },
    '& .MuiMultiSectionDigitalClock-root, & .MuiDigitalClock-root': { maxWidth: 'calc(100vw - 16px)' },
    '& .MuiMultiSectionDigitalClockSection-item': { minHeight: 28, py: 1, mx: 1, fontSize: '0.8125rem' },
    '& .MuiPickersToolbar-root': { p: compact ? 2 : 3 },
    '& .MuiTabs-root, & .MuiTab-root': { minHeight: compact ? 32 : 44 },
    '& .MuiPickersLayout-contentWrapper': { minWidth: 0 },
    '@media (max-width: 599.95px)': {
      '& .MuiMultiSectionDigitalClock-root, & .MuiDigitalClock-root': { width, maxWidth: 'calc(100vw - 16px)' }
    },
    '@media (prefers-reduced-motion: reduce)': { '& *, & *::before, & *::after': { animationDuration: '0s', transitionDuration: '0s' } }
  };
}

export function pickerSlotProps<T extends CommonSlotProps>(slotProps: T | undefined, {
  density = 'compact', size = 'small', fullWidth = true, helperText, error, clearable = true
}: PickerPresentationProps): CommonSlotProps {
  return {
    ...slotProps,
    textField: (owner: Parameters<Extract<CommonSlotProps['textField'], Function>>[0]) => {
      const supplied = typeof slotProps?.textField === 'function' ? slotProps.textField(owner) : slotProps?.textField;
      return { size, fullWidth, ...supplied, ...(helperText !== undefined ? { helperText } : {}), ...(error ? { error: true } : {}),
        sx: styles({ minWidth: 0, '& .MuiPickersInputBase-root': { borderRadius: '8px' }, '& .MuiFormHelperText-root': { mx: 0, overflowWrap: 'anywhere' } }, supplied?.sx) };
    },
    field: (owner: Parameters<Extract<CommonSlotProps['field'], Function>>[0]) => ({ clearable, ...(typeof slotProps?.field === 'function' ? slotProps.field(owner) : slotProps?.field) }),
    actionBar: (owner: Parameters<Extract<CommonSlotProps['actionBar'], Function>>[0]) => ({ actions: clearable ? ['clear', 'cancel', 'nextOrAccept'] as const : ['cancel', 'nextOrAccept'] as const,
      ...(typeof slotProps?.actionBar === 'function' ? slotProps.actionBar(owner) : slotProps?.actionBar) }),
    layout: { ...slotProps?.layout, sx: styles(layoutStyles(density === 'compact'), slotProps?.layout?.sx) },
    desktopPaper: (owner: Parameters<Extract<CommonSlotProps['desktopPaper'], Function>>[0]) => {
      const supplied = typeof slotProps?.desktopPaper === 'function' ? slotProps.desktopPaper(owner) : slotProps?.desktopPaper;
      return { ...supplied, sx: styles({ maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100dvh - 16px)', overflow: 'auto' }, supplied?.sx) };
    },
    mobilePaper: { ...slotProps?.mobilePaper, sx: styles({ minWidth: 0, maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100dvh - 16px)' }, slotProps?.mobilePaper?.sx) },
    dialog: { ...slotProps?.dialog, sx: styles({ '& .MuiDialog-paper': { minWidth: 0, m: 2, maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100dvh - 16px)' },
      '& .MuiDialogContent-root': { p: 0, minWidth: 0 } }, slotProps?.dialog?.sx) }
  };
}

export const pickerSlots = { openPickerButton: PickerIconButton, clearButton: PickerIconButton, previousIconButton: PickerIconButton,
  nextIconButton: PickerIconButton, switchViewButton: PickerIconButton, actionBar: PickerActionBar };
/** Avoid the wide desktop date-time layout on narrow devices with fine pointers. */
export const pickerDesktopQuery = '@media (min-width: 600px) and (pointer: fine)';
