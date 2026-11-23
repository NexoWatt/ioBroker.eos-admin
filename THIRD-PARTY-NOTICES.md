# Third-party notices – NexoWatt EOS

Release context: `iobroker.eos-admin` 9.0.7. This is a notice index,
not a claim that every dependency has been legally cleared or security-tested.

The proprietary NexoWatt notice applies only to NexoWatt-owned protected material.
Existing third-party licences and permissions remain in force. Do not remove the
corresponding notices from source, compiled assets or distributed packages.

| Component / origin | Retained notice location | Scope |
| --- | --- | --- |
| ioBroker.admin upstream portions, retained through EOS Admin 8.0.2 | `LICENSE`, `docs/ea/upstream-source-proof/LICENSE` | The original MIT grant and copyright remain applicable. |
| Vendored webserver | `src/lib/vendor/webserver/LICENSE`, `build/lib/vendor/webserver/LICENSE` | Preserve both source and distributed runtime notices. |
| Admin 8 frontend dependencies | `docs/third-party/admin8/` | Individual dependency notices supplied with the inherited frontend. |
| Earlier bundled/admin build components | `docs/ea/third-party/` | Historical evidence; not by itself a current runtime inventory. |
| Vendored acorn | `src-admin/src/vendor/acorn/LICENSE` | Preserve with the embedded component. |
| Integrated NexoWatt UI 1.0.38 | Original source archive identified in `docs/unified/BASELINE.md` | NexoWatt proprietary source; separate dependencies retain their own terms. |
| Integrated NexoWatt Devices 0.5.176 and EEBus 0.3.0 | `modules/devices/`, `modules/eebus/` | Original proprietary notices and dependency licenses retained. |
| NexoWatt EOS Backup 1.0.10, derived from ioBroker.backitup | `modules/backup/upstream/LICENSE`, `modules/backup/upstream/NOTICE.md`, `modules/backup/provenance.json` | MIT grant to original code remains applicable; new EOS integration does not revoke it. |

The current release SBOM and package manifest determine what is actually delivered.
Historical folders do not establish the version installed on a customer system.
Before redistributing a changed bundle, reconcile its actual dependency tree and
embedded components with the notices; retain any additional required licence text,
source offer or attribution. A package's npm licence metadata is not a replacement
for these obligations.

The upstream MIT text included in the original EOS Admin root licence is preserved
verbatim below and in `LICENSE`.

# Third-party / upstream notice

Portions of this adapter are based on the upstream ioBroker.admin project and remain subject to the following MIT license notice:

The MIT License (MIT)

Copyright (c) 2014-2026 bluefox <dogafox@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
