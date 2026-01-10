import { useState, useEffect, type FC } from 'react';
import { Icon } from '@notehub/icon-manager';
import { Label } from '@notehub/ck-standard';
import type { VaultService, VaultHistoryEntry } from '../logic/VaultService.js';

/**
 * Props for VaultList component
 */
interface VaultListProps {
    service: VaultService;
}

/**
 * VaultList - Displays list of recently opened vaults
 *
 * Visual Polish:
 * - Header "Recent Vaults"
 * - Styled cards with hover effects
 * - Delete button visible on hover (desktop)
 */
export const VaultList: FC<VaultListProps> = ({ service }) => {
    const [vaults, setVaults] = useState<VaultHistoryEntry[]>([]);

    useEffect(() => {
        service.getRecentVaults().then(setVaults);
    }, [service]);

    const handleVaultClick = async (path: string) => {
        try {
            await service.openVault(path);
        } catch {
            // Error is already logged and displayed by VaultService
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, _path: string) => {
        e.stopPropagation();
        // TODO: Implement vault deletion from history
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-4 pb-2 shrink-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--nh-text-muted)]">
                    Recent Vaults
                </h3>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
                {vaults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-[var(--nh-text-muted)] text-center">
                        <Label variant="caption">No recent vaults</Label>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {vaults.map((vault) => (
                            <div
                                key={vault.path}
                                onClick={() => handleVaultClick(vault.path)}
                                className="
                                    group flex items-center gap-3 p-2 rounded-md cursor-pointer
                                    transition-all duration-200
                                    text-[var(--nh-text-secondary)]
                                    hover:bg-[var(--nh-bg-hover)] hover:text-[var(--nh-text-primary)]
                                "
                            >
                                {/* Icon */}
                                <div className="shrink-0 text-[var(--nh-text-muted)] group-hover:text-[var(--nh-accent-primary)] transition-colors">
                                    <Icon name="folder" size={18} />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 flex flex-col">
                                    <span className="font-medium text-sm truncate">
                                        {vault.name}
                                    </span>
                                    <span className="text-xs text-[var(--nh-text-muted)] truncate opacity-70">
                                        {vault.path}
                                    </span>
                                </div>

                                {/* Actions */}
                                <button
                                    onClick={(e) => handleDeleteClick(e, vault.path)}
                                    className="
                                        shrink-0 p-1.5 rounded-md
                                        opacity-0 group-hover:opacity-100 focus:opacity-100
                                        text-[var(--nh-text-muted)] hover:text-[var(--nh-danger)] hover:bg-[var(--nh-bg-surface)]
                                        transition-all duration-200
                                    "
                                    aria-label="Remove"
                                >
                                    <Icon name="x" size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VaultList;
