import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { FileTypeIcon, type FileType } from './FileTypeIcon';

const meta = { title: 'Components/FileTypeIcon', component: FileTypeIcon, play: checkStoryLayout, args: { fileName: 'reference.pdf', label: 'PDF document' } } satisfies Meta<typeof FileTypeIcon>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const AllTypes: Story = { render: () => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>{(['png','jpg','pdf','word','excel','powerpoint','csv','text','image','archive','audio','video','code','file'] as FileType[]).map(type =>
  <Box key={type} sx={{ display: 'grid', justifyItems: 'center', gap: 1, minWidth: 64 }}><FileTypeIcon type={type} label={`${type} file`} sx={{ fontSize: 32 }} /><Typography variant="caption">{type}</Typography></Box>)}</Box> };
export const MimeType: Story = { args: { fileName: 'download.bin', mimeType: 'image/webp', label: 'Image file' } };
export const ExplicitOverride: Story = { args: { fileName: 'download.bin', type: 'word', label: 'Word document' } };
export const Unknown: Story = { args: { fileName: 'unknown', label: 'Unknown file' } };
export const Decorative: Story = { render: () => <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><FileTypeIcon fileName="coast.png" /><Typography>coast.png</Typography></Box> };
export const Sizes: Story = { render: () => <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>{[16,24,32,48].map(size => <FileTypeIcon key={size} type="pdf" label={`${size}px PDF icon`} sx={{ fontSize: size }} />)}</Box> };
export const ThemeColor: Story = { args: { color: 'primary' } };
export const Dark: Story = { decorators: [withDarkUi], render: AllTypes.render };
