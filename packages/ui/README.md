
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
- `InsightCard`, `DateDisplay`, `StatusBadge`, and `VerticalTimeline` for insights and activity
- `PageHeader` and `Breadcrumbs` for content headings and location trails
- `NavigationList` and `NavigationSidebar` for router-independent application navigation
- `SingleSelect`, `MultiSelect`, and `EnumSelect` for searchable selections with rich option content
- `Accordion` and `AccordionGroup` for accessible standalone and grouped disclosures
- `Switch`, `Checkbox`, `RadioGroup`, `ChoiceCardGroup`, `Slider`, and `RangeSlider` for independent settings controls
- `Alert` and `Toast` for application feedback
- `FileDropzone`, `SelectedFileList`, and `UploadDialog` for local file selection and caller-owned submission
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

## Insights, dates, status and activity

`InsightCard` composes `DecoratedCard` with an icon, heading, `headerAction` slot,
body and inherited `actions`. Use `emphasis="solid"` or `"soft"` and any of the six
semantic palette tones. Graphics are decorative and have no shared SVG IDs;
replace `graphic` or pass `null` to remove it. Supply action elements such as our
`ActionButton` and `IconMenu`, including their callbacks and inherited colours.

`StatusBadge` is presentation only. Map domain states to a `label` and `tone`
(`neutral`, `info`, `success`, `warning`, `error`) in your application. It supports
soft, outlined and solid variants, two sizes, an optional indicator, and `pulse`
that respects reduced motion. `display="dot"` retains the accessible label and a
keyboard-focusable tooltip. Use application live regions for status announcements.

`DateDisplay` renders a semantic `<time>` from a Date, ISO string or epoch
milliseconds. `start` enables exact calendar-day progress, clamped to 0–100;
reversed or invalid ranges omit progress. Same-day ranges are complete on their
due date. Missing/invalid values use `emptyValue` (default `—`). `showRelative`
shows the day difference; otherwise it appears in a tooltip. Locale defaults to
`en-US` and time zone to `UTC`; `formatOptions` customizes Intl formatting. Pass
valid Intl locale/zone identifiers and ISO strings with an explicit offset.
`now` is caller-controlled for deterministic rendering; no background timer runs.
Pass the same `now`, locale and zone on server and client when hydrating dates.

`VerticalTimeline` uses an ordered list and container queries, so narrow panels
keep a single readable column even on wide screens. Use `position` (`right`,
`left`, `alternate`, `alternate-reverse`), compact/comfortable density, absolute or
relative dates, and `status`, `content`, `icon`, `actions` slots per item. DOM order
always matches the supplied item order. Date formatting follows the same Intl
conventions; relative activity uses elapsed time. Empty lists use our `EmptyState`
or a supplied `emptyState`. No chart, Moment or MUI Lab dependency is required.

## Page headings and navigation

`PageHeader` composes `Breadcrumbs`, an h1 (or `headingLevel="h2"`), eyebrow,
subtitle and wrapping actions. It owns neither document metadata nor application
layout. Supply the complete breadcrumb trail, including the current page. The
last breadcrumb is always noninteractive with `aria-current="page"`; disabled
crumbs cannot navigate. Other crumbs support native `href` or action callbacks.
MUI breadcrumb collapsing and separators remain available.

`NavigationList` replaces the legacy router-bound MenuList with a native nav/list
and disclosure buttons. `NavigationSidebar` composes it with our `Drawer`, adding
header/footer slots and a scrollable body. Neither imports a router or API client.

```tsx
const [page, setPage] = useState('assets');

<Box sx={{ height: 480, display: 'flex' }}>
  <NavigationSidebar title="Studio" value={page}
    items={[
      { id: 'library', label: 'Library', children: [
        { id: 'assets', label: 'Assets', href: '/assets' },
        { id: 'collections', label: 'Collections', href: '/collections' }
      ] },
      { id: 'settings', label: 'Settings', onClick: () => openSettings() }
    ]}
    onSelect={(item, event) => {
      event.preventDefault();
      setPage(item.id);
      // Application performs routing when appropriate.
    }} />
</Box>;
```

