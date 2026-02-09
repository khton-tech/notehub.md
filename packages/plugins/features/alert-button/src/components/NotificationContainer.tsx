
import React, { useState, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';

export const NotificationManager = {
    show: (message: string, type: 'info' | 'success' | 'error' = 'info') => {
        const event = new CustomEvent('alert-system:notify', {
            detail: { message, type, id: Date.now() }
        });
        window.dispatchEvent(event);
    },
    mount: () => {
        if (!document.getElementById('nh-notification-container')) {
            const container = document.createElement('div');
            container.id = 'nh-notification-container';
            document.body.appendChild(container);
            const root = createRoot(container);
            root.render(<NotificationContainer />);
            (window as any).__nhNotificationRoot = root;
        }
    },
    unmount: () => {
        const container = document.getElementById('nh-notification-container');
        if (container) {
            const root = (window as any).__nhNotificationRoot as Root;
            if (root) {
                root.unmount();
                delete (window as any).__nhNotificationRoot;
            }
            container.remove();
        }
    }
};

const NotificationContainer: React.FC = () => {
    const [notifications, setNotifications] = useState<Array<{ id: number, message: string, type: string }>>([]);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            setNotifications(prev => [...prev, detail]);
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== detail.id));
            }, 3000);
        };
        window.addEventListener('alert-system:notify', handler);
        return () => window.removeEventListener('alert-system:notify', handler);
    }, []);

    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
        }}>
            {notifications.map(n => (
                <div key={n.id} style={{
                    padding: '12px 20px',
                    borderRadius: '8px',
                    background: n.type === 'error' ? '#ff4d4f' : n.type === 'success' ? '#52c41a' : '#1890ff',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    animation: 'fadeIn 0.3s ease-out'
                }}>
                    {n.message}
                </div>
            ))}
        </div>
    );
};

export default NotificationContainer;
