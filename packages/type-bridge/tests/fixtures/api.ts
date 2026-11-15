/**
 * A realistic API surface exercising most TypeScript type features.
 */

/** Lifecycle of an order. */
export enum OrderStatus {
  Pending = 'pending',
  Paid = 'paid',
  Shipped = 'shipped',
  /** @deprecated use Shipped */
  Sent = 'sent',
}

export enum Priority {
  Low,
  Medium,
  High = 10,
  Urgent,
}

export const enum Permission {
  Read = 1 << 0,
  Write = 1 << 1,
  ReadWrite = Read | Write,
}

export type UserId = string & { readonly __brand: 'UserId' };
export type Cents = number;
export type Currency = 'USD' | 'EUR' | 'GBP';
export type Timestamp = `${number}-${number}-${number}`;

export interface Money {
  readonly amount: Cents;
  currency: Currency;
}

/** Someone who can place orders. */
export interface User {
  id: UserId;
  /** Display name. */
  name: string;
  email?: string;
  nickname: string | null;
  roles: readonly ('admin' | 'member')[];
  createdAt: Date;
  preferences: Record<string, boolean>;
  address?: {
    line1: string;
    line2?: string;
    country: string;
  };
}

export interface Admin extends User {
  permissions: Permission[];
}

export interface LineItem {
  sku: string;
  quantity: number;
  unitPrice: Money;
  discount?: Money | null;
}

export interface Order {
  id: string;
  status: OrderStatus;
  priority: Priority;
  customer: User;
  items: LineItem[];
  total: Money;
  notes: string[] | undefined;
  tags: Set<string>;
  history: [status: OrderStatus, at: Date][];
  metadata: { [key: string]: string };
  parent?: Order;
}

export type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rect'; width: number; height: number };

export interface Page<T> {
  items: T[];
  total: number;
  next: Page<T> | null;
}

export type OrderPage = Page<Order>;
export type OrderPatch = Partial<Pick<Order, 'status' | 'notes'>>;
export type PublicUser = Omit<User, 'email' | 'preferences'>;
export type OrderKey = keyof Money;
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface Repository<T, K extends string | number = string> {
  get(id: K): Promise<T | undefined>;
  list(filter?: Partial<T>, limit?: number): Promise<T[]>;
  save(item: T): Promise<void>;
  readonly size: number;
}

export type Handler = (event: string, payload?: unknown) => void;
export type Mapper<A, B> = (value: A) => B;

export class Invoice {
  static readonly prefix = 'INV';
  readonly id: string;
  lines: LineItem[] = [];
  paid = false;
  private secret = '';

  constructor(id: string, public readonly issuedTo: User) {
    this.id = id;
  }
}

export namespace Events {
  export interface Created {
    type: 'created';
    order: Order;
  }
  export interface Cancelled {
    type: 'cancelled';
    reason: string;
  }
}

export type OrderEvent = Events.Created | Events.Cancelled;
