import type { Decorator } from '@storybook/react-vite';
import { Box } from '../src/components/Box';
export const narrowConversation: Decorator = (Story) => (
  <Box sx={{ width: 320, maxWidth: '100%' }}>
    <Story />
  </Box>
);
export const longLabel =
  'Research notes for the next revision of the shared workspace and its supporting documents';
export const sampleMessages = Array.from({ length: 3000 }, (_, i) => ({
  id: String(i),
  text: i % 7 === 0 ? 'A longer entry with additional context. '.repeat(8) : 'Entry ' + (i + 1)
}));
export const getMessageKey = (item: { id: string }) => item.id;
export const tableRows = [
  { id: 'Draft', count: 3 },
  { id: 'Review', count: 8 }
];
export const commands = [
  { id: 'open', title: 'Open document', group: 'Workspace', keywords: ['file'], shortcut: 'Ctrl+O' },
  { id: 'save', title: 'Save changes', group: 'Workspace' },
  { id: 'archive', title: 'Archive', group: 'Document', disabled: true }
];
export const questions = [
  {
    id: 'format',
    question: 'Choose a format',
    options: [{ label: 'Text', description: 'Plain document' }, { label: 'Table' }],
    allowOther: true
  },
  {
    id: 'sections',
    question: 'Include sections',
    options: [{ label: 'Overview' }, { label: 'Details' }],
    multiSelect: true
  }
];
export const choices = [
  { id: 'save', label: 'Save', kind: 'primary' as const },
  { id: 'revise', label: 'Request changes', collectReason: { label: 'Reason', required: true } }
];
