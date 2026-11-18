import * as React from 'react';
import { Box, Typography, type BoxProps } from '@mui/material';
import { IconButton } from '../IconButton';

export interface ImagePreviewProps extends Omit<BoxProps, 'onLoad' | 'onError'> {
  src?: string;
  alt: string;
  aspectRatio?: number;
  fit?: 'contain' | 'cover';
  checkerboard?: boolean;
  zoomable?: boolean;
  maxZoom?: number;
  errorMessage?: React.ReactNode;
  emptyMessage?: React.ReactNode;
  loadingLabel?: string;
  zoomInLabel?: string;
  zoomOutLabel?: string;
  resetZoomLabel?: string;
  zoomLabel?: string;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
  onError?: React.ReactEventHandler<HTMLImageElement>;
}
export const ImagePreview = React.forwardRef<HTMLDivElement, ImagePreviewProps>(function ImagePreview(
  { src, alt, aspectRatio = 4 / 3, fit = 'contain', checkerboard = true, zoomable = false, maxZoom = 4,
    errorMessage = 'Image unavailable', emptyMessage = 'No preview', loadingLabel = 'Loading image', zoomInLabel = 'Zoom in',
    zoomOutLabel = 'Zoom out', resetZoomLabel = 'Reset zoom', zoomLabel = 'Image zoom', onLoad, onError, sx, ...props }, ref
) {
  const [state, setState] = React.useState<{ src?: string; status: 'loading' | 'loaded' | 'error' }>({ src, status: 'loading' });
  const [zoom, setZoom] = React.useState(1); const viewport = React.useRef<HTMLDivElement>(null);
  const status = state.src === src ? state.status : 'loading'; const maximum = Number.isFinite(maxZoom) ? Math.max(1, maxZoom) : 4;
  React.useEffect(() => { setZoom(1); if (viewport.current) { viewport.current.scrollTop = 0; viewport.current.scrollLeft = 0; } }, [src, zoomable]);
  const scale = zoomable ? Math.min(maximum, zoom) : 1;
  return <Box ref={ref} {...props} sx={[{ minWidth: 0, overflow: 'hidden' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    <Box ref={viewport} tabIndex={zoomable && scale > 1 ? 0 : undefined} role={zoomable && scale > 1 ? 'region' : undefined}
      aria-label={zoomable && scale > 1 ? `${alt || 'Image'} preview` : undefined}
      sx={{ aspectRatio: Number.isFinite(aspectRatio) && aspectRatio > 0 ? String(aspectRatio) : '4 / 3', width: '100%', overflow: scale > 1 ? 'auto' : 'hidden', position: 'relative',
        bgcolor: 'action.hover', ...(checkerboard ? { backgroundImage: 'conic-gradient(rgba(128,128,128,.15) 25%, transparent 0 50%, rgba(128,128,128,.15) 0 75%, transparent 0)', backgroundSize: '16px 16px' } : {}) }}>
      <Box sx={{ position: 'absolute', top: 0, left: 0, width: `${scale * 100}%`, height: `${scale * 100}%`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {src ? <Box component="img" key={src} src={src} alt={alt} onLoad={event => { setState({ src, status: 'loaded' }); onLoad?.(event); }}
          onError={event => { setState({ src, status: 'error' }); onError?.(event); }} sx={{ width: '100%', height: '100%', display: status === 'error' ? 'none' : 'block',
            objectFit: fit, opacity: status === 'loaded' ? 1 : 0 }} /> : null}
      </Box>
      {!src || status !== 'loaded' ? <Box role="status" sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{!src ? emptyMessage : status === 'error' ? <>{alt ? `${alt}: ` : ''}{errorMessage}</> : loadingLabel}</Typography>
      </Box> : null}
    </Box>
    {zoomable ? <Box role="group" aria-label={zoomLabel} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 1, p: 1 }}>
      <IconButton aria-label={zoomOutLabel} disabled={scale <= 1 || status !== 'loaded' || !src} onClick={() => setZoom(Math.max(1, scale - 0.5))}>−</IconButton>
      <Typography component="output" aria-live="polite" variant="caption">{Math.round(scale * 100)}%</Typography>
      <IconButton aria-label={zoomInLabel} disabled={scale >= maximum || status !== 'loaded' || !src} onClick={() => setZoom(Math.min(maximum, scale + 0.5))}>+</IconButton>
      <IconButton aria-label={resetZoomLabel} disabled={scale === 1} onClick={() => setZoom(1)}>↺</IconButton>
    </Box> : null}
  </Box>;
});