IDs must be globally unique within a navigation list. `value` is application-owned;
selection never silently changes it. Item callbacks run first; `preventDefault()`
cancels selection. `onSelect` can prevent native link navigation for SPA routing.
Use `renderLink(props)` for a router adapter and forward **all** supplied props,
including `id`, style, accessibility/data attributes and `onClick`, to its anchor.
Breadcrumbs accept the same adapter contract.

Branches without a destination/action are disclosure buttons. Branches with their
own destination/action get a separate expansion button. Sections (`kind="section"`)
group children under headings. Disabled branches disable all descendants. Optional
icons, descriptions, badges, `textValue` (for rich labels) and disabled reasons are
supported. Selection reveals ancestors in uncontrolled expansion; use
`expandedIds`/`onExpandedChange` for complete control or `defaultExpandedIds` for
initial expansion. Manual collapse remains available.

Tab follows native links/buttons. Up/Down, Home/End and typeahead move among visible,
enabled primary rows; horizontal arrows open/close branches or move between parent
and child, mirrored in RTL. Removed, disabled or hidden focused items recover focus
to an available parent/row. Routing callbacks and expansion are independent.

The sidebar defaults to a left permanent drawer, 264px wide, fitting its parent's
height. Persistent/permanent variants are nonmodal; temporary mode provides the
shared Drawer's focus trap, restoration, Escape/backdrop dismissal and close button.
`open` remains controlled. Temporary selection reports `onClose(event, 'itemSelect')`
by default; change `closeOnSelect` as needed. A prevented item callback suppresses
selection and closing; preventing native routing in `onSelect` still allows closing.
`busy` disables navigation and dismissal. Custom header/footer controls should
receive their own busy/disabled state. Keep very deep navigation concise on small
screens; nesting consumes inline space.

Each new component has unit tests, dark and narrow-layout stories, and browser
layout assertions; navigation stories also exercise keyboard selection/dismissal.

## Custom selects

`SingleSelect`, `MultiSelect` and `EnumSelect` share a custom MUI Autocomplete
combobox. They carry over core-ui's searchable selection, chips and option icons,
with richer descriptions, metadata and grouping. They reuse our `IconButton`,
`ListSubheader` and internal glyphs. No router, form library, schema or API client
is required. `SelectField` remains available for native option/optgroup use cases.

```tsx
import { SingleSelect, MultiSelect, EnumSelect, StatusBadge } from '@epsilon-asi/ui';

const models = [
  { value: 'fast', label: 'Fast concept', description: 'Quick exploration for early ideas.',
    meta: <StatusBadge label="Fast" tone="info" />, keywords: ['draft'] },
  { value: 'quality', label: 'Production quality', description: 'Detailed final artwork.',
    group: 'Production' },
  { value: 'legacy', label: 'Legacy model', disabled: true,
    disabledReason: 'Unavailable for new projects' }
];

<SingleSelect label="Model" options={models} value={model}
  onChange={(next) => setModel(next)} helperText="Search by name or description." />;

<MultiSelect label="Models to compare" options={models} value={modelsToCompare}
  onChange={(next) => setModelsToCompare(next)} limitTags={2} />;

const Stage = { Draft: 'draft', InReview: 'in_review', Approved: 'approved' } as const;
<EnumSelect label="Stage" enumValues={Stage} value={stage}
  onChange={(next) => setStage(next)}
  getOptionDetails={(value) => ({ description: value === 'approved' ? 'Ready for production.' : 'Still in progress.' })} />;
```

Each option has a unique `value` (string or number) and a plain-text `label`.
Optional `description`, `icon`, `meta`, `group`, `keywords`, `disabled` and
`disabledReason` supply context. Text wraps in the popup instead of being truncated.
`renderOptionContent(option, { selected, inputValue })` can replace the row content;
keep it noninteractive so the component can own the option's keyboard and selection
semantics. Do not put buttons, links or focusable badges inside options. The label
remains the accessible option name and selected display text.

Search matches labels, string descriptions and keywords, ignoring case/diacritics.
Provide keywords for rich descriptions. Use `filterOptions(options, query)` for a
custom filter, or `searchable={false}` for a choice-only popup. Groups keep their
first-appearance order and collect matching options together; ungrouped entries
appear under `ungroupedLabel` (default `Other`). No input accepts free-form values.

