import { expect, waitFor } from 'storybook/test';
import { checkStoryLayout } from './layoutAssertions';
import type { TreeItemDefinition } from '../src/components/TreeView';

export const previewImage = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"><rect width="640" height="480" fill="#dceafa"/><circle cx="480" cy="100" r="45" fill="#f6c66d"/><path d="M0 380 170 110 360 380Z" fill="#496e83"/><path d="M200 480 460 170 640 400V480Z" fill="#315566"/><path d="M0 390Q170 340 340 420T640 400V480H0Z" fill="#86a8ba"/></svg>')}`;
export const transparentImage = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480"><circle cx="240" cy="240" r="150" fill="#325dff" fill-opacity=".65"/><rect x="210" y="160" width="160" height="160" rx="25" fill="#ed6c02" fill-opacity=".75"/></svg>')}`;
export const brokenImage = 'data:image/png;base64,broken';
export const treeItems: TreeItemDefinition[] = [
  { id: 'document', label: 'Coastal study', icon: '▧', children: [
    { id: 'foreground', label: 'Foreground', children: [{ id: 'shapes', label: 'Shapes', description: '3 vector objects' }, { id: 'texture', label: 'Texture', disabled: true }] },
    { id: 'background', label: 'Background', children: [{ id: 'sky', label: 'Sky' }, { id: 'mountains', label: 'Mountains' }] }
  ] }, { id: 'references', label: 'References', icon: '▧', disabled: true }
];
export const presets = [{ value: '#325DFF', label: 'Blue' }, { value: '#7C4DFF', label: 'Purple' }, { value: '#ED6C02', label: 'Orange' },
  { value: '#0F9D58', label: 'Green' }, { value: '#FFFFFF', label: 'White' }, { value: '#00000000', label: 'Transparent' }];
export async function checkImageLayout({ canvasElement }: { canvasElement: HTMLElement }) {
  await waitFor(() => { for (const image of canvasElement.querySelectorAll('img')) expect(image.complete).toBe(true); });
  await checkStoryLayout({ canvasElement });
}
