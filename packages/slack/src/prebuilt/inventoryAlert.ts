import type { Severity } from '../types/slack';
import { card } from './card';
import type { ActionDefinition, FieldDefinition } from './shared';

export interface InventoryAlertOptions {
  product: string;
  onHand: number;
  reorderPoint: number;
  sku?: string;
  location?: string;
  unit?: string;
  supplier?: string;
  leadTime?: string;
  reorderUrl?: string;
  actions?: ActionDefinition[];
}

export function inventoryAlert(options: InventoryAlertOptions) {
  const severity: Severity = options.onHand <= 0 ? 'danger' : options.onHand <= options.reorderPoint ? 'warning' : 'success';
  const label = severity === 'danger' ? 'Out of stock' : severity === 'warning' ? 'Low stock' : 'Stock healthy';
  const unit = options.unit ? ` ${options.unit}` : '';

  const fields: FieldDefinition[] = [
    { label: 'On hand', value: `${options.onHand}${unit}` },
    { label: 'Reorder point', value: `${options.reorderPoint}${unit}` }
  ];
  if (options.sku) fields.push({ label: 'SKU', value: `\`${options.sku}\`` });
  if (options.location) fields.push({ label: 'Location', value: options.location });
  if (options.supplier) fields.push({ label: 'Supplier', value: options.supplier });
  if (options.leadTime) fields.push({ label: 'Lead time', value: options.leadTime });

  const actions: ActionDefinition[] = [];
  if (severity !== 'success') {
    actions.push(
      options.reorderUrl
        ? { text: 'Reorder', url: options.reorderUrl, style: 'primary', actionId: 'reorder_stock' }
        : { text: 'Reorder', style: 'primary', actionId: 'reorder_stock', value: options.sku ?? options.product }
    );
  }
  actions.push(...(options.actions ?? []));

  return card({
    title: `${label}: ${options.product}`,
    severity,
    fields,
    actions
  });
}
