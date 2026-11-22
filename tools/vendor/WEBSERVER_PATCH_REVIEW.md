# Reviewed WebServer patch for NexoWatt EOS 9.0.1

Review date: 2026-11-22. Upstream package: `@iobroker/webserver@3.4.0`, MIT.
The registry URL, npm integrity and original archive SHA-256 remain unchanged in
`webserver-3.4.0-source.provenance.json`. The existing upstream archive was read
locally; its archive hash and all 39 original file hashes/sizes were checked
against the previously pinned provenance before approving this patch.

Exactly one upstream file is changed: `build/lib/webServer.js`. The accompanying
`webserver-3.4.0-no-private-key-logs.patch` records two replacements:

1. The certificate collection update logger previously serialized the complete
   collection objects, which can contain private certificate material. It now
   emits only the number of collections.
2. The default certificate loader previously serialized the loaded certificate
   object, including its private TLS key. It now emits only `available` or
   `unavailable`.

Certificate selection, loading, verification, server creation and error behavior
are unchanged by this patch. No log level can re-enable these two payload dumps.
This review does not claim that every upstream logging path has been audited.
The unchanged MIT license and upstream copyright notice are retained. These
patched bytes are reviewed EOS source, not an unmodified upstream distribution.

Each file entry retains `upstreamBytes` and `upstreamSha256` alongside the
approved `bytes` and `sha256`. The admission checker pins the whole provenance
document and also verifies the patch artifact. Both source and emitted runtime
copies must contain exactly the same approved file set and bytes; symlinks,
additional files, changed patches and changed provenance remain rejected.
Updating a local hash is not an automatic approval or repair operation.

Upstream source maps are retained unchanged. The edited JavaScript lines retain
their original line numbers, but original column mappings within the two log
expressions have not been regenerated. No source-map content was modified.

The provenance review confirms the actual source diff and retained licensing.
Runtime log redaction tests and the post-build source/runtime byte check are
separate release checks; this document does not substitute for their results or
for a device-level acceptance test.
