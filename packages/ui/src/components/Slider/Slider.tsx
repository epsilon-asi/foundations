import * as React from 'react';
import { SliderControl, type SliderCommonProps } from '../../internal/SliderControl';
import { useControllableValue } from '../../internal/useControllableValue';
export interface SliderProps extends SliderCommonProps {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number, event: Event, activeThumb: number) => void;
  onChangeCommitted?: (value: number, event: React.SyntheticEvent | Event) => void;
}
export const Slider = React.forwardRef<HTMLSpanElement, SliderProps>(function Slider({ value, defaultValue, onChange, onChangeCommitted, ...props }, ref) {
  const [selected, setSelected] = useControllableValue(value, defaultValue ?? props.min ?? 0);
  return <SliderControl {...props} ref={ref} value={selected} onChange={(event, next, thumb) => {
    if (props.disabled || typeof next !== 'number') return; setSelected(next); onChange?.(next, event, thumb);
  }} onChangeCommitted={(event, next) => { if (!props.disabled && typeof next === 'number') onChangeCommitted?.(next, event); }} />;
});
