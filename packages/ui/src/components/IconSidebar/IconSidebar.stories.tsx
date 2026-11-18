import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Slider, TextField, Typography } from '@mui/material';
import LayersOutlined from '@mui/icons-material/LayersOutlined';
import PaletteOutlined from '@mui/icons-material/PaletteOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import BrushOutlined from '@mui/icons-material/BrushOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { IconButton } from '../IconButton';
import { IconMenu } from '../IconMenu';
import { InspectorSection } from '../InspectorSection';
import { PropertyListItem } from '../PropertiesDisplayCard';
import { Toolbar } from '../Toolbar';
import { IconSidebar, type IconSidebarItem, type IconSidebarProps } from './IconSidebar';

function LayersContent() {
  const [hidden, setHidden] = useState<string[]>([]);
  const [selected, setSelected] = useState('Coastal forms');
  const [message, setMessage] = useState('');
  return <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
    <Toolbar aria-label="Layer actions" density="compact" sx={{ border: 0, p: 0 }}
      endActions={<IconMenu aria-label="Layer options" items={[
        { id: 'duplicate', label: 'Duplicate layer' }, { id: 'rename', label: 'Rename layer' }, { id: 'merge', label: 'Merge layers', disabled: true }
      ]} onItemClick={(item) => setMessage(item.label as string)} />}>
      <IconButton aria-label="Add layer" tooltip="Add layer" size="small" outlined={false} onClick={() => setMessage('New layer added')}><AddOutlined /></IconButton>
      <Typography variant="caption" color="text.secondary">4 layers</Typography>
    </Toolbar>
    <Box role="list" aria-label="Document layers" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0.5 }}>
      {['Typography', 'Coastal forms', 'Paper texture', 'Background'].map((name, index) => <Box key={name} role="listitem"
        sx={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 0.75, p: 0.5, borderRadius: 1, bgcolor: selected === name ? 'action.selected' : undefined }}>
        <IconButton aria-label={`${hidden.includes(name) ? 'Show' : 'Hide'} ${name}`} size="small" outlined={false}
          onClick={() => setHidden((previous) => previous.includes(name) ? previous.filter((one) => one !== name) : [...previous, name])}>
          {hidden.includes(name) ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
        </IconButton>
        <Box aria-hidden sx={{ width: 28, height: 32, borderRadius: 0.5, flexShrink: 0, border: 1, borderColor: 'divider',
          background: ['linear-gradient(150deg,#e5dfd0 60%,#172c36 60%)', 'linear-gradient(35deg,#27616a 45%,#d9ac82 45%,#d9ac82 65%,#172c36 65%)', '#ddd5c4', '#ece6d8'][index] }} />
        <ActionButton variant="text" size="small" aria-pressed={selected === name} onClick={() => setSelected(name)}
          title={name} sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', px: 0.5, fontSize: 12, color: 'text.primary' }}>
          <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Box>
        </ActionButton>
      </Box>)}
    </Box>
    <InspectorSection title="Transform" defaultExpanded={false}>
      <Box component="dl" sx={{ m: 0 }}><PropertyListItem label="Position" value="120, 80" /><PropertyListItem label="Scale" value="100%" /></Box>
    </InspectorSection>
    {message ? <Typography role="status" variant="caption">{message}</Typography> : null}
  </Box>;
}

function AdjustmentsContent() {
  const [exposure, setExposure] = useState(0);
  return <Box sx={{ display: 'grid', gap: 1.5 }}>
    <InspectorSection title="Light"><Typography id="sidebar-exposure-label" variant="body2">Exposure: {exposure}</Typography>
      <Slider aria-labelledby="sidebar-exposure-label" min={-100} max={100} value={exposure} onChange={(_, next) => setExposure(next as number)} />
      <Typography variant="caption" color="text.secondary">Adjust the selected layer.</Typography>
    </InspectorSection>
    <InspectorSection title="Colour" defaultExpanded={false}>Saturation and temperature controls</InspectorSection>
    <InspectorSection title="Effects" defaultExpanded={false}>Layer effects and blending</InspectorSection>
  </Box>;
}

