import { previewImage } from './workbenchExamples';

export const editedPreviewImage = previewImage.replace('dceafa', 'f8dfd0').replace('496e83', '815e79').replace('315566', '543e62').replace('86a8ba', 'b48c9b');
export const reorderItems = [{ id: 'sky', label: 'Sky.png' }, { id: 'reference', label: 'Reference.pdf', locked: true }, { id: 'mountains', label: 'Mountains.svg' }, { id: 'water', label: 'Water.png' }];
export type ReorderItem = typeof reorderItems[number];
export const getReorderId = (item: ReorderItem) => item.id;
export const getReorderLabel = (item: ReorderItem) => item.label;
export const isReorderLocked = (item: ReorderItem) => !!item.locked;
export interface VirtualRow { id: string; label: string }
export const virtualRows: VirtualRow[] = Array.from({ length: 10000 }, (_, index) => ({ id: String(index), label: `Asset ${index + 1}.png` }));
export const getVirtualKey = (item: VirtualRow) => item.id;
export const sampleJson = { name: 'Coastal study', revision: 3, approved: false, seed: 0, notes: null,
  output: { width: 1024, height: 768, format: 'png', layers: [{ name: 'Sky', visible: true }, { name: 'Mountains', visible: true }] },
  tags: ['environment', 'reference', 'coast'] };
// Deterministic clipboard demonstrations; stories do not require clipboard permission.
export const simulateCopy = async (_value: string) => {};
export const rejectCopy = async (_value: string) => { throw new Error('Clipboard permission denied'); };
