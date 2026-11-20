import { FilterOperator } from '../query/filterOperators.js';
import { AUTHENTICATION_ERRORS, type AuthenticationFailureResponse } from '../responses/authenticationFailure.js';
import { domainErrorMessageKey } from './domainErrorMessageKey.js';
import { filterOperatorMessageKey } from './filterOperatorMessageKey.js';

type FrameworkMessageKey = ReturnType<typeof filterOperatorMessageKey>
  | ReturnType<typeof domainErrorMessageKey<AuthenticationFailureResponse['error']>>;

/** Default English translations for the framework's message keys. */
export const FRAMEWORK_ENGLISH_MESSAGES = Object.freeze<Record<FrameworkMessageKey, string>>({
  [filterOperatorMessageKey(FilterOperator.Eq)]: 'Equals',
  [filterOperatorMessageKey(FilterOperator.Ne)]: 'Does not equal',
  [filterOperatorMessageKey(FilterOperator.In)]: 'Is one of',
  [filterOperatorMessageKey(FilterOperator.Nin)]: 'Is not one of',
  [filterOperatorMessageKey(FilterOperator.Like)]: 'Matches pattern (case-sensitive)',
  [filterOperatorMessageKey(FilterOperator.ILike)]: 'Matches pattern (case-insensitive)',
  [filterOperatorMessageKey(FilterOperator.Gt)]: 'Greater than',
  [filterOperatorMessageKey(FilterOperator.Gte)]: 'Greater than or equal to',
  [filterOperatorMessageKey(FilterOperator.Lt)]: 'Less than',
  [filterOperatorMessageKey(FilterOperator.Lte)]: 'Less than or equal to',
  [filterOperatorMessageKey(FilterOperator.Contains)]: 'Contains all of',
  [filterOperatorMessageKey(FilterOperator.Overlap)]: 'Contains any of',
  [filterOperatorMessageKey(FilterOperator.Exists)]: 'Has a value',
  [domainErrorMessageKey(AUTHENTICATION_ERRORS.Unauthenticated)]: 'Sign in to continue.',
  [domainErrorMessageKey(AUTHENTICATION_ERRORS.TokenExpired)]: 'Your access token has expired.',
});
