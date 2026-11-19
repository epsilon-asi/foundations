import { SUCCESS_CODES } from '../responses/success.js';

/** HTTP method and success status for each resource CRUD operation. */
export const CRUD_OPERATIONS = Object.freeze({
  Create: Object.freeze({ method: 'post', code: SUCCESS_CODES.Created }),
  Get: Object.freeze({ method: 'get', code: SUCCESS_CODES.Ok }),
  Update: Object.freeze({ method: 'patch', code: SUCCESS_CODES.Ok }),
  Delete: Object.freeze({ method: 'delete', code: SUCCESS_CODES.Ok }),
  List: Object.freeze({ method: 'get', code: SUCCESS_CODES.Ok }),
});
