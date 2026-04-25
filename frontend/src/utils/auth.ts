/**
 * Returns an Authorization header object for the stored JWT token.
 * Call this in every fetch() call that hits the backend.
 */
export function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}
