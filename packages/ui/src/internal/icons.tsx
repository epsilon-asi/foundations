import { SvgIcon, type SvgIconProps } from '@mui/material';

export function CheckGlyph(props: SvgIconProps) {
  return <SvgIcon {...props}><path d="m9 16.2-4.2-4.2L3.4 13.4 9 19l12-12-1.4-1.4z" /></SvgIcon>;
}

export function ChevronGlyph(props: SvgIconProps) {
  return <SvgIcon {...props}><path d="m7 10 5 5 5-5z" /></SvgIcon>;
}

export function MoreGlyph(props: SvgIconProps) {
  return <SvgIcon {...props}><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></SvgIcon>;
}
