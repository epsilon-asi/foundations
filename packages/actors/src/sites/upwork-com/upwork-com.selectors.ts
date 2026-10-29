export const upworkComSelectors = {
  login: {
    username: '#login_username',
    password: '#login_password',
    continueToPassword: '#login_password_continue',
    submit: '#login_control_continue',
    loggedInSignal: '[data-test="Avatar"]',
    errorMessage: '#login_error'
  }
} as const;
