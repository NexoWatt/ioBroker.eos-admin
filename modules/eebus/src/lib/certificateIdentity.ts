import { createHash, createPrivateKey, X509Certificate } from 'node:crypto';

interface DerNode { tag: number; start: number; end: number; next: number }
function readNode(der: Buffer, at: number, limit: number): DerNode {
    const tag = der[at++];
    let length = der[at++];
    if (tag === undefined || length === undefined) throw new Error('EEBUS_CERT_DER');
    if (length & 0x80) {
        const bytes = length & 0x7f;
        if (!bytes || bytes > 4 || at + bytes > limit) throw new Error('EEBUS_CERT_DER');
        length = 0;
        for (let index = 0; index < bytes; index++) length = length * 256 + der[at++];
    }
    const end = at + length;
    if (end > limit || end < at) throw new Error('EEBUS_CERT_DER');
    return { tag, start: at, end, next: end };
}

/** Read the actual SKI extension; fallback is RFC 5280 method 1 over key bits, not SPKI headers. */
function skiFromDer(der: Buffer): string {
    function search(start: number, end: number, depth: number): string {
        if (depth > 12) throw new Error('EEBUS_CERT_DER_DEPTH');
        for (let at = start; at < end;) {
            const node = readNode(der, at, end);
            if (node.tag === 0x06 && der.subarray(node.start, node.end).equals(Buffer.from([0x55, 0x1d, 0x0e]))) {
                let value = readNode(der, node.next, end);
                if (value.tag === 1) value = readNode(der, value.next, end);
                if (value.tag !== 4) throw new Error('EEBUS_CERT_SKI');
                const octets = readNode(der, value.start, value.end);
                if (octets.tag !== 4 || octets.end - octets.start !== 20) throw new Error('EEBUS_CERT_SKI');
                return der.subarray(octets.start, octets.end).toString('hex').toUpperCase();
            }
            if (node.tag & 0x20) {
                const found = search(node.start, node.end, depth + 1);
                if (found) return found;
            }
            at = node.next;
        }
        return '';
    }
    return search(0, der.length, 0);
}

export function certificateIdentity(input: Buffer | string): { ski: string; fingerprint: string; certificate: X509Certificate } {
    if (Buffer.byteLength(input) > 32768) throw new Error('EEBUS_CERT_SIZE');
    const certificate = new X509Certificate(input);
    const now = Date.now();
    if (now < Date.parse(certificate.validFrom) || now > Date.parse(certificate.validTo)) throw new Error('EEBUS_CERT_TIME');
    if (certificate.publicKey.asymmetricKeyType !== 'ec' || certificate.publicKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
        throw new Error('EEBUS_CERT_CURVE');
    }
    let ski = skiFromDer(certificate.raw);
    if (!ski) {
        const spki = certificate.publicKey.export({ type: 'spki', format: 'der' });
        const sequence = readNode(spki, 0, spki.length);
        const algorithm = readNode(spki, sequence.start, sequence.end);
        const bits = readNode(spki, algorithm.next, sequence.end);
        if (bits.tag !== 3 || spki[bits.start] !== 0) throw new Error('EEBUS_CERT_KEY_BITS');
        ski = createHash('sha1').update(spki.subarray(bits.start + 1, bits.end)).digest('hex').toUpperCase();
    }
    return { ski, fingerprint: certificate.fingerprint256.replace(/:/g, '').toUpperCase(), certificate };
}

export function validateKeyPair(certificate: string, privateKey: string): ReturnType<typeof certificateIdentity> {
    const identity = certificateIdentity(certificate);
    if (privateKey.length > 32768 || !identity.certificate.checkPrivateKey(createPrivateKey(privateKey))) {
        throw new Error('EEBUS_IDENTITY_KEY_MISMATCH');
    }
    return identity;
}
