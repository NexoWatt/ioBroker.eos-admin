"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guardRpcClient = guardRpcClient;
function guardRpcClient(client, assert) {
    const call = client.call.bind(client);
    const handle = client.handle.bind(client);
    client.call = async (...args) => {
        assert();
        const result = await call(...args);
        assert();
        return result;
    };
    client.handle = (...args) => {
        const handler = args.at(-1);
        if (typeof handler !== 'function') {
            throw new Error('EOS_OCPP_HANDLER_INVALID');
        }
        const guarded = async (...input) => {
            assert();
            const result = await Reflect.apply(handler, undefined, input);
            assert();
            return result;
        };
        return handle(...args.slice(0, -1), guarded);
    };
}
