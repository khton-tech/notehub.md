<<<<<<< HEAD

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
=======
import React, { useState, useEffect, useCallback } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { X, Info, AlertTriangle, CheckCircle, AlertOctagon } from 'lucide-react';

export interface Notification {
    id: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
}

interface NotificationContainerProps {
    onRegister: (addNotification: (n: Omit<Notification, 'id'>) => void) => void;
}

const NotificationItem: React.FC<{ notification: Notification; onClose: (id: string) => void }> = ({ notification, onClose }) => {
    useEffect(() => {
        if (notification.duration !== 0) {
            const timer = setTimeout(() => {
                onClose(notification.id);
            }, notification.duration || 3000);
            return () => clearTimeout(timer);
        }
    }, [notification, onClose]);

    const getIcon = () => {
        switch (notification.type) {
            case 'success': return <CheckCircle size={18} className="text-green-400" />;
            case 'warning': return <AlertTriangle size={18} className="text-yellow-400" />;
            case 'error': return <AlertOctagon size={18} className="text-red-400" />;
            default: return <Info size={18} className="text-blue-400" />;
        }
    };

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'var(--nh-bg-surface, #2a2a2a)',
                border: '1px solid var(--nh-border-secondary, #3a3a3a)',
                color: 'var(--nh-text-primary, #e0e0e0)',
                padding: '12px 16px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                minWidth: '280px',
                maxWidth: '400px',
                animation: 'slideIn 0.3s ease-out',
                marginBottom: '8px',
                pointerEvents: 'auto'
            }}
        >
            {getIcon()}
            <span style={{ flex: 1, fontSize: '14px' }}>{notification.message}</span>
            <button
                onClick={() => onClose(notification.id)}
                style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--nh-text-secondary, #a0a0a0)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex'
                }}
            >
                <X size={14} />
            </button>
        </div>
    );
};

export const NotificationContainer: React.FC<NotificationContainerProps> = ({ onRegister }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = useCallback((n: Omit<Notification, 'id'>) => {
        const id = Math.random().toString(36).substr(2, 9);
        setNotifications(prev => [...prev, { ...n, id }]);
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    useEffect(() => {
        onRegister(addNotification);
    }, [onRegister, addNotification]);

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                pointerEvents: 'none' // Allow clicks to pass through container area
            }}
        >
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
            {notifications.map(n => (
                <NotificationItem key={n.id} notification={n} onClose={removeNotification} />
>>>>>>> dc6398e62aa418be5d2acd52a5ef4e9881962f58
            ))}
        </div>
    );
};

<<<<<<< HEAD
export default NotificationContainer;
=======
// Singleton manager to mount/unmount the container
let root: Root | null = null;
let container: HTMLDivElement | null = null;
let notifyFn: ((n: Omit<Notification, 'id'>) => void) | null = null;

export const NotificationManager = {
    mount: () => {
        if (container) return;
        container = document.createElement('div');
        container.id = 'nh-alert-notifications';
        document.body.appendChild(container);
        root = createRoot(container);

        root.render(
            <NotificationContainer
                onRegister={(fn) => {
                    notifyFn = fn;
                }}
            />
        );
    },

    unmount: () => {
        if (root) {
            root.unmount();
            root = null;
        }
        if (container) {
            container.remove();
            container = null;
        }
        notifyFn = null;
    },

    show: (message: string, type: Notification['type'] = 'info', duration = 3000) => {
        if (notifyFn) {
            notifyFn({ message, type, duration });
        } else {
            console.warn('NotificationManager not mounted or ready');
        }
    }
};
>>>>>>> dc6398e62aa418be5d2acd52a5ef4e9881962f58
