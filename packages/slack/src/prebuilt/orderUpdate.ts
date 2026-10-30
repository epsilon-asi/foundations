import { actions, fieldSections, header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { SlackBlock } from '../types/slack';
import { compactJoin, slackLink } from '../utils/text';
import { bulletList, formatMoney, toButtons, toFields, type ActionDefinition, type FieldDefinition } from './shared';

export type OrderStatus =
  | 'placed'
  | 'paid'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'returned';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: '🧾 Placed',
  paid: '💳 Paid',
  packed: '📦 Packed',
  shipped: '🚚 Shipped',
  out_for_delivery: '🛵 Out for delivery',
  delivered: '✅ Delivered',
  cancelled: '🚫 Cancelled',
  refunded: '↩️ Refunded',
  returned: '🔁 Returned'
};

export interface OrderItem {
  name: string;
  quantity?: number;
  price?: number;
}

export interface OrderUpdateOptions {
  orderId: string;
  status: OrderStatus;
  customer?: string;
  items?: OrderItem[];
  total?: number;
  currency?: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  url?: string;
  maxItems?: number;
  actions?: ActionDefinition[];
}

function renderOrderUpdate(options: OrderUpdateOptions): RenderedComponent {
  const blocks: SlackBlock[] = [header(`📦 Order ${options.orderId}`), section(`*Status:* ${ORDER_STATUS_LABELS[options.status]}`)];

  const fields: FieldDefinition[] = [];
  if (options.customer) fields.push({ label: 'Customer', value: options.customer });
  if (options.total !== undefined) fields.push({ label: 'Total', value: formatMoney(options.total, options.currency) });
  if (options.carrier) fields.push({ label: 'Carrier', value: options.carrier });
  if (options.trackingNumber) {
    fields.push({
      label: 'Tracking',
      value: options.trackingUrl ? slackLink(options.trackingUrl, options.trackingNumber) : options.trackingNumber
    });
  }
  if (options.estimatedDelivery) fields.push({ label: 'Estimated delivery', value: options.estimatedDelivery });
  if (fields.length) {
    blocks.push(...fieldSections(toFields(fields)));
  }

  if (options.items?.length) {
    const items = options.items.slice(0, options.maxItems ?? 10);
    const lines = items.map(
      (item) => `${item.quantity ?? 1} × ${item.name}${item.price !== undefined ? ` — ${formatMoney(item.price, options.currency)}` : ''}`
    );
    const omitted = options.items.length - items.length;
    blocks.push(section(`*Items*\n${bulletList(lines)}${omitted > 0 ? `\n_+${omitted} more_` : ''}`));
  }

  const buttons: ActionDefinition[] = [];
  if (options.trackingUrl) buttons.push({ text: 'Track package', url: options.trackingUrl, style: 'primary', actionId: 'track_order' });
  if (options.url) buttons.push({ text: 'View order', url: options.url, actionId: 'view_order' });
  buttons.push(...(options.actions ?? []));
  if (buttons.length) {
    blocks.push(actions(toButtons(buttons)));
  }

  return {
    blocks,
    fallbackText: compactJoin([`Order ${options.orderId}: ${ORDER_STATUS_LABELS[options.status]}`, options.estimatedDelivery ? `ETA ${options.estimatedDelivery}` : ''])
  };
}

export const orderUpdate = defineComponent<OrderUpdateOptions>('prebuilt.orderUpdate', renderOrderUpdate);
