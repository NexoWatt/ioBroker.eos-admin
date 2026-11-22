# EOS 9.0.5 – retained EMS regression after registry cache correction

Executed on 22 November 2026 with Node.js 24.22.3, after the centralized runtime generation completed. No product source, configuration or runtime artifact was changed by this regression task. Two legacy test contracts were subsequently corrected as described below; their raw failures and baseline comparison remain preserved.

| Scope | Result | Evidence |
| --- | --- | --- |
| NVP and dynamic grid, including a simulated plant using the actual registry/writer/arbiter | 208 passed, 0 failed, 0 skipped | `nvp-dynamic-grid.tap` |
| Selected retained EMS scripts, first execution | 12 passed, 2 failed at obsolete terminal test expectations | `script-results.json`, individual logs |
| Both failed scripts, after test-contract maintenance | Both completed with exit code 0; all 14 selected script contracts now pass | `updated-test-results.json`, `*-after.log` |
| Syntax and ESLint of the two changed test scripts | Exit code 0 | `updated-test-results.json`, `updated-tests-lint.log` |
| Existing TypeScript parallel mirror for the arbiter test | Source hash synchronized, no syntax diagnostics; existing comments/body preserved | `mirror-verification.json` |

The selected scripts cover strict number handling, stale timestamps, connection-versus-heartbeat distinction, sibling heartbeat events without payload retention, alias mappings and scaling, direct-current charge commands, safety authority at the final writer, EVCS input refresh, permanent grid protection, grid-cap clamping, zero-export budget coordination/charging/storage probes, and heater PV freshness. The complete command list and exact exit codes are in the JSON evidence. Counts of scripts are not counts of assertions or physical devices.

## Two historical test expectations, not suppressed failures

1. `verify-actuator-safety-arbiter.js` originally failed at line 225 because it required the original writer function object to replace the interceptor after shutdown. The existing production `uninstall()` deliberately retains a thin interceptor: unbound fallback calls still reach the original writer, while asynchronous partner/dynamic-grid work from an old lifecycle remains blocked. Every preceding safety, lease, preemption, same-cycle and registry deadband assertion completed before the terminal identity failure. The test now exercises the actual contract: paused partner and dynamic-grid continuations using both writer APIs cannot reach hardware after stop; both unbound fallback writer calls execute exactly once and preserve their original result. No arbiter implementation was changed.
2. `verify-rc82-permanent-grid-protection.cjs` originally failed at line 182 because it required an obsolete `CACHE_NAME` declaration. The existing unified-origin service worker intentionally retires legacy EOS caches, claims clients and unregisters itself, without fetch interception or offline caching of protected responses. Every preceding grid-protection behavioral assertion completed before the static cache-name failure. The revised test runs both canonical and generated workers in a VM, verifies removal of only EOS cache names, checks install/activation completion and unregister, and rejects any fetch listener. The remaining packaging/documentation assertions also complete successfully. No service-worker implementation was changed.

Both original failures were reproduced from the previously delivered **9.0.4 full repository ZIP**, extracted separately with its own UI files. The relevant scripts, arbiter runtime and canonical service worker were byte-identical to 9.0.4 before test maintenance. `baseline-comparison.json` records the hashes and exact commands; `baseline-9.0.4-*.log` preserves the same failures. `tested-entrypoints.sha256` records the initial tested source/runtime; `updated-test-files.sha256` records the final modified test files. The comprehensive release seal remains the authoritative package snapshot.

Changed test-only files: `ui/scripts/verify-actuator-safety-arbiter.js`, its existing `ui/src-ts/runtime-mirrors/scripts/verify-actuator-safety-arbiter.ts` parallel mirror, and `ui/scripts/verify-rc82-permanent-grid-protection.cjs`. No broad mirror or runtime generator was run for these test changes.

## Limits

These are software regressions with synthetic controller states and device responses. They do not establish hardware safety, target-device memory behavior, an OOM cause, whole-system performance, or CRA conformity. The new registry cache-specific tests and the actual installed-controller/browser checks are reported separately by their owners; their counts are not duplicated here.
