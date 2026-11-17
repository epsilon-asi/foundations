
# `@your-scope/mui7-react19-ui`

A publish-ready component library starter for React 19 and Material UI 7 with:

- TypeScript-first component APIs
- Storybook for docs and isolated development
- Dual ESM + CJS package output
- Declaration files for downstream consumers
- Peer dependency boundaries for React, MUI, and Emotion
- Vitest + Testing Library
- GitHub Actions CI and npm trusted-publishing workflow

## What is in here

- `UiProvider` and `createUiTheme()` for app-level theming
- `ActionButton` for common CTA/loading interactions
- `StatCard` for dashboard metrics
- `EmptyState` for empty/error/no-data experiences
- `PageSection` for consistent page-level layout blocks
- `HorizontalCard` for responsive heading/content layouts
- `DecoratedCard` for content with a decorative background graphic
- `PropertiesDisplayCard` and `PropertyListItem` for accessible label/value displays
- `DialogCard` for confirmation and informational card content
- `ContactCard` and `HeroCard` for profile and promotional content
- `GradientStepper` for controlled step progress displays
- `IconButton`, `Menu`, `DropdownMenu`, `IconMenu`, and `ChipMenu` for accessible actions
- `createSettingsContext()` for a typed, localStorage-backed settings provider
- `createVariableThemeContext()` for a persisted, user-adjustable MUI theme driven by a config object

## Quick start

```bash
npm install
npm run storybook
```

Build the package:

```bash
npm run build
```

Type-check:

```bash
npm run typecheck
```

Run tests once:

```bash
npm run test:run
```

Create a local publish tarball preview:

```bash
npm run pack:check
```

## Consumer installation

In a downstream UI app, install the library and its peers if they are not already present:

```bash
npm install @your-scope/mui7-react19-ui react react-dom @mui/material @emotion/react @emotion/styled
```

## Usage

```tsx
import {
  ActionButton,
  EmptyState,
  PageSection,
  StatCard,
  UiProvider,
  createUiTheme
} from '@your-scope/mui7-react19-ui';

const theme = createUiTheme({
  palette: {
    primary: {
      main: '#0f766e'
    }
  }
});

export function App() {
  return (
    <UiProvider theme={theme}>
      <PageSection
        title="Overview"
        subtitle="A starter library you can use downstream."
        action={<ActionButton size="small">Create report</ActionButton>}
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <StatCard
            title="Monthly revenue"
            value="$128,400"
            trendLabel="+12.4%"
            description="Compared to the previous 30 days"
          />

          <EmptyState
            title="No invoices yet"
            description="Create your first invoice to see recent activity here."
            action={<ActionButton>New invoice</ActionButton>}
          />
        </div>
      </PageSection>
    </UiProvider>
  );
}
```

## Package structure

```text
src/
  components/
    ActionButton/
    DecoratedCard/
    DialogCard/
    EmptyState/
    HorizontalCard/
    PageSection/
    PropertiesDisplayCard/
    StatCard/
  providers/
    SettingsProvider/
    VariableThemeProvider/
  theme/
  test/
  index.ts
.storybook/
.github/workflows/
```

## Presentation cards

The cards accept standard MUI `CardProps`, forward their root ref, and support object,
function, and array forms of `sx`. They work with `UiProvider` and have no form,
router, or API dependencies. Use React nodes for action slots, composing
`ActionButton` or your own controls:

```tsx
import {
  ActionButton,
  DecoratedCard,
  DialogCard,
  HorizontalCard,
  PropertiesDisplayCard
} from '@epsilon-asi/ui';

<HorizontalCard title="Workspace" subtitle="Shared project details." contentSize={8}>
  <PropertiesDisplayCard
    title="Overview"
    properties={[
      { id: 'name', label: 'Name', value: 'Epsilon research' },
      { id: 'count', label: 'Open items', value: 0, align: 'horizontal' }
    ]}
    headerAction={<ActionButton variant="text">Edit</ActionButton>}
  />
</HorizontalCard>;

<DecoratedCard
  title="Explore ideas"
  graphic={<span style={{ fontSize: 120 }}>✦</span>}
  graphicSx={{ right: -16, top: -24 }}
  actions={<ActionButton>Open workspace</ActionButton>}
>
  Collect ideas and share your next discovery.
</DecoratedCard>;

<DialogCard
  title="Report ready"
  message="Your report is ready to download."
  maxWidth="sm"
  actions={<ActionButton>Download report</ActionButton>}
/>;
```

