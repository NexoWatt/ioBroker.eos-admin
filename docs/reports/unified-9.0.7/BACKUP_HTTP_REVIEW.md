# Backup HTTP and lifecycle review — 9.0.7

Independent engineering review of the hosted Backup module, fixed module HTTP routes, configuration boundary, archive download, remote storage, and offline restore preparation. This is not an external audit or a live customer-system test.

## Concrete findings and changes

- **Upload resources after network failure:** `modules/backup/src/http.ts` previously cleared its deadline on request error or an early HTTP response without closing the uploaded file stream. It now unpipes and destroys the upload source on every completion; incomplete/failed requests and responses are destroyed. Response size, TLS verification, bounded deadline, and sanitized errors remain enforced.
- **Startup during shutdown:** review found that an awaited startup could resume after `stop()` and create schedules/key/watchdog after the host dropped the module. The Backup author added startup promise coordination and stopping fences, plus lifecycle regression tests.
- **Worker spawn failure:** a synchronous `fork()` failure could leave the module marked busy indefinitely. The Backup author clears current state and private job files on that path.
- **History memory and state events:** the Backup author bounded opened history files and retained history data, and added explicit one-click state subscription/cleanup following this review.
- **Shared remote destination retention:** existing job UUID filenames did not identify the appliance that owned an archive. The storage author added an encrypted per-source/per-target ownership ledger before deletion, preserving unowned and legacy files. The updated implementation was independently reviewed and its shared-folder, target-switch, and collision regressions passed. This review explicitly rejected deleting all matching EOS files in a shared target.
- **Late download result:** a host timeout could discard a subsequently opened download stream. The module-host author now tracks opened/pending download resources and closes late results on timeout or stop; route-level client abort cleanup also closes late streams returned to the route. The focused test covers timeout, stop, and concurrent-open admission.
- **Cleanup errors:** the Backup author was asked to make unsubscribe failure unable to skip child/process group, timers, and key cleanup.

## Boundary observations

Backup pages, configuration, commands, recovery-key export, and downloads share the admin-only EOS session boundary. Mutating calls require the current same-session CSRF token; no new public backup or arbitrary filesystem proxy was introduced. Downloads stream encrypted archives, have fixed filename validation, two-response admission limit, size checks, cancellation, and a transfer deadline. Restore preparation returns an offline command; it does not extract archives or overwrite the running controller from an HTTP request. The CLI authenticates the AES-GCM envelope into a newly created output directory.

## Evidence produced by this reviewer

- `node_modules/.bin/tsc -p modules/backup/tsconfig.json` — passed.
- `node --test modules/backup/test/http-transport.test.cjs` — 6/6 passed, covering network failure, early HTTP 413, aborted/oversize response, synchronous request validation failure, successful completion, and stalled-upload deadline.
- Tests use controlled HTTPS transport fixtures, not external provider accounts. Provider interoperability and customer recovery procedures require the release's separate integration evidence.

Independent closure rerun: `node --test test/eos-module-host.test.cjs modules/backup/test/lifecycle.test.cjs modules/backup/test/storage-parity.test.cjs modules/backup/test/http-transport.test.cjs` — **45/45 passed**. Evidence: `backup-independent-closure-tests.log`. The engineering findings listed above are closed by the reviewed implementation and these targeted tests; external provider interoperability is still outside this test scope.
