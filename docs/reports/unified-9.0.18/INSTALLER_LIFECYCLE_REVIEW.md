# AppCenter lifecycle and concurrency review — 9.0.18

Reviewed 2026-11-24. Scope: canonical `main.ts`, `www/ems-apps.ts`, and new strict `lib/installer-lifecycle.ts`.

Automatic device assignments and manual AppCenter saves share one mutation lock. Planning reads the authoritative saved configuration under that lock. Central ownership/licensing are checked before planning, after asynchronous planning and before persistence/application. Dynamic-grid changes use the existing versioned validator; the path does not directly grant app/control permissions. The planner/service has separate bounded alias and ownership validation.

GET configuration returns an opaque per-process HMAC revision captured before awaited hydration. Updated forms send this token on save/import. After automatic bindings exist, missing as well as stale tokens are rejected before persistence; nonempty stale arrays cannot replace newly commissioned devices. The browser retains its draft and asks for reload/comparison. The HMAC key is ephemeral and never sent to the client. Restart invalidates previously loaded forms.

Provisioning creates missing own objects before runtime state mirroring, with at most two attempts per idempotent step. No successful completion is reported after a provisioning/engine-apply failure. Automatic changes preserve existing live customer settings, mappings and history; startup no longer calls orphan cleanup. RFID read failures no longer become empty whitelist initialization. The separate engine/physical stop contracts remain unchanged and are not certified by this review.

Discovery queries now include the owning EOS namespace as well as existing NexoWatt device instances. Query patterns originate from internal owner identity, not HTTP input. Dotted device IDs retain their full alias base; only channels with category metadata or their exact manifest are returned as devices. An actual HTTP fixture verifies integrated and retained legacy IDs and excludes alias-group channels. Known deep-link tabs use a fixed allowlist and must also exist in the document. No browser-provided URL is used as a redirect.

## Existing scanner hotspots rechecked individually

- Partner app lookup (`localId`): still comes from the existing partner app contract; installed/enabled, current license and in-progress-save fence remain in force.
- Partner availability dictionary (`resourceId`): read-only access to the internal availability map, followed by strict boolean and timestamp freshness validation; no new write.
- Partner state cache (`id`): callback still consumes the existing fixed partner runtime state IDs; no new external caller.
- Partner telemetry dictionary (`resourceId`): read-only internal telemetry and existing downstream projection; automatic commissioning does not expose it.
- Peer error counter (`acc[k]`): reducer still starts from `Object.create(null)` and counts existing local peer error classes; no prototype setter.
- History query (`req.query[name]`): callers remain exactly `from`, `to`, `step`; finite/safe integer/range limits remain intact.
- History binary search (`src[mid]`): loop bounds remain derived from normalized array length, integer midpoint and read-only access.
- History decimal expression: the anchored decimal grammar remains unchanged, with disjoint decimal/exponent segments and finite numeric validation.
- SmartHome discovery error map (`errors[code]`): access remains guarded by `Object.hasOwn`; fixed fallback and bounded public messages remain intact.

No reviewed scanner exception was added for the new helper. Existing fingerprints/reasons remain unchanged; the source hash is renewed only for these rechecked findings. The modified frontend has no individually reviewed finding entries. The historical open scanner inventory remains an explicit limitation, not a clean-scan claim.

## Verification

`node --test test/eos-installer-lifecycle.test.cjs`: 8/8 passed with the generated runtime. Strict TypeScript (`ui/tsconfig.installer-lifecycle.json`) and type-aware ESLint (`ui/eslint.installer-lifecycle.config.mjs`) passed. Existing saved-settings preservation tests passed. The added app enable/disable/re-enable fixture executes the shared apply path and verifies object creation before its stubbed engine initialization, retained row mappings and unchanged telemetry/customer setting values. Separate device end-to-end fixtures exercise real alias objects and credential-protected AppCenter persistence; they do not exercise real energy hardware. The final generated build, full test set and delivery integrity remain the release owner's responsibility.
