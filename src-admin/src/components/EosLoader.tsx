import React, { type ReactNode } from 'react';

interface EosLoaderProps {
    label: ReactNode;
    compact?: boolean;
}

// Keep this markup aligned with the pre-React splash in index.html. Both use
// local EOS assets and the same stylesheet, including reduced-motion support.
export default function EosLoader({ label, compact = false }: EosLoaderProps): React.JSX.Element {
    return (
        <div
            className={`eos-boot-loader${compact ? ' eos-boot-loader--compact' : ''}`}
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <img
                className="eos-boot-loader__logo"
                src="img/eos/nexowatt-eos-brand-wide.png"
                width={1200}
                height={342}
                alt="NexoWatt EOS – Energy Operation System"
            />
            <span
                className="eos-boot-loader__spinner"
                aria-hidden="true"
            />
            <p className="eos-boot-loader__label">{label}</p>
        </div>
    );
}
