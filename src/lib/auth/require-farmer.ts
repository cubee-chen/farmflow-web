import 'server-only';
// Re-export new Supabase Auth-based implementation.
// All existing importers of this module get the new behaviour automatically.
export { getCurrentFarmer, getCurrentFarmerOrNull, AuthError } from './get-current-farmer';
