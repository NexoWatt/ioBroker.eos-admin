/**
 * The currently connected EOS instance is already reachable through this browser origin.
 * Its root entry must not be rebuilt from an old saved port, bind address or proxy upstream.
 * Other instances and links to documentation or subpages retain their configured targets.
 */
export function currentEosEntryLink(
    linkPattern: string,
    adapter: string,
    instance: number,
    currentInstance: string,
    pageUrl: string,
): string | null {
    if (
        adapter !== 'eos-admin' ||
        !Number.isSafeInteger(instance) ||
        instance < 0 ||
        currentInstance !== `eos-admin.${instance}` ||
        !/^%protocol%:\/\/%(?:bind|ip)%:%port%\/?$/.test(linkPattern)
    ) {
        return null;
    }
    try {
        const page = new URL(pageUrl);
        if (page.protocol !== 'https:' || page.username || page.password || !page.hostname) {
            return null;
        }
        return `${page.origin}/`;
    } catch {
        return null;
    }
}