- `HorizontalCard` stacks its heading and content below the `md` container width. Its
  `transparent` variant removes the card background, border, and shadow.
- `DecoratedCard` uses `sx` for the root and `graphicSx` for its decorative layer.
  The graphic is hidden from assistive technology and ignores pointer events.
- `PropertiesDisplayCard` renders a description list. Values accept React nodes;
  booleans display as `true`/`false`, zero is retained, and nullish values display
  as `—`. Use stable property `id`s for collections that change order. Standalone
  `PropertyListItem` components belong inside a `<dl>` and support custom children
  and an `emptyValue` fallback. Horizontal items wrap when their container is too narrow.
- `DialogCard` is card content; the consuming application owns modal behavior,
  focus management, action state, and navigation. `maxWidth={false}` removes its
  width limit.

When adapting Trader call sites, replace action definition objects with JSX action
slots. `DecoratedCard`'s old `sx.graphic` becomes `graphicSx`; root styling uses
normal MUI `sx`. No legacy form providers or action-button definitions are needed.

### Contact, hero and progress displays

`ContactCard` accepts `name`, `photo`, `jobTitle`, `skills`, a decorative cover image
(`graphic`), and an `actions` node. Photos fall back to initials. The legacy job
`role` prop is named `jobTitle` so the native HTML `role` remains available.

`HeroCard` accepts an eyebrow (`title`), main heading (`header`), rich `content`,
`visual`, and `action` nodes. `flip` moves the visual before the text in reading
order. Its layout stacks below `md`.

`GradientStepper` accepts `steps` with optional stable `id`s and custom `icon`s,
and a controlled `activeStep`. It renders an ordered list with the current step
marked by `aria-current="step"`. An index of `-1` leaves all steps inactive; an
index equal to the step count marks all steps complete in linear mode. It supports MUI stepper
props, including vertical orientation, without owning navigation or form state.

### Menus and icon buttons

```tsx
import { DropdownMenu, IconMenu, ChipMenu, type MenuItemDefinition } from '@epsilon-asi/ui';

const items: MenuItemDefinition[] = [
  { id: 'open', label: 'Open workspace', onClick: () => openWorkspace() },
  { id: 'pin', label: 'Pinned', checked: pinned, onClick: () => setPinned(!pinned) },
  { id: 'delete', label: 'Delete workspace', disabled: true }
];

<DropdownMenu label="Workspace actions" items={items} />;
<IconMenu aria-label="Workspace actions" items={items} />;
<ChipMenu label="Workspace actions" items={items} />;
```

The three trigger components own their open state and anchor. `Menu` is the
controlled equivalent: supply `open`, `anchorEl`, and `onClose`. Its `id` identifies
the actual menu list; `labelledBy` connects it to a trigger. Use `slotProps.list`
to supply an accessible label for a standalone menu. `menuProps` on the trigger
components configures MUI menu positioning, styling and slots.

- `onItemClick(item, event)` receives selections, including footer actions. Each
  item's optional `onClick(item, event)` runs first. Trigger `onClick` retains its
  native meaning and is forwarded independently.
- `onClose(reason)` reports `itemClick`, `escapeKeyDown`, `backdropClick`, or
  `tabKeyDown`. `closeOnClick={false}` keeps the menu open after selection;
  dismissal via Escape, Tab or the backdrop remains available.
- `checked` and `selected` are controlled presentation state. Update the items in
  the consumer to change them. Disabled items cannot invoke selection callbacks.
- `header` is noninteractive content. Footer `actions` use the same item data
  shape as `items`, separated visually and reachable with arrow keys.
- Native Enter/Space activation and ArrowDown open the triggers. Menu navigation
  supports arrows, Home/End and type-ahead. Dismissal restores focus to the trigger.
