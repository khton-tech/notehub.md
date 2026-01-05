import type { LucideProps } from 'lucide-react';
import type { FC } from 'react';

/**
 * Plugin Logo (Fragmented Triangle)
 * @param size - Size in pixels (default: 24)
 * @param className - Additional CSS classes
 */
export const PluginLogo: FC<LucideProps> = ({ size = 24, className, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="15 15 280 280"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        className={className}
        {...props}
    >
        <path d="M216.71 188.631L134.113 239.682L114.568 129.459L216.71 188.631Z" />
        <path d="M108.812 99.5042L153.747 29.5889L251.707 182.521L108.812 99.5042Z" />
        <path d="M38.4494 279.908L19.9774 242.177L91.4386 130.343L119.398 279.908L38.4494 279.908Z" />
        <path d="M142.387 281.237L141.268 258.645L234.696 199.739L277.498 224.353L289.482 242.923L272.824 281.237L142.387 281.237Z" />
    </svg>
);
