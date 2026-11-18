import * as React from 'react';
import { Box, TextField, Typography, type BoxProps } from '@mui/material';
import { IconButton } from '../IconButton';
import { Slider } from '../Slider';
import { useControllableValue } from '../../internal/useControllableValue';

type Channels = { r: number; g: number; b: number; a: number };
function parse(value: string): Channels | null {
  let hex = value.trim().replace(/^#/, '');
  if (!/^(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(hex)) return null;
  if (hex.length <= 4) hex = [...hex].map(character => character + character).join('');
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1 };
}
function serialize(color: Channels, alpha: boolean) {
  return `#${[color.r, color.g, color.b, ...(alpha ? [Math.round(color.a * 255)] : [])].map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
export interface ColorSwatchProps extends Omit<BoxProps, 'color' | 'onClick' | 'children'> {
  color: string;
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}
export function ColorSwatch({ color, label, selected = false, disabled = false, onClick, sx, ...props }: ColorSwatchProps) {
  const preview = <Box component="span" aria-hidden="true" sx={{ display: 'block', width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: 0.5,
    backgroundImage: 'conic-gradient(#ddd 25%, #fff 0 50%, #ddd 0 75%, #fff 0)', backgroundSize: '8px 8px' }}>
    <Box component="span" sx={{ position: 'absolute', inset: 0, bgcolor: color }} /></Box>;
  return onClick ? <Box component="span" {...props} sx={[{ display: 'inline-flex', width: 32, height: 32, flexShrink: 0 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    <IconButton aria-label={label} aria-pressed={selected} disabled={disabled} onClick={onClick}
      sx={{ width: '100%', height: '100%', p: 1, borderWidth: selected ? 2 : 1, borderColor: selected ? 'text.primary' : 'divider', borderRadius: 0.75 }}>{preview}</IconButton></Box>
    : <Box component="span" {...props} role="img" aria-label={label} sx={[{ display: 'inline-block', width: 32, height: 32, border: 1, borderColor: selected ? 'text.primary' : 'divider',
      borderRadius: 0.75, p: 0.5, flexShrink: 0 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>{preview}</Box>;
}
export interface ColorPreset { value: string; label: string }
export interface ColorPickerProps extends Omit<BoxProps, 'onChange' | 'defaultValue'> {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  allowAlpha?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  presets?: readonly ColorPreset[];
  hexLabel?: string;
  channelLabels?: readonly [string, string, string];
  opacityLabel?: string;
  presetsLabel?: string;
  invalidMessage?: string;
}
/** Local hex/RGB/alpha editor. Values emit canonical #RRGGBB or #RRGGBBAA. */
export const ColorPicker = React.forwardRef<HTMLDivElement, ColorPickerProps>(function ColorPicker(
  { label, value, defaultValue = '#325DFF', onChange, allowAlpha = true, disabled = false, readOnly = false, presets = [],
    hexLabel = 'Hex color', channelLabels = ['Red', 'Green', 'Blue'], opacityLabel = 'Opacity', presetsLabel = 'Color presets',
    invalidMessage = 'Enter a valid hex color.', sx, ...props }, ref
) {
  const id = React.useId(); const [selected, setSelected] = useControllableValue(value, defaultValue);
  const [draft, setDraft] = React.useState(selected); const [invalid, setInvalid] = React.useState(false);
  React.useEffect(() => { setDraft(selected); setInvalid(false); }, [selected]);
  const color = parse(selected) ?? { r: 0, g: 0, b: 0, a: 1 }; const normalized = serialize(color, allowAlpha);
  const commit = (next: Channels) => { if (disabled || readOnly) return; const hex = serialize(next, allowAlpha); setSelected(hex); setDraft(hex); setInvalid(false); onChange?.(hex); };
  return <Box ref={ref} {...props} role="group" aria-labelledby={`${id}-label`} aria-disabled={disabled || undefined}
    sx={[{ display: 'grid', gap: 2, minWidth: 0, maxWidth: 360, overflowWrap: 'anywhere' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    <Typography id={`${id}-label`} component="div" variant="subtitle2">{label}</Typography>
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', minWidth: 0 }}>
      <ColorSwatch color={`rgba(${color.r},${color.g},${color.b},${allowAlpha ? color.a : 1})`} label={`${label}: ${normalized}`} />
      <TextField label={hexLabel} value={draft} disabled={disabled} error={invalid || !parse(selected)} helperText={invalid || !parse(selected) ? invalidMessage : undefined}
        fullWidth slotProps={{ input: { readOnly }, htmlInput: { spellCheck: false, 'aria-readonly': readOnly || undefined } }}
        onChange={event => { if (disabled || readOnly) return; const text = event.target.value; setDraft(text); setInvalid(false);
          const next = parse(text); if (next) { const hex = serialize(next, allowAlpha); setSelected(hex); onChange?.(hex); }
        }} onBlur={() => { const next = parse(draft); if (next) setDraft(serialize(next, allowAlpha)); else setInvalid(true); }} />
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 2 }}>
      {(['r', 'g', 'b'] as const).map((channel, index) => <TextField key={channel} label={channelLabels[index]} type="number" value={color[channel]} disabled={disabled}
        slotProps={{ input: { readOnly }, htmlInput: { min: 0, max: 255, step: 1, 'aria-readonly': readOnly || undefined } }}
        onChange={event => { if (!event.target.value.trim() || !Number.isFinite(Number(event.target.value))) return;
          commit({ ...color, [channel]: Math.max(0, Math.min(255, Math.round(Number(event.target.value)))) }); }} />)}
    </Box>
    {allowAlpha ? <Slider label={opacityLabel} value={Math.round(color.a * 100)} min={0} max={100} disabled={disabled || readOnly}
      valueLabelDisplay="auto" getAriaValueText={next => `${next}%`} onChange={next => commit({ ...color, a: next / 100 })} /> : null}
    {presets.length ? <Box role="group" aria-label={presetsLabel} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{presets.map(preset => {
      const next = parse(preset.value); return <ColorSwatch key={`${preset.label}-${preset.value}`} color={next ? `rgba(${next.r},${next.g},${next.b},${allowAlpha ? next.a : 1})` : 'transparent'}
        label={preset.label} selected={!!next && serialize(next, allowAlpha) === normalized} disabled={disabled || readOnly || !next} onClick={() => { if (next) commit(next); }} />;
    })}</Box> : null}
  </Box>;
});
