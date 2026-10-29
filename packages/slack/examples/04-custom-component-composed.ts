import { defineComponent, message, prebuilt } from '../src';

const sloBreach = defineComponent<{
  service: string;
  sloName: string;
  current: string;
  target: string;
  dashboardUrl: string;
}>('slo.breach', (props) =>
  prebuilt.card({
    title: `${props.service} SLO breach`,
    body: `${props.sloName} is below target.`,
    severity: 'danger',
    fields: [
      { label: 'Current', value: props.current },
      { label: 'Target', value: props.target }
    ],
    actions: [{ text: 'Open SLO dashboard', url: props.dashboardUrl }]
  })
);

const releaseChecklist = defineComponent<{
  version: string;
  passed: number;
  failed: number;
}>('release.checklist', (props, { blocks }) => ({
  blocks: [
    blocks.header(`🧪 Release ${props.version} checks`),
    blocks.section({
      fields: [
        { label: 'Passed', value: props.passed },
        { label: 'Failed', value: props.failed }
      ]
    })
  ],
  fallbackText: `Release ${props.version}: ${props.passed} passed, ${props.failed} failed`
}));

export const payload = message()
  .add(sloBreach({
    service: 'payments-api',
    sloName: '99.9% successful authorization rate',
    current: '99.74%',
    target: '99.90%',
    dashboardUrl: 'https://slo.example.com/payments-api'
  }))
  .divider()
  .add(releaseChecklist({ version: '2.7.0', passed: 184, failed: 1 }))
  .build();