Selection supports controlled `value`/`onChange` or uncontrolled `defaultValue`.
Single values use `null` for no selection; multi values use arrays. Callbacks receive
`(nextValue, event, reason)`, with `selectOption`, `removeOption`, `clear` or `blur`.
Numeric `0` and the empty string are valid keys, distinct from `null`. Missing saved
values remain visible using their key until matching options arrive. New option
objects and callback updates do not require memoization or erase the active search.
Keep a component controlled or uncontrolled throughout its lifetime.

Single selection closes the popup. Multi selection stays open by default; opt into
`closeOnSelect` if needed. Chips can be removed by pointer or Backspace/Delete;
`limitTags` limits visible chips while unfocused. Disabled options cannot be selected
from the list, but a previously selected unavailable value can still be removed.
`disabled` blocks the entire control; `readOnly` preserves focusability and prevents
editing, clearing and chip removal. `clearable={false}` removes the clear button;
`required` identifies a required field without preventing the caller from clearing it.

Labels, helper/error text and required state are associated with the input. Use
`inputRef` to focus the actual input and `ref` for the root div. Native attributes
and events apply to the root; `aria-label` and `aria-describedby` apply to the input.
An optional `name` serializes selected keys through hidden inputs (multi repeats the
name); the search query is never submitted. Disabled controls are omitted. Caller
validation supplies `error`/`helperText`. `sx` supports objects, arrays and functions.

The popup uses a portal by default to escape clipping containers; `disablePortal`
keeps it local if needed. `open`/`onOpen`/`onClose` control its visibility, while
`defaultOpen` initializes it. `inputValue`/`onInputChange` control the search text;
the search callback receives `(text, event, reason)` and includes selection/reset
notifications. Callers can supply `options`, `loading`, `loadingText` and
`noOptionsText` without embedding fetching behaviour in the component. Loading
shows an indicator and reports busy state; existing options remain usable.

Arrow keys, Home/End and Enter navigate/select while focus remains on the input.
Disabled options are skipped. Escape dismisses the popup before a containing dialog;
Tab/outside focus dismiss without committing a highlighted choice. The stories
exercise this inside our `ModalDialog`, including focus restoration to its opener.

`EnumSelect` accepts TypeScript string/numeric enums, const objects, and readonly
literal arrays. It filters numeric reverse mappings and deduplicates aliases. Values
retain their original type; numeric zero is preserved. Default labels humanize member
names (or array values). `getOptionDetails(value, memberName)` supplies labels,
descriptions, icons, metadata, grouping, keywords or availability. It is a pure adapter
around `SingleSelect`; schema normalization and form registration stay with the caller.

## Accordion

`Accordion` reuses our `InspectorSection` and `Panel`. It starts collapsed, with
compact spacing. Supply `title`, optional `subtitle`, body children and an
independent `headerAction`; the optional `footer` collapses with the body.
Use `headingLevel` (`h2`, `h3`, `h4`, default `h3`) to fit the surrounding document.
Keep title content noninteractive and put buttons/menus in `headerAction`.

```tsx
<Accordion title="Asset details" subtitle="Dimensions and ownership"
  headerAction={<IconMenu aria-label="Asset options" items={assetActions} />}
  footer={<ActionButton>Apply changes</ActionButton>}>
  <PropertiesDisplayCard title="Metadata" properties={properties} />
</Accordion>;

<AccordionGroup aria-label="Asset information" mode="single"
  defaultExpandedIds={['details']}
  items={[
    { id: 'details', title: 'Asset details', content: <AssetDetails /> },
    { id: 'history', title: 'Revision history', content: <RevisionHistory /> },
    { id: 'settings', title: 'Generation settings', disabled: true,
      subtitle: 'Requires owner access', content: <GenerationSettings /> }
  ]} />;
```

Standalone expansion supports `expanded`/`onExpandedChange(boolean)` or
`defaultExpanded`. Bodies unmount when collapsed; `keepMounted` retains their state
while hiding them from assistive technology and keyboard navigation. A parent-driven
collapse returns focus from body content to the header (or the section if its
header is disabled). It does not steal focus
from controls outside the body. Disabled headers cannot toggle; already-open content
remains readable and interactive. Disable custom body/header actions separately
when necessary. The existing InspectorSection also gains disabled disclosure and
focus recovery, preserving its expanded/compact defaults.

