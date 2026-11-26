export function startSupervisorNotifications(
    owner: ioBroker.Adapter,
    host: unknown,
    runtimeStatus: () => unknown,
    controls: unknown,
): { close(): void };
