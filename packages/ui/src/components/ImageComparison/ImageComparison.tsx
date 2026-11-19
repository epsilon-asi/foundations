import * as React from 'react';
import { Box, Typography, type BoxProps } from '@mui/material';
import { ImagePreview } from '../ImagePreview';
import { Slider } from '../Slider';
import { useControllableValue } from '../../internal/useControllableValue';

export interface ComparisonImage { src?: string; alt: string; label?: React.ReactNode }
export interface ImageComparisonProps extends Omit<BoxProps, 'position'> {
  'aria-label': string;
  before: ComparisonImage;
  after: ComparisonImage;
  mode?: 'split' | 'side-by-side';
  position?: number;
  defaultPosition?: number;
  onPositionChange?: (position: number) => void;
  positionLabel?: string;
  instructions?: React.ReactNode;
  getPositionText?: (position: number) => string;
  disabled?: boolean;
  aspectRatio?: number;
  fit?: 'contain' | 'cover';
}
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 50;
export const ImageComparison = React.forwardRef<HTMLDivElement, ImageComparisonProps>(function ImageComparison(
  { before, after, mode = 'split', position, defaultPosition = 50, onPositionChange, positionLabel = 'Before image visibility',
    instructions = 'Drag across the image or use the slider arrow keys to compare.', getPositionText = value => `${Math.round(value)}% before image visible`,
    disabled = false, aspectRatio = 4 / 3, fit = 'contain', sx, ...props }, ref
) {
  const [value, setValue] = useControllableValue(position, defaultPosition); const visible = clamp(value);
  const pointer = React.useRef<number | null>(null);
  const change = (next: number) => { if (disabled) return; const percentage = clamp(next); setValue(percentage); onPositionChange?.(percentage); };
  const updatePointer = (event: React.PointerEvent<HTMLDivElement>) => { const rect = event.currentTarget.getBoundingClientRect(); if (rect.width > 0) change((event.clientX - rect.left) / rect.width * 100); };
  const image = (entry: ComparisonImage) => <ImagePreview src={entry.src} alt={entry.alt} aspectRatio={aspectRatio} fit={fit} />;
  return <Box ref={ref} {...props} role="group" sx={[{ minWidth: 0, overflowWrap: 'anywhere' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    {mode === 'side-by-side' ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
      {[before, after].map((entry, index) => <Box key={index} sx={{ minWidth: 0 }}>{image(entry)}<Typography component="div" variant="caption" sx={{ mt: 1 }}>{entry.label ?? (index ? 'After' : 'Before')}</Typography></Box>)}
    </Box> : <>
      <Box data-comparison-surface="" sx={{ position: 'relative', overflow: 'hidden', cursor: disabled ? 'default' : 'col-resize', touchAction: disabled ? 'auto' : 'pan-y', userSelect: 'none', '& img': { pointerEvents: 'none' } }}
        onPointerDown={event => { if (disabled || event.button !== 0) return; pointer.current = event.pointerId; event.currentTarget.setPointerCapture?.(event.pointerId); updatePointer(event); }}
        onPointerMove={event => { if (pointer.current === event.pointerId) updatePointer(event); }}
        onPointerUp={event => { if (pointer.current === event.pointerId) { pointer.current = null; if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } }}
        onPointerCancel={() => { pointer.current = null; }}>
        {image(after)}
        <Box sx={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - visible}% 0 0)` }}>{image(before)}</Box>
        <Box aria-hidden="true" sx={{ position: 'absolute', top: 0, bottom: 0, left: `${visible}%`, width: 2, transform: 'translateX(-50%)', bgcolor: '#fff', boxShadow: '0 0 0 1px #0f172a', pointerEvents: 'none' }}>
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', border: '1px solid #0f172a', borderRadius: 1,
            bgcolor: '#fff', color: '#0f172a', px: 1, py: 2, lineHeight: 1 }}>↔</Box>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 1 }}>
        <Typography component="div" variant="caption" sx={{ minWidth: 0 }}>{before.label ?? 'Before'}</Typography><Typography component="div" variant="caption" sx={{ minWidth: 0, textAlign: 'end' }}>{after.label ?? 'After'}</Typography>
      </Box>
      <Slider label={positionLabel} value={visible} disabled={disabled} min={0} max={100} step={1} onChange={change}
        getAriaValueText={getPositionText} helperText={instructions} valueLabelDisplay="auto" />
    </>}
  </Box>;
});