`AccordionGroup` supports `mode="single"` (default, at most one open) or `"multiple"`.
All sections may be closed. Use controlled `expandedIds`/`onExpandedChange(ids, itemId)`
or uncontrolled `defaultExpandedIds`. IDs must be unique. Unknown/duplicate expansion
IDs are ignored; single mode uses the first valid ID. Prop/item changes do not emit
synthetic change callbacks. Group `density`, `headingLevel` and `keepMounted` provide
shared defaults that individual items can override. Group `disabled` blocks every
header, while item `disabled` blocks one. Reordering uses stable IDs; removing an
open item hides it without silently opening another.

Enter/Space toggle the focused header. Up/Down and Home/End move between enabled
group headers without changing expansion. Tab retains the natural order of headers,
actions and visible content. Nested disclosures, nested groups, menus and input
editing keep their own keys. When a focused item disappears or becomes unavailable,
focus recovers to an available header (or the group if none remain). The group itself
is only programmatically focusable. Root/header/content styling follows Panel's
`sx`, `headerSx` and `contentSx` conventions. Use a descriptive group `aria-label`.

Stories cover controlled and uncontrolled use, single/multiple open sections,
compact spacing, nested content, disabled states, retained state, independent actions,
long labels, dark mode and keyboard/focus interactions.

## Settings controls and choice cards

`Switch` and `Checkbox` wrap MUI controls with associated `label`, `helperText`,
`error`, and `required` presentation. They support `checked`/`onChange(event, checked)`
or `defaultChecked`, native names/values, sizes, colours, `sx`, input refs and MUI
slot props. `disabled` removes interaction; `readOnly` keeps the control focusable
without changing its value. Checkbox `indeterminate` exposes the mixed state to
assistive technology. Without a visible label, supply a native input accessible
name through `slotProps.input`. Root refs follow MUI's control ref types; use
`inputRef` or the input slot ref for the actual checkbox input.

```tsx
<Switch label="Live preview" checked={live} onChange={(_, next) => setLive(next)}
  helperText="Refresh the preview when settings change." />;
<Checkbox label="Include metadata" defaultChecked name="metadata" value="include" />;
```

`RadioGroup` and `ChoiceCardGroup` share the same native radio implementation. The
card version adapts core-ui's OptionList with proper radio semantics and stable
primitive values instead of object-reference comparison or index-based React keys.
An option has `value` (string/number), `label`, and optional `description`, `icon`,
`meta` and `disabled`. Keep rich content noninteractive. Use `label`, `helperText`,
`required`, `error`, `disabled`, `readOnly`, `value`/`onChange(value, event)` or
`defaultValue`. Numeric zero is preserved. Native `name` submission uses actual
values. Group refs target the radiogroup; colours and spacing follow our theme.

```tsx
<ChoiceCardGroup label="Quality preset" value={quality}
  onChange={(next) => setQuality(next)} columns={2}
  options={[
    { value: 'draft', label: 'Draft', description: 'Quick concept exploration.' },
    { value: 'production', label: 'Production', description: 'Detailed final artwork.',
      meta: <StatusBadge label="High detail" tone="info" /> },
    { value: 'legacy', label: 'Legacy', disabled: true }
  ]} />;
```

Arrow keys and Home/End focus and select enabled options, mirrored in RTL. Tab uses
native radio-group behaviour. Read-only groups allow focus movement without changing
selection. Removed/disabled focused options recover focus to an available choice
(or the group if none remain). Missing saved values do not silently select a new
option. Card columns collapse to one on narrow screens; `columns` accepts 1, 2 or 3.
`RadioGroup row` provides a wrapping horizontal layout for simple choices.

