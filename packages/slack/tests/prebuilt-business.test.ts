import { describe, expect, it } from 'vitest';
import {
  accessRequest,
  budgetAlert,
  candidateUpdate,
  createMessage,
  customerFeedback,
  dealUpdate,
  expenseApproval,
  inventoryAlert,
  invoiceNotice,
  leadAlert,
  orderUpdate,
  resolveComponent,
  supportTicket,
  timeOffRequest
} from '../src';

type ActionsLike = { type: string; elements: Array<{ action_id?: string; value?: string; style?: string; url?: string; text?: { text: string } }> };

function actionsOf(blocks: Array<{ type: string }>): ActionsLike['elements'] {
  const block = blocks.find((candidate) => candidate.type === 'actions') as ActionsLike | undefined;
  return block?.elements ?? [];
}

function headerText(blocks: Array<{ type: string }>): string {
  return (blocks[0] as unknown as { text: { text: string } }).text.text;
}

describe('sales, support, and recruiting components', () => {
  it('renders deal updates for open, won, and lost outcomes', () => {
    const won = resolveComponent(dealUpdate({
      dealName: 'Enterprise renewal',
      account: 'Northwind',
      amount: 125_000,
      stage: 'Closed won',
      outcome: 'won',
      owner: 'Ana',
      closeDate: 'Oct 30',
      probability: 100,
      nextStep: 'Kickoff call',
      note: 'Three-year term.',
      url: 'https://example.com/crm/1',
      actions: [{ text: 'Celebrate', value: 'party' }]
    }));
    expect(headerText(won.blocks)).toBe('✅ Deal won: Enterprise renewal');
    expect(JSON.stringify(won.blocks)).toContain('$125,000.00');
    expect(actionsOf(won.blocks)[0]?.action_id).toBe('open_deal');

    expect(headerText(resolveComponent(dealUpdate({ dealName: 'D', account: 'A', amount: 1, stage: 'Lost', outcome: 'lost', currency: 'EUR' })).blocks)).toBe('🚨 Deal lost: D');
    const open = resolveComponent(dealUpdate({ dealName: 'D', account: 'A', amount: 1, stage: 'Discovery' }));
    expect(headerText(open.blocks)).toBe('ℹ️ Deal update: D');
    expect(open.blocks.some((block) => block.type === 'actions')).toBe(false);
  });

  it('renders support tickets with assignment actions', () => {
    const unassigned = resolveComponent(supportTicket({
      ticketId: 'SUP-1042',
      subject: 'Cannot export CSV',
      requester: 'Lee at Contoso',
      priority: 'urgent',
      channel: 'Email',
      slaDueAt: 'in 2h',
      description: 'Export button spins forever.',
      url: 'https://example.com/tickets/1042',
      actions: [{ text: 'Escalate', value: 'escalate' }]
    }));
    expect(headerText(unassigned.blocks)).toBe('🚨 SUP-1042: Cannot export CSV');
    expect(actionsOf(unassigned.blocks).map((button) => button.action_id)).toEqual(['sup_1042_assign', 'sup_1042_view', 'action_escalate']);
    expect(JSON.stringify(unassigned.blocks)).toContain('Unassigned');

    const assigned = resolveComponent(supportTicket({ ticketId: 'SUP-1', subject: 'Question', requester: 'Kim', assignee: 'Ben', status: 'Open' }));
    expect(headerText(assigned.blocks)).toBe('ℹ️ SUP-1: Question');
    expect(assigned.blocks.some((block) => block.type === 'actions')).toBe(false);
  });

  it('renders customer feedback with star ratings and tone', () => {
    const happy = resolveComponent(customerFeedback({
      customer: 'Contoso',
      comment: 'Love the new dashboard!\nHuge time saver.',
      rating: 5,
      plan: 'Enterprise',
      source: 'In-app survey',
      submittedAt: 'Oct 30',
      url: 'https://example.com/feedback/1',
      actions: [{ text: 'Share with team', value: 'share' }]
    }));
    expect(headerText(happy.blocks)).toBe('✅ New customer feedback');
    expect(JSON.stringify(happy.blocks)).toContain('★★★★★ 5/5');
    expect(actionsOf(happy.blocks).map((button) => button.action_id)).toEqual(['view_feedback', 'reply_feedback', 'action_share_with_team']);
    expect(happy.fallbackText).toContain('5/5');

    expect(headerText(resolveComponent(customerFeedback({ customer: 'A', comment: 'Meh', rating: 3 })).blocks)).toBe('• New customer feedback');
    const unhappy = resolveComponent(customerFeedback({ customer: 'B', comment: 'Broken', rating: 1, maxRating: 10 }));
    expect(headerText(unhappy.blocks)).toBe('⚠️ New customer feedback');
    expect(JSON.stringify(unhappy.blocks)).toContain('1/10');
    const unrated = resolveComponent(customerFeedback({ customer: 'C', comment: 'Note' }));
    expect(headerText(unrated.blocks)).toBe('ℹ️ New customer feedback');
    expect(unrated.blocks.some((block) => block.type === 'context')).toBe(false);
  });

  it('renders lead alerts for hot, claimed, and unclaimed leads', () => {
    const hot = resolveComponent(leadAlert({
      name: 'Jamie Fox',
      company: 'Fabrikam',
      jobTitle: 'VP Ops',
      email: 'jamie@example.com',
      source: 'Pricing page',
      score: 92,
      message: 'Wants a demo next week.',
      url: 'https://example.com/crm/lead/7',
      leadId: 'L-7',
      actions: [{ text: 'Book demo', url: 'https://example.com/book' }]
    }));
    expect(headerText(hot.blocks)).toBe('✅ Hot lead: Jamie Fox (Fabrikam)');
    expect(JSON.stringify(hot.blocks)).toContain('92 🔥');
    expect(actionsOf(hot.blocks)[0]).toMatchObject({ action_id: 'claim_lead', value: 'L-7' });

    const claimed = resolveComponent(leadAlert({ name: 'Pat', owner: 'Ana', score: 40 }));
    expect(headerText(claimed.blocks)).toBe('ℹ️ New lead: Pat');
    expect(claimed.blocks.some((block) => block.type === 'actions')).toBe(false);
    expect(actionsOf(resolveComponent(leadAlert({ name: 'Ray', email: 'ray@example.com' })).blocks)[0]?.value).toBe('ray@example.com');
    expect(actionsOf(resolveComponent(leadAlert({ name: 'Quinn' })).blocks)[0]?.value).toBe('Quinn');
  });

  it('renders candidate updates with recommendation and links', () => {
    const rendered = resolveComponent(candidateUpdate({
      candidate: 'Jordan Park',
      role: 'Senior Backend Engineer',
      stage: 'Onsite complete',
      recommendation: 'strong_yes',
      feedbackSummary: 'Excellent system design.',
      nextStep: 'Reference checks',
      interviewAt: 'Oct 29',
      recruiter: 'Sky',
      hiringManager: 'Ana',
      profileUrl: 'https://example.com/ats/1',
      scorecardUrl: 'https://example.com/ats/1/scorecard',
      actions: [{ text: 'Move to offer', value: 'offer' }]
    }));
    expect(JSON.stringify(rendered.blocks)).toContain('💚 Strong yes');
    expect(actionsOf(rendered.blocks).map((button) => button.action_id)).toEqual(['view_candidate', 'submit_scorecard', 'action_move_to_offer']);
    expect(resolveComponent(candidateUpdate({ candidate: 'A', role: 'B', stage: 'Applied' })).blocks).toHaveLength(2);
  });
});

