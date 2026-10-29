export const exampleSelectors = {
  login: {
    username: '#email',
    password: '#password',
    submit: 'button[type="submit"]',
    loggedInSignal: '[data-testid="account-menu"]',
    errorMessage: '[data-testid="login-error"]'
  },
  dashboardRows: '[data-testid="dashboard-row"]',
  contactForm: {
    name: '#name',
    email: '#email',
    company: '#company',
    message: '#message',
    submit: 'button[type="submit"]'
  }
} as const;
