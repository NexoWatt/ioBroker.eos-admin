#!/usr/bin/env python3
# Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
# Use, modification or distribution without express written permission is prohibited.
"""Create and independently validate the complete NexoWatt repository ZIP.

This explicitly requested packaging step updates only the repository payload
manifest. It does not build, execute npm hooks, alter product sources, regenerate
the product SBOM, publish, or install anything. Run only after all tests and
report edits have finished. No third-party Python packages are needed.

Example:
  python3 package_full_repository.py --root /absolute/repository \
    --output /absolute/deliverables/repository.zip

The result JSON is written beside the output ZIP as <stem>.validation.json.
Archive member timestamps are fixed, making repeated successful runs byte-stable
for identical contents, executable bits, and the same Python/zlib implementation.
"""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import sys
import tempfile
import zipfile


EXPECTED_VERSION = "1.0.31"
MANIFEST = "release-manifests/repository-payload-sha256.json"
EXCLUDED_COMPONENTS = frozenset({
    "node_modules", ".git", "build-ts", "build-types", "__pycache__", ".cache",
    "playwright-report", "test-results", "coverage",
})
EXCLUDED_ROOT_PATHS = frozenset({
    "build/types", "browser-runtime", "dynamic-grid-ui-qa",
    "dynamic-grid-ui-128-qa", "dynamic-grid-qa", "ems-navigation-qa", "nvp-ui-qa",
})
FIXED_ZIP_TIME = (1980, 1, 1, 0, 0, 0)