`Slider` and `RangeSlider` adapt core-ui's slider without its fixed minimum width.
Both have a visible `label`, associated helper/error text and MUI's marks, step,
value labels, colour, orientation, slots and style overrides. Use finite values,
valid min/max bounds and a positive step (or MUI's marked-value mode). Range values
are ascending `[minimum, maximum]` tuples; thumbs cannot swap by default. Endpoint
names default to `Label: Minimum` and `Label: Maximum`, customizable with
`getAriaLabel`. Native keyboard movement, bounds and step handling remain intact.
Endpoint mark labels stay within the track edges, including RTL layouts.

```tsx
<Slider label="Opacity" min={0} max={100} step={5} value={opacity}
  onChange={(next) => setOpacity(next)} onChangeCommitted={(next) => persistOpacity(next)} />;
<RangeSlider label="Frame range" defaultValue={[20, 80]} valueLabelDisplay="auto" />;
```

Slider callbacks are `(value, event, activeThumb)` and committed callbacks are
`(value, event)`. Refs target the MUI slider root. These controls have no form
registration, schema validation, persistence or API dependencies.

## Feedback

`Alert` supports semantic severity, standard/outlined/filled variants, a `title`,
body, action slot and independent close action using our `IconButton`. Informational
and success feedback defaults to `role="status"`; warnings/errors use `role="alert"`.
Override `role` when a different announcement policy is appropriate. Text and actions
wrap on narrow screens.

`Toast` composes `Alert` with MUI Snackbar. `open` is caller-controlled. It defaults
to a six-second auto-hide timer, paused by focus/hover/window blur through Snackbar;
use `autoHideDuration={null}` for a persistent notification. Change `messageId` to
restart timing for a new message. `onClose(event, reason)` reports `timeout`,
`escapeKeyDown`, `closeButtonClick`, or optional `clickaway`. Outside clicks do not
dismiss by default; use `dismissOnClickAway` to opt in. `anchorOrigin`, Snackbar
native props and `sx` remain available. There is no global queue or API/promise
watcher; the application owns notification state and message content.

```tsx
<Alert severity="warning" title="Review required" onClose={() => setWarning(false)}>
  Some assets need approval before publishing.
</Alert>;
<Toast open={noticeOpen} messageId={noticeId} message="Asset saved" severity="success"
  onClose={() => setNoticeOpen(false)} action={<ActionButton color="inherit">Undo</ActionButton>} />;
```

## File selection and upload dialog

`FileDropzone` uses a native file input and HTML drag/drop, composed with our
`ActionButton`, `Alert` and `SelectedFileList`. It supports controlled `files` or
`defaultFiles`, `onFilesChange(files, reason)` (`add`/`remove`), `onDrop(accepted,
rejected)` and `onReject(rejected)`. `accept` accepts a comma-separated string or
array of extensions/MIME patterns; `minSize`/`maxSize` are bytes and `maxFiles` caps
the total selection. Multiple selection defaults to true. Single-file selection
replaces the previous file only when a valid replacement is accepted.

Valid files from a batch are retained while invalid/excess files are reported with
per-file errors. Duplicates are identified by name, size, type and last-modified
metadata. Type matching is case-insensitive; extension rules work when a file's
reported MIME type is empty. A MIME-only rule needs a matching reported type.
The picker input resets after each selection so rejected files can be selected
again. Canceling the native picker never leaves the component busy.

```tsx
<FileDropzone label="Project files" accept={['image/*', '.png', '.jpg']}
  maxSize={5 * 1024 * 1024} maxFiles={8} files={files}
  onFilesChange={(next) => setFiles(next)} />;
```

`disabled`, `readOnly` and `busy` block adding/removing files; read-only mode omits
remove actions. `chooseLabel`, `helperText`, `showPreviews`, input/root refs and `sx`
customize presentation. `SelectedFileList` can also be used independently with
`files`, `onRemove(index)`, `disabled` and `showPreviews`. Image previews use local
object URLs, revoked on replacement/unmount; failures fall back to a file icon.
Other file types show metadata without loading external content.

`UploadDialog` composes our `ModalDialog`, `FileDropzone`, actions and error Alert.
It accepts controlled `open` and `onSubmit(files)` returning void or a promise. It
blocks duplicate submissions, mutation and dismissal while submitting (or externally
`busy`), retains files after failure and restores an enabled retry action. Customize
errors with `getErrorMessage`; observe `onSubmitSuccess`/`onSubmitError`. Completion
from an old closed dialog session cannot update a newly opened session.

```tsx
<UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)}
  dropzoneProps={{ accept: ['image/*', '.png'], maxFiles: 8 }}
  onSubmit={(selectedFiles) => uploadFilesInApplication(selectedFiles)}
  onSubmitSuccess={() => setUploadOpen(false)} />;
```

The caller decides when to close after success. Uncontrolled files reset after a
caller-driven close by default; use `resetOnClose={false}` to retain them. Controlled
file state remains caller-owned. `onFilesChange` supports controlled selection;
`dropzoneProps` supplies file policies/presentation. Cancel reports
`cancelButtonClick` through the shared dialog close callback. Submission does not
include storage clients, endpoint selection or network requests in this package.

All components include interaction tests and stories for disabled/read-only states,
long text, narrow layouts and dark mode. File stories use local fixture files only.


## Compact visual standards

The default theme uses a **4px spacing grid**, small controls, 13–14px body text,
and a compact heading scale. Panels, tabs, toolbars, navigation, accordions, icon
sidebars and timelines default to compact density. Typical surface padding is
8–12px, tab rows are 32px, icon buttons are 32px, and action buttons retain a
28px minimum height. File drop areas are 88px rather than large empty blocks.
Card content and dialogs use the same compact spacing rhythm.

Use `density="comfortable"` on components that expose it, explicit control sizes,
`sx`, or `createUiTheme({ spacing: 8 })` when a particular screen needs more room.
EmptyState supports `compact={false}`. Compact spacing does not change application
state, keyboard navigation, focus indicators, or controlled component contracts.

Storybook's **Foundations/Density** page compares compact and comfortable variants.
Every component group has dark-mode examples and layout checks; long-content and
interaction cases cover menus, scrolling surfaces, overlays and native controls.
Automatic API documentation is enabled for each group. Story layout markers include
the story ID so browser checks cannot accidentally accept a previous story's result.

The visual audit also tightened fallback-avatar and semantic-colour contrast,
selected navigation labels, disclosure typography, and responsive story fixtures.
The palette's contrast threshold is 4.5 for generated foreground colours.

The initial compact-spacing review covered the then-current 602 stories across
56 groups at 320px, 768px and 1280px
viewport widths. Story interaction/layout checks passed at each width; additional
DOM checks found no horizontal overflow, clipped visible text or low-contrast text
in the states measured. Representative light/dark surfaces and overlays were also
inspected visually. This is a review baseline, not a pixel-diff regression suite;
the contrast check excludes gradients, images, placeholders and disabled content.

Further coverage should include broader RTL/localization examples, system contrast
and reduced-motion settings, and larger compositions that combine these primitives
into workbench flows. These complement the existing component-level stories.

## Workbench primitives

The following components share the compact theme and reuse the package's buttons,
menus, panels, sliders, and empty states. They do not import application stores,
form libraries, API clients, or asset services.

| Component | Contract |
| --- | --- |
| `InspectorRow` | External label, description, error, mixed-value hint and optional reset action around a caller-owned control. |
| `FieldGroup` | Semantic fieldset/legend, shared label width, description and native descendant disabling. |
| `TreeView` | Hierarchical selection, expansion, disabled descendants, typeahead and optional caller-owned visibility controls. |
| `ContextMenu` | Pointer and keyboard context region using the existing `Menu` and item callbacks. |
| `AssetCard` / `AssetGrid` | Responsive thumbnail cards, selection, metadata, badges, open actions and custom action slots. |
| `ColorPicker` / `ColorSwatch` | Hex/RGB/alpha editing and named presets; static swatches or accessible selection buttons. |
| `Popover` | Controlled anchored dialog composed with `Panel`, with title, description, actions and close control. |
| `ProgressIndicator` | Labelled determinate/indeterminate progress with optional status and caller-owned cancellation. |
| `ImagePreview` | Contain/cover framing, transparency checkerboard, empty/error states and optional bounded zoom. |
| `Keycap` / `ShortcutHint` | Semantic key presentation and a single spoken shortcut label; does not register global shortcuts. |

`InspectorRow` accepts a render function to connect a control's `id`,
`aria-describedby`, `aria-invalid`, and `required` attributes. Native children can
instead use `controlId`; the caller then connects helper/error semantics explicitly.
MUI fields require accessibility attributes on their native input slot:

```tsx
<FieldGroup title="Appearance" labelWidth={120}>
  <InspectorRow label="Layer name" description="Used in exports" required>
    {control => <TextField id={control.id} required={control.required}
      error={control['aria-invalid']} fullWidth
      slotProps={{ htmlInput: { 'aria-describedby': control['aria-describedby'] } }} />}
  </InspectorRow>
</FieldGroup>
```

`TreeView` requires globally unique item IDs within a tree and a string label for
typeahead. `expandedIds` and `selectedIds` are controlled when supplied; otherwise
use `defaultExpandedIds` and `defaultSelectedIds`. Callbacks return the next arrays.
Arrow Up/Down and Home/End move focus; Right/Left expand, enter, collapse or return
to the parent (mirrored in RTL). Enter selects and activates; Space selects, or
toggles in multiple-selection mode. Ctrl/Command-click toggles multiple selection;
Ctrl/Command+A selects enabled visible nodes. Disabled branches disable descendants.
Optional `visible` values and `onVisibilityChange` add visibility buttons; Tab can
reach the focused row's button and Escape returns to its tree item. Visibility
remains caller-owned. The tree renders its supplied nodes without virtualization.

`ContextMenu` opens on right-click, the ContextMenu key, or Shift+F10. Give the
region an accessible name with `aria-label`. Selection, Escape, Tab and backdrop
dismissal reuse the existing menu contract and restore focus to the invoking
control or region. `menuProps` supports checkable items, headers, actions and
`closeOnClick={false}`. Preventing a supplied trigger event suppresses opening.

`AssetGrid` requires an accessible name and stable unique item IDs. Single selection
replaces the selected ID; multiple selection toggles cards without requiring a
modifier key. `selectedIds`/`defaultSelectedIds` and `onSelectionChange` follow the
same controlled contract as the tree. Tab reaches each enabled card; Left/Right
and Home/End also move focus, with RTL-aware horizontal arrows. Open and custom
actions remain separate from selection. Disabled cards disable native controls in
their action fieldset; custom link actions should also honor the caller's disabled
state. Provide descriptive `alt` text when the image adds information beyond the
title; otherwise thumbnails are decorative. The grid does not fetch or paginate.

`ColorPicker` accepts three-, four-, six- or eight-digit hex values. Valid edits
emit uppercase `#RRGGBBAA`, or `#RRGGBB` with `allowAlpha={false}`; RGB channels are
clamped to 0–255. Invalid hex drafts remain editable and show an error on blur
without emitting an invalid value. `disabled` prevents editing; `readOnly` keeps
text selectable while preventing changes. Labels and preset names are caller
configurable. Compose a clickable `ColorSwatch` with `Popover` for an anchored
editor; the `InPopover` story demonstrates this composition.

`Popover` uses the normal controlled `open`/`anchorEl` API and MUI focus management.
Supply a title or an accessible name. `onClose` reports `escapeKeyDown`,
`backdropClick`, or `closeButtonClick`; callers decide when to close. Paper slot
styles and accessibility attributes are preserved. Use `ModalDialog` for tasks
that need a larger blocking surface.

`ProgressIndicator.value` is a percentage clamped to 0–100. Omitting it (or passing
a non-finite value) produces indeterminate progress. `valueText` can describe units
instead of a percentage. `onCancel` only notifies the caller; it does not terminate
work or change status automatically. Progress animation respects reduced motion.

`ImagePreview` requires `alt`, including `alt=""` for decorative content. Source
changes reset image status and zoom. Zoom controls are disabled until loading
succeeds, use 50% increments, and default to a 400% limit. The enlarged viewport is
focusable for keyboard scrolling. No external image viewer, global keyboard
listener, or network service is included. Stories use local inline SVG fixtures.

Each new component has Storybook documentation, dark-mode examples and interaction
tests. Additional stories exercise narrow layouts, long content, controlled state,
disabled/read-only states, keyboard behavior, image errors, and overlay dismissal.
