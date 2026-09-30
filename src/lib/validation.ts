/** Basic format check — not a substitute for the server's authoritative
 * validation (Pydantic's EmailStr), just fast client-side feedback. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
