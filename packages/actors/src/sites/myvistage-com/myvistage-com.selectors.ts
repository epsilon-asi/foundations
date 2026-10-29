export const myvistageComSelectors = {
  login: {
    username: '[name="username"]',
    password: '[name="password"]',
    submit: '#form-login button[type="submit"]',
    loggedInSignal: 'a[href*="logout"], a[href*="signout"]',
    errorMessage: '#mv3login [role="alert"], #mv3login .error, #mv3login .woocommerce-error'
  },
  postComment: {
    comment: 'textarea[name="comment"]',
    subject: 'input[name="subject"]',
    submit: 'div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > button:nth-of-type(2)'
  }
} as const;
