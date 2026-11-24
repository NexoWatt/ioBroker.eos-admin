# Hosted device command delivery

## Confirmed defect

The embedded Devices module had no owned subscription for its device namespace.
Its state-change handler and the root EOS handler routed commands correctly only
when the controller happened to deliver the event. A farm `setForeignState` call
could therefore persist an `ack:false` target without ever reaching DeviceRuntime
or the physical driver's write queue.

Browser subscriptions could accidentally cover that gap. Once the browser's `*`
subscription was removed by throttling or disconnect, the same command stopped
reaching the driver. This is independent of the separate farm acknowledgement
display defect. A database write completion is not a device acknowledgement or a
measurement of actual battery power.

## Reproduction

`test/eos-device-command-subscriptions.test.cjs` executes the actual root
`onStateChange` callback, subscription manager, module host, hosted Devices module
and DeviceRuntime. The controlled controller boundary delivers only events that
match acquired subscriptions. The physical driver boundary records writes.

Before the fix, both the EOS and retained legacy namespace cases failed on the
first raw command: only legacy adapter `alive` states were subscribed. A browser
`*` subscription made an AliasV1 command reach the driver; removing it caused the
next command to remain unacknowledged and never reach that driver. The preserved
before-run evidence reports four failures including the parent test.

The previous end-to-end commissioning fixture delivered every database change
unconditionally, so it could not detect this subscription dependency.

## Correction

- The module host acquires `<namespace>.devices.*` before creating or starting the
  device module. The namespace is restricted to `eos-admin.N` or the validated
  retained `nexowatt-devices.N` namespace. Raw commands, legacy aliases and AliasV1
  are covered; no global wildcard is acquired.
- The shared state-subscription manager provides explicit module leases. Existing
  host and socket callback/async methods retain their idempotent API semantics.
  Releasing one module cannot remove another module, host or browser interest in
  the same pattern. Socket publication retains its existing ACL checks.
- Startup waits at most ten seconds for the subscription. Cleanup retains the
  original acquisition promise, so a late controller acknowledgement is drained
  without opening revoked hardware. Uncertain shutdown remains unconfirmed.
- Cleanup is tied to the captured acquisition. A new startup attempt resets the
  completed prior cleanup promise, including when factory creation fails.
- Failed subscription acquisitions and failed releases remain retryable without
  inventing successful controller operations. Lease owner and pattern limits are
  enforced before asynchronous IO, including simultaneous different patterns.

Production constructs the manager before the module host. The standalone-host
compatibility path for owners without that manager still uses their existing
subscription API, with an idempotent release closure; shared-interest isolation
is guaranteed by the production manager, not by an arbitrary standalone owner.

## Validation

69 focused tests passed on Node.js 22 and 24:

- `test/eos-device-command-subscriptions.test.cjs`
- `test/eos-unified-state-subscriptions.test.cjs`
- `test/eos-module-stop-lifecycle.test.cjs`
- `test/eos-module-host.test.cjs`
- `test/eos-socket-threshold.test.cjs`

Coverage includes raw/legacy/AliasV1 writes, positive/negative/zero targets,
retained IDs, browser unsubscribe, independent host observers, revoked authority,
two module leases sharing a pattern, failed subscription/release, pending stop,
never-resolving acquisition, late cleanup, subsequent factory failure and
concurrent pattern-limit enforcement. Existing SocketCommands ACL regression
cases remain green. Targeted backend TypeScript and unified module-host ESLint
checks report no errors or additional exceptions.

This fixture controls physical IO; it proves delivery through the actual runtime
to the driver boundary. The separate SolaX loopback Modbus fixture tests the
driver-to-wire path. Neither fixture constitutes commissioning on the customer's
physical installation. A fresh polled readback and measured battery response
remain necessary to confirm live actuation after installation.

No customer configuration, register mapping, dispatch policy, licence decision,
standard ioBroker Admin setting or existing datapoint ID was changed by this fix.
