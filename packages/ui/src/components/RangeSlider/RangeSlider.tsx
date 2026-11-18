import * as React from 'react';
import { SliderControl, type SliderCommonProps } from '../../internal/SliderControl';
import { useControllableValue } from '../../internal/useControllableValue';
export interface RangeSliderProps extends SliderCommonProps {
  value?: readonly [number, number];
  defaultValue?: readonly [number, number];
  onChange?: (value: [number, number], event: Event, activeThumb: number) => void;
  onChangeCommitted?: (value: [number, number], event: React.SyntheticEvent | Event) => void;
}
export const RangeSlider = React.forwardRef<HTMLSpanElement, RangeSliderProps>(function RangeSlider({ value, defaultValue, onChange, onChangeCommitted, getAriaLabel, disableSwap = true, ...props }, ref) {
  const [selected, setSelected] = useControllableValue(value, defaultValue ?? [props.min ?? 0, props.max ?? 100]);
  return <SliderControl {...props} ref={ref} value={[...selected]} disableSwap={disableSwap}
    getAriaLabel={getAriaLabel ?? ((index) => `${props.label}: ${index === 0 ? 'Minimum' : 'Maximum'}`)} onChange={(event, next, thumb) => {
      if (props.disabled || !Array.isArray(next) || next.length !== 2) return; const pair: [number, number] = [next[0], next[1]];
      setSelected(pair); onChange?.(pair, event, thumb);
    }} onChangeCommitted={(event, next) => { if (!props.disabled && Array.isArray(next) && next.length === 2) onChangeCommitted?.([next[0], next[1]], event); }} />;
});