- `IconButton` and `IconMenu` require `aria-label`. `IconButton` supports square or
  round shapes, border/filled options, MUI props, refs and tooltips, including
  tooltips on disabled buttons. `ChipMenu` uses an ordinary clickable chip rather
  than repurposing its delete action.

When adapting legacy menus, replace `anchor` refs with `anchorEl`, `onCancel` with
`onClose`, and menu selection `onClick` with `onItemClick`. Supply stable item IDs.
Replace legacy footer button definitions with menu item definitions; keep inputs
and other interactive widgets outside the menu. Dropdown triggers use standard
MUI button variants; icon triggers retain `square`/`round` shape variants.

## Publishing

### First publish from your machine

1. Change the package name in `package.json` from `@your-scope/mui7-react19-ui` to your real npm scope/package.
2. Run:
   ```bash
   npm login
   npm publish --access public
   ```

### Recommended CI publish flow

This starter includes `.github/workflows/release.yml` for npm trusted publishing from GitHub Actions.

Before using it:

1. Rename the package in `package.json`.
2. Push the repository to GitHub.
3. In npm package settings, configure this repository/workflow as a **Trusted Publisher**.
4. Create and push a semver tag:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

The workflow will install dependencies, run type-checking and tests, build the package, and publish to npm with provenance enabled.

## Storybook

Each component has examples for its presentation variants, optional content, and
relevant disabled, checked, empty, or busy states. Long-content and narrow examples
cover wrapping inside small containers; explicit dark examples cover theme usage.
Standalone `PropertyListItem` examples demonstrate its description-list semantics.

Stories run browser layout assertions that check page overflow and clipped text.
Open-menu stories also check item widths after the opening animation. Intentional
chip ellipsis, decorative clipping, and keyboard-scrollable step lists are supported.
The full component story set was checked at 320, 768, and 1280 pixels wide.

Start Storybook locally:

```bash
npm run storybook
```

Create a static build:

```bash
npm run build-storybook
```

You can deploy `storybook-static/` to any static host.

## Notes for downstream apps

- The library treats `react`, `react-dom`, `@mui/material`, `@emotion/react`, and `@emotion/styled` as peer dependencies so your consuming apps own those versions.
- The package exports both ESM and CJS entry points and ships `.d.ts` files.
- If a downstream app uses Next.js SSR/App Router, keep following MUI’s official integration guidance in that app for cache/SSR setup.

## Rename checklist

Before publishing for real, update:

- `name` in `package.json`
- README package name and install command
- repository metadata if you want to add it
- npm trusted publisher settings






## Workspace controls

`Tabs`, `ModalDialog`, `ConfirmDialog`, `Drawer`, `Panel`, `InspectorSection`,
`Toolbar`, `ToolbarGroup`, and `SplitPane` are exported from `@epsilon-asi/ui`.
They use the current MUI theme and have no router, form, API, or persistence dependency.

### Tabs

Pass unique, stable string IDs in `tabs`, a controlled `value` (or `false` for no
selection), and `onChange(value, event)`. Each definition accepts `label`, `content`,
`icon`, `disabled`, and `disabledReason`. Tab and panel IDs are linked automatically
and unique across instances. Missing or disabled values display no active panel;
they never trigger an automatic selection callback.

Arrow keys move focus; Home/End move to the first/last available tab. Enter/Space
select the focused tab. Set `selectionFollowsFocus` for automatic activation.
`orientation`, `variant`, `density`, `tabsSx`, and `panelSx` control presentation.
Inactive content unmounts by default; `keepMounted` preserves its local state while
keeping the panel hidden. URL state and unsaved-work guards belong to the app.

```tsx
const [tab, setTab] = useState('generate');
<Tabs
  aria-label="Asset workflow"
  value={tab}
  onChange={setTab}
  tabs={[
    { id: 'generate', label: 'Generate', content: <GeneratePanel /> },
    { id: 'edit', label: 'Edit', content: <EditPanel />, disabled: !selectedAsset }
  ]}
/>;
```

### Dialogs and drawers

`ModalDialog` supplies a title, optional description, scrolling content, action
slot, and optional close button. MUI supplies the portal, focus trap, background
isolation, Escape handling, and focus restoration. `DialogCard` remains useful as
standalone card content; it does not itself create a modal.

