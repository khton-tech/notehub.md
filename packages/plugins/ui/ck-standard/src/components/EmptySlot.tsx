import React from 'react';
import { PackageOpen } from 'lucide-react';

export const EmptySlot: React.FC = () => {
    return (
        <div className="h-full w-full flex flex-col items-center justify-center p-4">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--nh-border-subtle)] rounded-lg w-full h-full opacity-60 hover:opacity-100 transition-opacity">
                <PackageOpen className="w-12 h-12 text-[var(--nh-text-muted)] opacity-20 mb-2" />
                <span className="text-[var(--nh-text-muted)] font-mono text-sm select-none">
                    Empty Slot
                </span>
            </div>
        </div>
    );
};
