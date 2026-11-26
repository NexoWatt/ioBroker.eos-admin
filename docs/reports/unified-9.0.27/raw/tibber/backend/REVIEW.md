# Tibber persistence review (2026-11-26)

Confirmed defect: the Installer configuration projection omitted `tariffProvider`. Its persisted-overlay loop copied only keys already in that projection. Consequently, the AppCenter received no saved tariff, rendered `manual-dp` and empty credentials, and its generic save submitted these defaults. A subsequent adapter restart faithfully loaded the overwritten tariff.

The failure was reproduced with the actual customer HTTP route, actual Installer GET/POST, actual frontend apply/collect functions, real UI/EMS child process, and a new owner reconstructed from disk snapshots. The failing run reports only provider/enabled/credential-present booleans, never tokens. A one-line projection change in a scratch compile made the same sequence pass. Isolated customer saves followed directly by child/owner restarts passed before the change; no separate unconditional startup deletion was established.

Implemented backend changes:

- Include a cloned tariff configuration in the Installer projection, then apply the existing response mask. Persisted selections, home, formula and credentials are available to the editor with masks, not real secret values.
- Add typed `mergeInstallerTariffSecrets` in `customer-tariff.ts`. Retained credentials require the same provider, resolved source, actual endpoint(s), and relevant authentication identity. Home/country changes with the same source and recipient preserve the token. Explicit empty fields still delete it. Different recipients cannot resurrect old tokens through deep merge.
- Entire custom request headers/body values are masked, including the supported object form. Same-context masks restore them server-side; source changes clear unprovided masked values. No content-key guessing is used.
- Installer GET/POST require positively confirmed hydration before returning configuration/revision or accepting configuration edits. The existing global write gate also rejects several startup states; it was not claimed absent after diagnosis.
- Devices/OCPP background reconciliation also requires hydration. A real early `onReady` failure previously allowed a degraded, unhydrated runtime to reach the Devices planner; this now rejects before planning/persistence.
- The common HTTP route fixture explicitly declares its intentionally already-loaded state. Lifecycle tests use real child startup and barriers instead.

Files owned by this change:

- `ui/src-ts/runtime-executables/main.ts`
- `ui/src-ts/runtime-executables/lib/customer-tariff.ts`
- `ui/test/unified/http-harness.cjs`
- `test/eos-tariff-installer-roundtrip.test.cjs`

Validation:

- Original reproduction: `appcenter-overwrite-repro.log` fails with `manual-dp`, disabled and credential missing after a fresh owner restart.
- Scratch minimal correction: `appcenter-overwrite-patched-scratch.log` passes the same complete sequence.
- Original pure customer restart: `process-disk-restart-node24.log`, 2/2 passing for native and preserved namespaces.
- New targeted regression: 20 tests. Two uninterrupted real-process HTTP sequences cover masked unrelated edits, disk-backed fresh owner restart, both namespaces, startup/read-failure blocking. Seven independent real Installer HTTP fixtures cover explicit disable/delete, recipient changes, and string/object request credentials with actual protected persistence. Pure helper cases additionally cover provider/source/auth-identity changes. The final lifecycle case reproduces the early startup failure and proves background mutation rejection.
- Strict TypeScript and targeted type-aware ESLint passed (`customer-tariff-typecheck.log`, `customer-tariff-lint.log`).
- Final generated-runtime Node22 result: `roundtrip-final-node22.log`, 20/20, zero skips/failures (12.60 s).
- Final generated-runtime Node24 result: `roundtrip-final-node24.log`, 20/20, zero skips/failures (11.77 s).
- Final test SHA-256: `36c9052a85f7291a15844239615263af46e682b4a34d2fc90aa7712c2aaa472f`.

A preliminary source-only Node22 run used a copied raw HTTP parent fixture and failed in the proxy error path (`res.status` absent). The final regression uses the production Express parent contract; generated-runtime results supersede that preliminary run. No product limit, timeout or transport behavior was relaxed.

The first combined security fixture performed ten unrelated Installer mutations immediately one after another inside the same child, eventually tripping `EOS_UI_PROCESS_RATE_LIMIT`. Instrumentation recorded typically 1,453–1,481 RPCs in each direction per POST, 117–204 ms per simple save; no single save reached the 8,192/s boundary. Actual subscription filtering was already present: only 670 of approximately 32,000 outbound messages were state events. Most calls were repeated object/state provisioning and subscriptions. This evidence is retained in `roundtrip-built-diagnostic.log` and `roundtrip-built-ipc-counts.log`; the superseded failing combined run is `roundtrip-built-node24.log`.

The security cases were split into fresh independent real-route fixtures because provider and recipient fences are independent scenarios. The actual human Tibber-save → unrelated Installer-save → child/owner restart chain remains uninterrupted and continues to exercise the real IPC boundary. This is not a change to production pacing or flood protection. Repeated object provisioning on generic Installer saves remains a separate optimization opportunity; these timings/counts are for a synchronous controller fixture, not a Raspberry Pi RAM or throughput measurement.

Limits: controller data/session authority are controlled fixtures; the actual Raspberry Pi/controller database and real Tibber service were not accessed. No live hardware or actual account credential was used. The confirmed overwrite explains a loss observed after restart following an AppCenter edit; it does not independently identify every operation performed on the user's installation.
