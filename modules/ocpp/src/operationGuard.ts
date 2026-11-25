/** Per-client OCPP dispatch guards; no global prototype or require hooks. MIT. */
type Call = (...args: unknown[]) => unknown;
export interface RpcClient {
    call: Call;
    handle: Call;
}
export function guardRpcClient(client: RpcClient, assert: () => void): void {
    const call = client.call.bind(client);
    const handle = client.handle.bind(client);
    client.call = async (...args: unknown[]) => {
        assert();
        const result = await call(...args);
        assert();
        return result;
    };
    client.handle = (...args: unknown[]) => {
        const handler = args.at(-1);
        if (typeof handler !== 'function') {
            throw new Error('EOS_OCPP_HANDLER_INVALID');
        }
        const guarded = async (...input: unknown[]): Promise<unknown> => {
            assert();
            const result: unknown = await Reflect.apply(handler, undefined, input);
            assert();
            return result;
        };
        return handle(...args.slice(0, -1), guarded);
    };
}
