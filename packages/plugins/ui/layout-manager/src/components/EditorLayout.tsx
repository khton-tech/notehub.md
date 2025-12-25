import React from 'react';
import { Controller } from '@notehub/controllers-manager';

export const EditorLayout: React.FC = () => {
    return (
        <div style={{
            display: 'grid',
            height: '100vh',
            width: '100vw',
            gridTemplateAreas: `
                "ribbon sidebar main"
                "status status  status"
            `,
            gridTemplateColumns: '48px 250px 1fr',
            gridTemplateRows: '1fr 24px',
            color: 'var(--nh-text-primary)'
        }}>
            {/* Ribbon Area */}
            <div style={{ gridArea: 'ribbon' }} className="border-r border-[var(--nh-border-subtle)] bg-[var(--nh-bg-sidebar)] flex flex-col items-center py-2 gap-2">
                <Controller type="ribbon-placeholder" />
            </div>

            {/* Sidebar Area */}
            <div style={{ gridArea: 'sidebar' }} className="border-r border-[var(--nh-border-subtle)] bg-[var(--nh-bg-sidebar)]">
                <Controller type="explorer-placeholder" />
            </div>

            {/* Main Area */}
            <div style={{ gridArea: 'main' }} className="bg-[var(--nh-bg-main)]">
                <Controller type="editor-placeholder" />
            </div>

            {/* Status Area */}
            <div style={{ gridArea: 'status' }}>
                <Controller type="status-bar" props={{ status: 'ready' }} />
            </div>
        </div>
    );
};
