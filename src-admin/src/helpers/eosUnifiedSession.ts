/**
 * Shared EOS browser session. The browser never reads or stores an OAuth token.
 * The server verifies the current HttpOnly cookie and the per-session CSRF value.
 */
export async function logoutUnifiedSession(fetcher: typeof fetch = fetch): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const status = await fetcher('/api/auth/status', {
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            signal: controller.signal,
            headers: { Accept: 'application/json' },
        });
        if (status.status === 401) {
            return;
        }
        if (!status.ok) {
            throw new Error('SESSION_STATUS_UNAVAILABLE');
        }
        const session: unknown = await status.json();
        if (!session || typeof session !== 'object' || Array.isArray(session)) {
            throw new Error('SESSION_STATUS_INVALID');
        }
        if ('authenticated' in session && session.authenticated === false) {
            return;
        }
        if (
            !('csrfToken' in session) ||
            typeof session.csrfToken !== 'string' ||
            !/^[A-Za-z0-9_-]{16,256}$/.test(session.csrfToken)
        ) {
            throw new Error('SESSION_CSRF_INVALID');
        }
        const result = await fetcher('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            signal: controller.signal,
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-NW-CSRF': session.csrfToken },
            body: '{}',
        });
        if (!result.ok && result.status !== 401) {
            throw new Error('SESSION_LOGOUT_UNCONFIRMED');
        }
    } finally {
        clearTimeout(timeout);
    }
}