`onClose(event, reason)` reports `escapeKeyDown`, `backdropClick`, or
`closeButtonClick`. `ConfirmDialog` adds `cancelButtonClick`, confirmation and
cancellation buttons, optional `error`, and a `destructive` variant. It initially
focuses Cancel. `onConfirm(event)` receives the original button event. The caller
owns the operation, `busy`, errors, and whether success closes the dialog. `busy`
disables the built-in actions and blocks dismissal; it does not disable arbitrary
children. Callers should disable their editable content when appropriate.

`Drawer` offers the same dismissal reasons as `ModalDialog`, four anchors, a
`width`, header/subtitle, scrolling body, and footer `actions`. Temporary drawers
are named modal dialogs; persistent/permanent drawers are named nonmodal regions.
The latter do not trap focus. Paper slot props, including function and `sx` array
forms, are composed with the defaults. Place nonmodal drawers in an appropriately
sized app layout; the app owns breakpoint decisions and panel positioning.

```tsx
<ConfirmDialog
  open={discarding}
  title="Discard this working copy?"
  description="This removes the working copy permanently."
  destructive
  confirmLabel="Discard"
  busy={discardPending}
  error={discardError}
  onConfirm={discard}
  onClose={() => setDiscarding(false)}
/>;
```

### Panels, inspector sections, and toolbars

`Panel` provides an optional heading/subtitle, separate `headerAction`, content,
and `footer`, with compact/comfortable density. Use `headingLevel` for the page's
heading hierarchy, `headerSx` to customize header layout, and `contentSx` for body padding or scrolling. A headerless panel
works as a simple surface.

`InspectorSection` adds a native disclosure button. It supports controlled
`expanded`/`onExpandedChange` or uncontrolled `defaultExpanded`, optional
`keepMounted`, and a static `collapsible={false}` mode. Header actions remain
separate from the toggle. Collapsed content is hidden from focus and assistive
technology; it unmounts by default.

`Toolbar` groups arbitrary actions and optional `endActions`. It supports compact
spacing, horizontal/vertical layouts, wrapping, and a scrolling `wrap={false}`
mode. `ToolbarGroup` provides labelled groups and optional visual dividers.
By default, one available button/link is a tab stop; arrows move between actions,
Home/End jump to the ends, and navigation wraps. Disabled and hidden actions are
skipped. Horizontal movement respects RTL. Text fields and nested toolbars retain
their own keyboard behavior. Set `rovingFocus={false}` for ordinary tab order.
Use native buttons or the library buttons so disabled actions behave consistently.

### Split panes

`SplitPane` takes exactly two children. `orientation="horizontal"` puts them side
by side; `vertical` stacks them. Sizes are pixels for the first panel. Use
`defaultSize` for local state or controlled `size`/`onSizeChange(size, reason)`;
`reason` is `pointer` or `keyboard`. `onResizeEnd` reports completed gestures and
keyboard changes. A canceled/lost pointer gesture retains the last requested size
and does not emit a completion callback.

`minSize`, `maxSize`, and `minSecondSize` constrain resizing against the measured
container. When the container cannot fit both minimums, the first panel may shrink
below its requested minimum to avoid overflowing the container. The requested size
returns when space becomes available. Resizing the container itself does not emit
user-resize callbacks. Persistence belongs to the caller.

Arrow keys resize by `keyboardStep` (10px by default), Shift multiplies that by
five, and Home/End use the available bounds. RTL horizontal movement is reversed.
The labelled separator exposes its orientation, controlled panel, and live bounds.
`disabled` removes it from the tab sequence and prevents resizing. Label both
panels with `firstLabel`/`secondLabel` and the divider with `resizeLabel`.

Give the parent an explicit height for vertical layouts; `SplitPane` fills its
parent. Panels scroll independently, and `firstSx`/`secondSx` customize them.

```tsx
<Box sx={{ height: 480 }}>
  <SplitPane defaultSize={260} minSize={160} minSecondSize={200}
    firstLabel="Assets" secondLabel="Preview" resizeLabel="Resize asset panel">
    <Panel title="Assets">Asset list</Panel>
    <Panel title="Preview">Selected asset</Panel>
  </SplitPane>
</Box>;
```

