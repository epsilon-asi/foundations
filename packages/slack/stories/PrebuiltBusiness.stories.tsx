import type { Meta, StoryObj } from '@storybook/react-vite';

import { message } from '../src';
import { renderNothing, slackPreview } from './support';

/**
 * Sales, customer support, recruiting, finance, and operations components
 * from `@epsilon-asi/slack`.
 */
const meta = {
  title: 'Package/Sales, Support & Finance',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const DealWon: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .deal({
          dealName: 'Enterprise renewal',
          account: 'Northwind Traders',
          amount: 125000,
          stage: 'Closed won',
          outcome: 'won',
          owner: 'Ana Silva',
          closeDate: 'Oct 30',
          note: 'Three-year term with an expansion to the EU team. 🎉',
          url: 'https://crm.example.com/deals/881'
        })
        .build()
    )
  }
};

export const DealUpdate: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .deal({
          dealName: 'Platform expansion',
          account: 'Fabrikam',
          amount: 48000,
          currency: 'EUR',
          stage: 'Negotiation',
          probability: 70,
          owner: 'Ben Ito',
          closeDate: 'Nov 21',
          nextStep: 'Security review call on Tuesday',
          url: 'https://crm.example.com/deals/902'
        })
        .build()
    )
  }
};

export const SupportTicket: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .ticket({
          ticketId: 'SUP-1042',
          subject: 'CSV export spins forever',
          requester: 'Lee at Contoso',
          priority: 'urgent',
          status: 'New',
          channel: 'Email',
          slaDueAt: 'in 1h 45m',
          description: 'Exporting more than 10k rows never finishes. Blocking their month-end reporting.',
          url: 'https://support.example.com/tickets/1042'
        })
        .build()
    )
  }
};

export const CustomerFeedback: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .feedback({
          customer: 'Contoso',
          plan: 'Enterprise',
          rating: 5,
          comment: 'The new dashboard saves our team hours every week. Love the saved searches!',
          source: 'In-app survey',
          submittedAt: 'Oct 30',
          url: 'https://example.com/feedback/5521'
        })
        .divider()
        .feedback({
          customer: 'Tailspin Toys',
          plan: 'Starter',
          rating: 2,
          comment: 'Setup was confusing and I could not find the import button.',
          source: 'Support CSAT'
        })
        .build()
    )
  }
};

export const HotLead: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .lead({
          name: 'Jamie Fox',
          company: 'Fabrikam',
          jobTitle: 'VP Operations',
          email: 'jamie@example.com',
          source: 'Pricing page · Demo request',
          score: 92,
          message: '“We are evaluating tools for 300 seats and want a demo next week.”',
          url: 'https://crm.example.com/leads/L-7',
          leadId: 'L-7'
        })
        .build()
    )
  }
};

export const CandidateUpdate: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .candidate({
          candidate: 'Jordan Park',
          role: 'Senior Backend Engineer',
          stage: 'Onsite complete',
          recommendation: 'strong_yes',
          feedbackSummary: 'Excellent system design and clear communication. Panel was unanimous.',
          nextStep: 'Reference checks',
          interviewAt: 'Oct 29',
          recruiter: 'Sky Morgan',
          hiringManager: 'Ana Silva',
          profileUrl: 'https://ats.example.com/candidates/318',
          scorecardUrl: 'https://ats.example.com/candidates/318/scorecard'
        })
        .build()
    )
  }
};

export const InvoiceOverdue: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .invoice({
          invoiceNumber: 'INV-2041',
          customer: 'Northwind Traders',
          amount: 4800,
          status: 'overdue',
          issuedAt: 'Oct 1',
          dueDate: 'Oct 15',
          url: 'https://billing.example.com/invoices/2041',
          payUrl: 'https://pay.example.com/2041'
        })
        .build()
    )
  }
};

export const InvoicePaid: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .invoice({ invoiceNumber: 'INV-2039', customer: 'Contoso', amount: 12950.5, status: 'paid', paidAt: 'Oct 29', url: 'https://billing.example.com/invoices/2039' })
        .build()
    )
  }
};

export const ExpenseApproval: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .expense({
          employee: 'Ana Silva',
          amount: 842.1,
          category: 'Travel',
          description: 'Round-trip flight for the Northwind onsite.',
          merchant: 'Sky Airlines',
          expenseDate: 'Oct 20',
          costCenter: 'Sales EMEA',
          receiptUrl: 'https://example.com/receipts/9',
          reportId: 'EXP-9'
        })
        .build()
    )
  }
};

export const TimeOffRequest: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .timeOff({
          employee: 'Ben Ito',
          type: 'Vacation',
          startDate: 'Nov 24',
          endDate: 'Nov 28',
          days: 5,
          balanceAfter: '9 days',
          coverage: 'Cy Park',
          requestId: 'PTO-311'
        })
        .build()
    )
  }
};

export const BudgetOver: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .budget({
          budgetName: 'Cloud infrastructure',
          spent: 12500,
          budget: 10000,
          period: 'October 2026',
          forecast: 14200,
          owner: 'Platform',
          url: 'https://finance.example.com/budgets/cloud'
        })
        .build()
    )
  }
};

export const BudgetWarning: Story = {
  parameters: {
    slackBlocks: slackPreview(message().budget({ budgetName: 'Marketing events', spent: 41000, budget: 50000, period: 'Q4' }).build())
  }
};

export const OrderShipped: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .order({
          orderId: '#100245',
          status: 'shipped',
          customer: 'Lee Wong',
          total: 149.97,
          carrier: 'UPS',
          trackingNumber: '1Z999AA10123456784',
          trackingUrl: 'https://track.example.com/1Z999AA10123456784',
          estimatedDelivery: 'Sun, Nov 2',
          url: 'https://shop.example.com/admin/orders/100245',
          items: [
            { name: 'Desk lamp', quantity: 2, price: 39.99 },
            { name: 'Linen notebook', quantity: 1, price: 24.99 },
            { name: 'Pen set', quantity: 1, price: 45.0 }
          ]
        })
        .build()
    )
  }
};

export const InventoryLow: Story = {
  parameters: {
    slackBlocks: slackPreview(
      message()
        .inventory({
          product: 'Ergonomic office chair',
          sku: 'CHR-ERG-01',
          onHand: 4,
          reorderPoint: 15,
          unit: 'units',
          location: 'Warehouse A · Aisle 12',
          supplier: 'Contoso Furniture',
          leadTime: '10 business days',
          reorderUrl: 'https://erp.example.com/purchase-orders/new?sku=CHR-ERG-01'
        })
        .build()
    )
  }
};

export const InventoryOutOfStock: Story = {
  parameters: {
    slackBlocks: slackPreview(message().inventory({ product: 'USB-C dock', sku: 'DOCK-C-02', onHand: 0, reorderPoint: 20 }).build())
  }
};