class PackagingError(Exception):
    """A deterministic packaging or validation requirement was not met."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise PackagingError(message)


def safe_relative(name: str) -> PurePosixPath:
    require(bool(name), "empty path")
    require("\\" not in name and ":" not in name, "non-portable path separator or drive")
    require(not any(ord(char) < 32 or ord(char) == 127 for char in name), "control character in path")
    pure = PurePosixPath(name)
    require(not pure.is_absolute(), "absolute archive path")
    require(all(part not in {"", ".", ".."} for part in name.split("/")), "unsafe relative path segment")
    require(all(not part.endswith((".", " ")) for part in pure.parts), "non-portable path suffix")
    require(str(pure) == name, "non-canonical relative path")
    return pure


def excluded(name: str) -> bool:
    parts = PurePosixPath(name).parts
    return bool(set(parts) & EXCLUDED_COMPONENTS) or any(
        name == prefix or name.startswith(prefix + "/") for prefix in EXCLUDED_ROOT_PATHS
    )


def collect_files(root: Path) -> dict[str, int]:
    """Return sorted regular files and normalized permissions; never follow links."""
    found: dict[str, int] = {}
    folded: dict[str, str] = {}

    def walk(directory: Path, prefix: str = "") -> None:
        for entry in sorted(os.scandir(directory), key=lambda item: item.name):
            name = prefix + entry.name
            safe_relative(name)
            if excluded(name):
                continue
            require(not entry.is_symlink(), "symlink in repository payload: " + name)
            mode = entry.stat(follow_symlinks=False).st_mode
            if stat.S_ISDIR(mode):
                walk(Path(entry.path), name + "/")
            else:
                require(stat.S_ISREG(mode), "non-regular repository entry: " + name)
                lower = name.casefold()
                require(lower not in folded, "case-insensitive duplicate path: " + name)
                folded[lower] = name
                found[name] = 0o755 if mode & 0o111 else 0o644

    walk(root)
    return dict(sorted(found.items()))


def file_digest(path: Path) -> tuple[int, str]:
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags)
    with os.fdopen(descriptor, "rb") as handle:
        require(stat.S_ISREG(os.fstat(handle.fileno()).st_mode), "source changed to non-regular file")
        digest = hashlib.sha256()
        size = 0
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            size += len(chunk)
            digest.update(chunk)
    return size, digest.hexdigest()


def read_json(path: Path) -> dict:
    require(not path.is_symlink(), "JSON input is a symlink: " + path.name)
    result = json.loads(path.read_text(encoding="utf-8"))
    require(isinstance(result, dict), "JSON object required: " + path.name)
    return result


def atomic_json(path: Path, data: dict) -> None:
    encoded = (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    descriptor, temporary = tempfile.mkstemp(prefix=".packaging-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(encoded)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o644)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def verify_versions(root: Path) -> dict:
    package = read_json(root / "package.json")
    lock = read_json(root / "package-lock.json")
    io = read_json(root / "io-package.json")
    release = read_json(root / "release-manifests/release-status.json")
    sbom = read_json(root / "release-manifests/sbom-product-evidence.json")
    versions = {
        "package.json": package.get("version"),
        "package-lock.json": lock.get("version"),
        "package-lock.json packages root": lock.get("packages", {}).get("", {}).get("version"),
        "io-package.json": io.get("common", {}).get("version"),
        "release-status.json": release.get("version"),
        "sbom-product-evidence.json": sbom.get("version"),
    }
    require(all(version == EXPECTED_VERSION for version in versions.values()), "release version mismatch: " + json.dumps(versions))
    require(isinstance(release.get("productionApproved"), bool), "missing actual release approval flag")
    return {"package": package, "release": release, "versions": versions}


def check_package_files(package: dict, paths: set[str]) -> int:
    declared = package.get("files")
    require(isinstance(declared, list) and bool(declared), "package.files must be a nonempty array")
    for pattern in declared:
        require(isinstance(pattern, str), "non-string package.files entry")
        require(not pattern.startswith("!"), "negative package.files patterns require explicit review")
        safe_relative(pattern.rstrip("/"))
        if any(char in pattern for char in "*?["):
            matches = [name for name in paths if fnmatch.fnmatchcase(name, pattern)]
            require(bool(matches), "package.files pattern has no archive match: " + pattern)
        else:
            exact = pattern.rstrip("/")
            require(exact in paths or any(name.startswith(exact + "/") for name in paths),
                    "required package.files entry absent: " + pattern)
    return len(declared)


def zip_metadata(name: str, permission: int) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, date_time=FIXED_ZIP_TIME)
    info.create_system = 3
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = (stat.S_IFREG | permission) << 16
    return info


def run(root: Path, output: Path, result_path: Path) -> dict:
    require(root.is_dir() and not root.is_symlink(), "root must be a real directory")
    root = root.resolve()
    require(not output.is_symlink() and not result_path.is_symlink(), "output path must not be a symlink")
    output = output.parent.resolve() / output.name
    result_path = result_path.parent.resolve() / result_path.name
    require(not output.is_relative_to(root) and not result_path.is_relative_to(root), "ZIP and validation JSON must be outside repository")
    require(output.suffix.lower() == ".zip", "output must end in .zip")
    require(output != result_path, "ZIP and result JSON must be distinct")
    require(output.parent.is_dir(), "output parent directory does not exist")
    safe_relative(root.name)

    inputs = verify_versions(root)
    inventory = collect_files(root)
    require(MANIFEST in inventory, "existing repository payload manifest is required")
    required_sources = {
        ".github/dependabot.yml", ".github/workflows/security.yml",
        ".github/workflows/codeql.yml", ".github/codeql/codeql-config.yml",
        ".githooks/pre-commit", "src-admin-tab/package.json",
        "src-admin-tab/package-lock.json", "src-ts/runtime-executables/main.ts",
        "src-ts/runtime-executables/lib/http-error-boundary.ts",
        "lib/http-error-boundary.js", "tsconfig.security-boundaries.json",
        "scripts/verify-security-standards.cjs", "scripts/verify-http-error-boundary.cjs",
        "scripts/verify-runtime-license-header.cjs", "scripts/verify-static-ems-exports.cjs",
        "release-manifests/sbom-product.cdx.json", "release-manifests/sbom-product-evidence.json",
        "docs/reports/security-standards-2026-10-23/PRUEFBERICHT_DE.md",
        "docs/reports/security-standards-2026-10-23/SECOND_REVIEW_DE.md",
        "docs/reports/security-patch-2026-10-24/PRUEFBERICHT_DE.md",
        "docs/reports/security-patch-2026-10-24/INDEPENDENT_REVIEW_DE.md",
    }
    require(required_sources <= set(inventory), "full repository requirements absent: " + ", ".join(sorted(required_sources - set(inventory))))
    for prefix in ["test/", "tests/", "src-ts/", "src-admin-tab/src/", "admin/react/", "www/", "ems/"]:
        require(any(name.startswith(prefix) for name in inventory), "full repository subtree absent: " + prefix)
    package_count = check_package_files(inputs["package"], set(inventory))

    entries = []
    for name in inventory:
        if name == MANIFEST:
            continue
        size, digest = file_digest(root / name)
        entries.append({"path": name, "sizeBytes": size, "sha256": digest})
    manifest = {
        "schema": "nexowatt.repository-payload.v1",
        "version": EXPECTED_VERSION,
        "productionApproved": inputs["release"]["productionApproved"],
        "excludes": [
            "directory components: " + ", ".join(sorted(EXCLUDED_COMPONENTS)),
            "root paths: " + ", ".join(sorted(EXCLUDED_ROOT_PATHS)),
            "this manifest itself: " + MANIFEST,
        ],
        "files": entries,
    }
    atomic_json(root / MANIFEST, manifest)
    inventory[MANIFEST] = 0o644
    manifest_size, manifest_sha = file_digest(root / MANIFEST)
    expected = {entry["path"]: (entry["sizeBytes"], entry["sha256"]) for entry in entries}
    expected[MANIFEST] = (manifest_size, manifest_sha)

    descriptor, temporary = tempfile.mkstemp(prefix=".repository-", suffix=".zip", dir=output.parent)
    os.close(descriptor)
    try:
        prefix = root.name + "/"
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9, allowZip64=True) as archive:
            for name in sorted(expected):
                data = (root / name).read_bytes()
                require((len(data), hashlib.sha256(data).hexdigest()) == expected[name], "source changed during packaging: " + name)
                archive.writestr(zip_metadata(prefix + name, inventory[name]), data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

        with zipfile.ZipFile(temporary, "r") as archive:
            require(archive.testzip() is None, "archive CRC validation failed")
            actual: dict[str, zipfile.ZipInfo] = {}
            folded: set[str] = set()
            for info in archive.infolist():
                safe_relative(info.filename)
                require(info.filename.startswith(prefix), "unexpected archive root")
                name = info.filename[len(prefix):]
                safe_relative(name)
                require(not excluded(name), "excluded path in archive: " + name)
                require(not info.is_dir(), "unexpected directory-only ZIP entry")
                require(stat.S_ISREG(info.external_attr >> 16), "non-regular ZIP entry: " + name)
                require(not (info.flag_bits & 0x1), "unexpected encrypted archive member")
                require(name not in actual and name.casefold() not in folded, "duplicate archive member")
                actual[name] = info
                folded.add(name.casefold())
            require(set(actual) == set(expected), "archive file inventory differs from complete source inventory")
            embedded_manifest = json.loads(archive.read(prefix + MANIFEST))
            require(embedded_manifest == manifest, "embedded repository manifest differs")
            for name, target in expected.items():
                data = archive.read(prefix + name)
                require((len(data), hashlib.sha256(data).hexdigest()) == target, "ZIP SHA-256 mismatch: " + name)
            package_in_zip = json.loads(archive.read(prefix + "package.json"))
            require(package_in_zip.get("version") == EXPECTED_VERSION, "ZIP package version mismatch")
            check_package_files(package_in_zip, set(actual))

        # Catch tests/reports being modified while ZIP generation was in progress.
        final_inventory = collect_files(root)
        require(final_inventory == inventory, "repository inventory or permissions changed while packaging")
        for name, target in expected.items():
            require(file_digest(root / name) == target, "repository changed after ZIP snapshot: " + name)
        archive_size, archive_sha = file_digest(Path(temporary))
        os.replace(temporary, output)
        return {
            "schema": "nexowatt.full-repository-zip-validation.v1",
            "ok": True,
            "version": EXPECTED_VERSION,
            "productionApproved": inputs["release"]["productionApproved"],
            "output": str(output),
            "sha256": archive_sha,
            "sizeBytes": archive_size,
            "archiveRoot": root.name,
            "fileCount": len(expected),
            "manifestCoveredFileCount": len(entries),
            "manifestSha256": manifest_sha,
            "packageFilesEntriesChecked": package_count,
            "versionsChecked": inputs["versions"],
            "checks": {
                "crc": True, "allManifestHashesMatchZip": True,
                "fullSourceInventoryMatchesZip": True, "packageFilesPresent": True,
                "requiredSourceCiSbomFilesPresent": True, "safePaths": True,
                "noSymlinksOrSpecialFiles": True, "noCaseInsensitiveDuplicates": True,
                "sourceUnchangedDuringPackaging": True,
            },
            "limits": [
                "Packaging validation only; no test suite, device test, dependency installation, or release approval is performed.",
                "Product SBOM and immutable product artifact checks must already have passed; this tool does not reseal them.",
                "The ZIP contains complete source and existing reports; npm package.files is only a required subset.",
            ],
        }
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", required=True, type=Path, help="complete, tested 1.0.31 repository")
    parser.add_argument("--output", required=True, type=Path, help="ZIP file outside repository; parent must exist")
    args = parser.parse_args()
    root = args.root.absolute()
    output = args.output.parent.resolve() / args.output.name
    result_path = output.with_name(output.stem + ".validation.json")
    try:
        result = run(root, output, result_path)
        atomic_json(result_path, result)
        print(json.dumps({"ok": True, "output": str(output), "result": str(result_path), "sha256": result["sha256"], "fileCount": result["fileCount"]}))
        return 0
    except (PackagingError, OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        failure = {"schema": "nexowatt.full-repository-zip-validation.v1", "ok": False,
                   "output": str(output), "errorType": type(error).__name__, "error": str(error)}
        try:
            if result_path.parent.is_dir() and not result_path.is_symlink() and not result_path.is_relative_to(root.resolve()):
                atomic_json(result_path, failure)
        except OSError:
            pass
        print(json.dumps(failure), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