Every workspace control has tests and interactive stories, including stress cases,
dark mode, and narrow layouts. Overlay stories inspect portal content as well as
the canvas. Layout assertions allow the initial MUI measurement/transition to settle
before reporting persistent overflow or clipped text.

## Icon sidebar

`IconSidebar` is a Photoshop-style panel dock built from our `Toolbar`, `IconButton`,
and `Panel`. It defaults to a narrow right-side icon rail with nonmodal panels that
open beside it. Panel content can compose `InspectorSection`, `IconMenu`, and the
other UI components. It does not own application navigation, persistence, or API calls.

```tsx
const [panel, setPanel] = useState<string | null>('layers');

<Box sx={{ display: 'flex', height: 560 }}>
  <Box sx={{ flex: 1, minWidth: 0 }}>Your editor</Box>
  <IconSidebar
    aria-label="Editor panels"
    value={panel}
    onChange={setPanel}
    items={[
      { id: 'layers', label: 'Layers', icon: <LayersIcon />, content: <LayerControls />, group: 'document' },
      { id: 'history', label: 'History', icon: <HistoryIcon />, content: <RevisionList />, group: 'document' },
      { id: 'colours', label: 'Colours', icon: <PaletteIcon />, content: <ColourControls />, group: 'appearance' }
    ]}
    footerItems={[
      { id: 'settings', label: 'Settings', icon: <SettingsIcon />, content: <EditorSettings /> }
    ]}
  />
</Box>;
```

Supply your own icon nodes and panel content. IDs must be unique across `items` and
`footerItems`. Consecutive items with the same `group` appear together; changing the
group adds a separator. Footer items remain at the bottom while a long rail scrolls.
Every icon has an accessible label and a tooltip; disabled items can explain why
with `disabledReason`. Optional `badge` and `badgeLabel` provide a visual count and
an accessible description. `panelTitle`, `description`, and `footer` customize the
shared `Panel`.

Selection supports controlled `value`/`onChange` or uncontrolled `defaultValue`.
Clicking the active icon again closes its panel. The selection callback receives
`(value, event, reason)`, where the value is an item ID or `null` and the reason is
`itemClick`, `keyboard`, `closeButtonClick`, `escapeKeyDown`, or `clickAway`.
Item `onClick` callbacks run before selection and can call `preventDefault()` to
cancel it. A missing or disabled selected item displays no panel and does not
silently select a replacement.

The rail's label expansion is independent: use `expanded`/`onExpandedChange` or
`defaultExpanded`. `side="left"` changes the docking edge; `density="compact"`
reduces spacing. `panelMode="inline"` reserves layout space, while the default
`overlay` uses a positioned portal that can flip and fit within the viewport.
`panelWidth` defaults to 320px (minimum 160px), with the available viewport or
container determining the rendered width. Give the parent an explicit height and
place the rail at the chosen edge of your editor. Narrow inline layouts shrink the
labelled rail to preserve panel space.

Up/Down and Home/End use the existing Toolbar's navigation, including footer items
and the expansion button, while skipping disabled controls. The horizontal arrow
toward the editor opens the focused item's panel and focuses its region. From the
region itself, the opposite arrow returns to the icon. Escape and the close button
close the pane and restore focus. Ordinary input editing keys remain intact.
Panels are nonmodal: they do not trap focus or block the rest of the editor.

Overlay panels dismiss on outside clicks by default without stealing focus from
the clicked control. Set `dismissOnClickAway={false}` to keep them open. Inline
panels stay open on outside clicks. Menus portaled from the panel remain inside
its interaction boundary and handle their own dismissal first.

Inactive content unmounts by default. Set `keepMounted` to preserve local state
when switching or closing panels. The component and its portal retain the chosen
text direction. No icon package is required at runtime.

The stories include a composed editor example, light/dark themes, labelled and
icon-only rails, both docking edges, both panel modes, narrow layouts, scrolling,
disabled items, nested menus, and keyboard interaction.