function ColoursContent() {
  const [colour, setColour] = useState('#27616A');
  return <Box sx={{ display: 'grid', gap: 2 }}>
    <Typography variant="body2" color="text.secondary">Document palette</Typography>
    <Box role="group" aria-label="Document colours" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {['#172C36', '#27616A', '#72958C', '#D9AC82', '#E5DFD0', '#ECE6D8'].map((hex) => <IconButton key={hex}
        aria-label={hex} aria-pressed={colour === hex} tooltip={hex} onClick={() => setColour(hex)}
        sx={{ bgcolor: hex, border: '2px solid', borderColor: colour === hex ? 'primary.main' : 'divider',
          '&:hover': { bgcolor: hex }, '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }} />)}
    </Box>
    <Typography variant="body2">Selected: {colour}</Typography>
    <InspectorSection title="Colour values"><Box component="dl" sx={{ m: 0 }}><PropertyListItem label="Hex" value={colour} /></Box></InspectorSection>
  </Box>;
}

const exampleItems: IconSidebarItem[] = [
  { id: 'layers', label: 'Layers', icon: <LayersOutlined />, group: 'document', content: <LayersContent /> },
  { id: 'history', label: 'History', icon: <HistoryOutlined />, group: 'document', content: <Box sx={{ display: 'grid', gap: 1 }}>
    {['Open document', 'Add coastal forms', 'Set colour palette', 'Adjust typography'].map((step) => <ActionButton key={step} size="small" variant="text"
      sx={{ justifyContent: 'flex-start', color: 'text.primary' }}>{step}</ActionButton>)}
  </Box> },
  { id: 'adjustments', label: 'Adjustments', icon: <TuneOutlined />, group: 'appearance', content: <AdjustmentsContent /> },
  { id: 'colours', label: 'Colours', icon: <PaletteOutlined />, group: 'appearance', content: <ColoursContent /> },
  { id: 'brushes', label: 'Brushes', icon: <BrushOutlined />, group: 'tools', disabled: true, disabledReason: 'Select a paintable layer', content: 'Brush settings' }
];
const exampleFooter: IconSidebarItem[] = [{ id: 'settings', label: 'Settings', icon: <SettingsOutlined />, content: <Box sx={{ display: 'grid', gap: 1 }}>
  <InspectorSection title="Workspace"><Typography variant="body2">Panels follow the workspace theme.</Typography></InspectorSection>
  <InspectorSection title="Shortcuts"><Typography variant="body2">Use Up and Down to move between icons. Move toward the canvas to enter a panel. Escape closes it.</Typography></InspectorSection>
</Box> }];

/** A small composition example, not an application shell or a dependency of IconSidebar. */
function EditorExample(props: IconSidebarProps) {
  const reverse = (props.side === 'left') !== (props.dir === 'rtl');
  return <Box dir={props.dir} sx={{ display: 'flex', flexDirection: 'column', height: 560, minWidth: 0,
    border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.default' }}>
    <Toolbar aria-label="Document actions" density="compact" sx={{ flexShrink: 0, border: 0, borderBottom: 1, borderColor: 'divider', borderRadius: 0 }}>
      <Typography variant="body2" sx={{ minWidth: 0, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        coastal-study.psd <Box component="span" sx={{ color: 'text.secondary' }}>· 4 layers</Box>
      </Typography>
      <IconMenu aria-label="Document options" size="small" items={[{ id: 'save', label: 'Save document' }, { id: 'export', label: 'Export image' }]} />
    </Toolbar>
    <Box sx={{ display: 'flex', flexDirection: reverse ? 'row-reverse' : 'row', flex: 1, minHeight: 0, minWidth: 0 }}>
      <Box component="main" aria-label="Document preview" sx={{ display: props.panelMode === 'inline' ? { xs: 'none', md: 'flex' } : 'flex',
        flex: 1, minWidth: 0, minHeight: 0, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', p: { xs: 1, sm: 3 }, gap: 1.5,
        backgroundImage: 'linear-gradient(45deg,rgba(127,127,127,.04) 25%,transparent 25%),linear-gradient(-45deg,rgba(127,127,127,.04) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(127,127,127,.04) 75%),linear-gradient(-45deg,transparent 75%,rgba(127,127,127,.04) 75%)',
        backgroundSize: '16px 16px', backgroundPosition: '0 0,0 8px,8px -8px,-8px 0' }}>
        <Box component="svg" viewBox="0 0 300 400" role="img" aria-label="Coastal study poster" sx={{ direction: 'ltr', width: '100%', maxWidth: 290, maxHeight: 390, minHeight: 0, filter: 'drop-shadow(0 8px 18px rgba(0,0,0,.16))' }}>
          <rect width="300" height="400" fill="#ece6d8" /><circle cx="225" cy="95" r="45" fill="#d9ac82" />
          <path d="M0 180C55 135 70 220 130 180S240 135 300 170V400H0Z" fill="#72958c" />
          <path d="M0 240C75 180 85 285 150 220S240 205 300 230V400H0Z" fill="#27616a" />
          <path d="M0 300C55 245 125 345 195 280S270 275 300 280V400H0Z" fill="#172c36" />
          <text x="24" y="44" fill="#172c36" fontSize="12" letterSpacing="3" fontFamily="sans-serif">FIELD NOTES / 07</text>
          <text x="24" y="105" fill="#172c36" fontSize="43" fontWeight="700" fontFamily="sans-serif">COASTAL</text>
          <text x="24" y="145" fill="#172c36" fontSize="32" fontFamily="sans-serif">STUDY</text>
          <text x="24" y="375" fill="#ece6d8" fontSize="9" letterSpacing="2" fontFamily="sans-serif">FORM · COLOUR · TEXTURE</text>
        </Box>
        <Typography variant="caption" color="text.secondary">100%</Typography>
      </Box>
      <IconSidebar {...props} />
    </Box>
  </Box>;
}

async function checkSidebarLayout({ canvasElement }: { canvasElement: HTMLElement }) {
  // The panel and nested menus use portals, so include the entire rendered document.
  const active = canvasElement.querySelector('[data-sidebar-item][aria-expanded="true"]');
  const controlledPanel = active?.getAttribute('aria-controls');
  if (controlledPanel) await waitFor(() => expect(canvasElement.ownerDocument.getElementById(controlledPanel)).toBeVisible());
  await checkStoryLayout({ canvasElement: canvasElement.ownerDocument.body, markChecked: false });
  await waitFor(async () => {
    for (const collection of canvasElement.ownerDocument.querySelectorAll<HTMLElement>('[role="toolbar"], [role="list"]')) {
      await expect(collection.scrollWidth).toBeLessThanOrEqual(collection.clientWidth + 2);
    }
  });
  await checkStoryLayout({ canvasElement });
}

const meta = {
  title: 'Components/IconSidebar', component: IconSidebar, play: checkSidebarLayout,
  args: { items: exampleItems, footerItems: exampleFooter, defaultValue: 'layers', 'aria-label': 'Document panels' },
  render: (args) => <EditorExample {...args} />
} satisfies Meta<typeof IconSidebar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Collapsed: Story = { args: { defaultValue: null } };
export const ExpandedLabels: Story = { args: { defaultExpanded: true } };
export const LeftSide: Story = { args: { side: 'left' } };
export const InlinePanel: Story = { args: { panelMode: 'inline' } };
export const InlineWithLabels: Story = { args: { panelMode: 'inline', defaultExpanded: true } };
export const Compact: Story = { args: { density: 'compact' } };
export const Adjustments: Story = { args: { defaultValue: 'adjustments' } };
export const Colours: Story = { args: { defaultValue: 'colours' } };
export const History: Story = { args: { defaultValue: 'history' } };
export const FooterPanel: Story = { args: { defaultValue: 'settings' } };
export const WithoutFooter: Story = { args: { footerItems: [] } };
export const WithBadges: Story = { args: { items: exampleItems.map((item) => item.id === 'layers' ? { ...item, badge: 4, badgeLabel: '4 document layers' } : item) } };
export const AllDisabled: Story = { args: { items: exampleItems.map((item) => ({ ...item, disabled: true, disabledReason: 'Open a document first' })), footerItems: [], defaultValue: null } };
export const Empty: Story = { args: { items: [], footerItems: [], defaultValue: null } };
export const ManyItems: Story = { args: { defaultValue: null, items: Array.from({ length: 24 }, (_, index) => ({
  id: `panel-${index}`, label: `Panel ${index + 1}`, icon: index % 2 ? <TuneOutlined /> : <LayersOutlined />,
  group: String(Math.floor(index / 4)), content: <Typography>Panel {index + 1} content</Typography>
})) } };
export const LongLabels: Story = { args: { defaultExpanded: true, defaultValue: 'layers', items: [
  { ...exampleItems[0], label: 'Document layers and linked smart objects', description: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' },
  { ...exampleItems[2], label: 'Colour adjustments and appearance settings' }
] } };
export const ScrollableContent: Story = { args: { items: [{ ...exampleItems[0], content:
  <Box sx={{ display: 'grid', gap: 2 }}>{Array.from({ length: 40 }, (_, index) => <Typography key={index}>Layer {index + 1}: Document artwork</Typography>)}</Box>,
  footer: <ActionButton size="small">Add layer</ActionButton> }] } };
export const KeepPanelState: Story = { args: { keepMounted: true, items: [
  { ...exampleItems[0], content: <TextField label="Document title" defaultValue="Coastal study" fullWidth multiline /> }, exampleItems[2]
] } };
export const PersistentOverlay: Story = { args: { dismissOnClickAway: false } };
export const Narrow: Story = { decorators: [(Story) => <Box sx={{ width: 280, maxWidth: '100%' }}><Story /></Box>] };
export const RightToLeft: Story = { args: { dir: 'rtl', defaultExpanded: true } };
export const Dark: Story = { decorators: [withDarkUi] };
export const DarkRail: Story = { args: { defaultValue: null }, decorators: [withDarkUi] };
export const DarkInline: Story = { args: { panelMode: 'inline' }, decorators: [withDarkUi] };
export const Controlled: Story = { args: { value: 'layers', expanded: false }, render: function Example(args) {
  const [value, setValue] = useState(args.value); const [expanded, setExpanded] = useState(args.expanded);
  useEffect(() => setValue(args.value), [args.value]); useEffect(() => setExpanded(args.expanded), [args.expanded]);
  return <EditorExample {...args} value={value} expanded={expanded}
    onChange={(next, event, reason) => { setValue(next); args.onChange?.(next, event, reason); }}
    onExpandedChange={(next) => { setExpanded(next); args.onExpandedChange?.(next); }} />;
} };
export const Keyboard: Story = { args: { defaultValue: null }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(canvas.getByRole('button', { name: 'Layers' }));
  await userEvent.keyboard('{ArrowLeft}');
  await waitFor(() => expect(body.getByRole('region', { name: 'Layers' })).toHaveFocus());
  await userEvent.keyboard('{Escape}');
  await expect(canvas.getByRole('button', { name: 'Layers' })).toHaveFocus();
  await expect(body.queryByRole('region', { name: 'Layers' })).not.toBeInTheDocument();
  await checkSidebarLayout({ canvasElement });
} };
export const NestedMenu: Story = { play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(body.getByRole('button', { name: 'Layer options' }));
  await waitFor(() => expect(body.getByRole('menu')).toBeVisible());
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument());
  await expect(body.getByRole('region', { name: 'Layers' })).toBeVisible();
  await checkSidebarLayout({ canvasElement });
} };

export const Comfortable: Story = { args: { density: 'comfortable' } };
