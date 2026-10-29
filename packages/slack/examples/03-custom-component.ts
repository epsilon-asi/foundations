import { defineComponent, message } from '../src';

const customerHealth = defineComponent<{
  customer: string;
  plan: string;
  score: number;
  owner: string;
}>('customer.health', (props, { blocks }) => ({
  blocks: [
    blocks.header(`🏥 ${props.customer} health`),
    blocks.section({
      fields: [
        { label: 'Plan', value: props.plan },
        { label: 'Score', value: props.score },
        { label: 'Owner', value: props.owner }
      ]
    })
  ],
  fallbackText: `${props.customer} health score: ${props.score}`
}));

export const payload = message()
  .add(customerHealth({ customer: 'Acme Co', plan: 'Enterprise', score: 92, owner: 'CSM Team' }))
  .build();
