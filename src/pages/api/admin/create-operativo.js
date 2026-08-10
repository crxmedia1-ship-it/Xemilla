/**
 * Compat proxy → canonical `/api/create-admin-user`.
 * Prefer the new path from Hub UI; this keeps old callers working.
 */
export { prerender, POST } from '../create-admin-user.js';