describe('finance and operations components', () => {
  it('renders invoices for each status with pay and reminder actions', () => {
    const overdue = resolveComponent(invoiceNotice({
      invoiceNumber: 'INV-2041',
      customer: 'Northwind',
      amount: 4_800,
      status: 'overdue',
      issuedAt: 'Oct 1',
      dueDate: 'Oct 15',
      url: 'https://example.com/inv/2041',
      payUrl: 'https://example.com/pay/2041',
      actions: [{ text: 'Call customer', value: 'call' }]
    }));
    expect(headerText(overdue.blocks)).toBe('🚨 Invoice INV-2041 · Overdue');
    expect(actionsOf(overdue.blocks).map((button) => button.action_id)).toEqual(['inv_2041_pay', 'inv_2041_view', 'inv_2041_remind', 'action_call_customer']);

    const paid = resolveComponent(invoiceNotice({ invoiceNumber: 'INV-1', customer: 'A', amount: 10, status: 'paid', paidAt: 'Oct 2', payUrl: 'https://example.com/pay' }));
    expect(headerText(paid.blocks)).toBe('✅ Invoice INV-1 · Paid');
    expect(paid.blocks.some((block) => block.type === 'actions')).toBe(false);

    for (const status of ['draft', 'sent', 'void'] as const) {
      expect(resolveComponent(invoiceNotice({ invoiceNumber: 'I', customer: 'C', amount: 1, status })).blocks.length).toBeGreaterThan(1);
    }
    expect(actionsOf(resolveComponent(invoiceNotice({ invoiceNumber: 'S', customer: 'C', amount: 1, status: 'sent', payUrl: 'https://example.com/p' })).blocks)[0]?.action_id).toBe('s_pay');
  });

  it('renders expense, time-off, and access approvals with approve/reject buttons', () => {
    const expense = resolveComponent(expenseApproval({
      employee: 'Ana',
      amount: 842.1,
      category: 'Travel',
      description: 'Flight to customer onsite.',
      merchant: 'Airline',
      expenseDate: 'Oct 20',
      costCenter: 'Sales',
      receiptUrl: 'https://example.com/receipt.pdf',
      reportId: 'EXP-9'
    }));
    expect(actionsOf(expense.blocks).map((button) => [button.action_id, button.value])).toEqual([
      ['approve_expense', 'EXP-9'],
      ['reject_expense', 'EXP-9']
    ]);
    expect(JSON.stringify(expense.blocks)).toContain('$842.10');
    expect(resolveComponent(expenseApproval({ employee: 'B', amount: 5, category: 'Meals', description: 'Lunch' })).blocks.length).toBeGreaterThan(2);

    const timeOff = resolveComponent(timeOffRequest({
      employee: 'Ben',
      type: 'Vacation',
      startDate: 'Nov 3',
      endDate: 'Nov 7',
      days: 5,
      balanceAfter: '9 days',
      coverage: 'Cy',
      requestId: 'PTO-3'
    }));
    expect(JSON.stringify(timeOff.blocks)).toContain('Ben requested vacation from Nov 3 to Nov 7.');
    expect(actionsOf(timeOff.blocks)[0]?.action_id).toBe('approve_time_off');
    expect(JSON.stringify(resolveComponent(timeOffRequest({ employee: 'Di', type: 'Sick', startDate: 'a', endDate: 'b', note: 'Flu' })).blocks)).toContain('Flu');

    const access = resolveComponent(accessRequest({
      requester: 'Cy',
      resource: 'prod-db',
      accessLevel: 'read-only',
      justification: 'Debug billing issue',
      duration: '4 hours',
      ticketId: 'SEC-12',
      requestId: 'AR-1'
    }));
    expect(actionsOf(access.blocks).map((button) => button.action_id)).toEqual(['approve_access', 'reject_access']);
    expect(resolveComponent(accessRequest({ requester: 'D', resource: 'r', accessLevel: 'admin', justification: 'j' })).blocks.length).toBeGreaterThan(2);
  });

  it('renders budget alerts for on-track, warning, over-budget, and zero budgets', () => {
    const over = resolveComponent(budgetAlert({
      budgetName: 'Cloud spend',
      spent: 12_500,
      budget: 10_000,
      period: 'October',
      forecast: 14_000,
      owner: 'Platform',
      url: 'https://example.com/spend',
      actions: [{ text: 'Adjust budget', value: 'adjust' }]
    }));
    expect(headerText(over.blocks)).toBe('🚨 Cloud spend is over budget');
    expect(JSON.stringify(over.blocks)).toContain('Over by');
    expect(actionsOf(over.blocks)[0]?.action_id).toBe('view_budget');

    expect(headerText(resolveComponent(budgetAlert({ budgetName: 'Ads', spent: 85, budget: 100 })).blocks)).toBe('⚠️ Ads at 85% of budget');
    expect(headerText(resolveComponent(budgetAlert({ budgetName: 'Travel', spent: 50, budget: 100, warningThreshold: 40 })).blocks)).toBe('⚠️ Travel at 50% of budget');
    const healthy = resolveComponent(budgetAlert({ budgetName: 'Snacks', spent: 10, budget: 100, currency: 'GBP' }));
    expect(headerText(healthy.blocks)).toBe('✅ Snacks is on track');
    expect(JSON.stringify(healthy.blocks)).toContain('Remaining');
    expect(headerText(resolveComponent(budgetAlert({ budgetName: 'Empty', spent: 0, budget: 0 })).blocks)).toBe('🚨 Empty is over budget');
  });

  it('renders order updates with tracking, items, and limits', () => {
    const rendered = resolveComponent(orderUpdate({
      orderId: '#100245',
      status: 'shipped',
      customer: 'Lee',
      total: 149.97,
      carrier: 'UPS',
      trackingNumber: '1Z999',
      trackingUrl: 'https://example.com/track/1Z999',
      estimatedDelivery: 'Nov 2',
      url: 'https://example.com/orders/100245',
      maxItems: 2,
      items: [
        { name: 'Desk lamp', quantity: 2, price: 39.99 },
        { name: 'Notebook' },
        { name: 'Pen set', quantity: 3 }
      ],
      actions: [{ text: 'Contact customer', value: 'contact' }]
    }));
    const text = JSON.stringify(rendered.blocks);
    expect(text).toContain('🚚 Shipped');
    expect(text).toContain('<https://example.com/track/1Z999|1Z999>');
    expect(text).toContain('2 × Desk lamp — $39.99');
    expect(text).toContain('1 × Notebook');
    expect(text).toContain('_+1 more_');
    expect(rendered.fallbackText).toBe('Order #100245: 🚚 Shipped • ETA Nov 2');

    const minimal = resolveComponent(orderUpdate({ orderId: '1', status: 'delivered', trackingNumber: 'T1' }));
    expect(minimal.blocks.some((block) => block.type === 'actions')).toBe(false);
    expect(JSON.stringify(minimal.blocks)).toContain('T1');
    expect(resolveComponent(orderUpdate({ orderId: '2', status: 'cancelled' })).blocks).toHaveLength(2);
  });

  it('renders inventory alerts for out-of-stock, low, and healthy stock', () => {
    const out = resolveComponent(inventoryAlert({
      product: 'Ergonomic chair',
      onHand: 0,
      reorderPoint: 10,
      sku: 'CHR-01',
      location: 'Warehouse A',
      unit: 'units',
      supplier: 'Contoso Furniture',
      leadTime: '2 weeks',
      reorderUrl: 'https://example.com/po/new',
      actions: [{ text: 'Notify sales', value: 'notify' }]
    }));
    expect(headerText(out.blocks)).toBe('🚨 Out of stock: Ergonomic chair');
    expect(actionsOf(out.blocks)[0]).toMatchObject({ action_id: 'reorder_stock', url: 'https://example.com/po/new' });

    const low = resolveComponent(inventoryAlert({ product: 'Monitor', onHand: 4, reorderPoint: 5, sku: 'MON-2' }));
    expect(headerText(low.blocks)).toBe('⚠️ Low stock: Monitor');
    expect(actionsOf(low.blocks)[0]?.value).toBe('MON-2');
    expect(actionsOf(resolveComponent(inventoryAlert({ product: 'Cable', onHand: 1, reorderPoint: 5 })).blocks)[0]?.value).toBe('Cable');

    const healthy = resolveComponent(inventoryAlert({ product: 'Mouse', onHand: 50, reorderPoint: 5 }));
    expect(headerText(healthy.blocks)).toBe('✅ Stock healthy: Mouse');
    expect(healthy.blocks.some((block) => block.type === 'actions')).toBe(false);
    expect(createMessage([inventoryAlert({ product: 'Valid', onHand: 1, reorderPoint: 2 })]).blocks.length).toBeGreaterThan(1);
  });
});
