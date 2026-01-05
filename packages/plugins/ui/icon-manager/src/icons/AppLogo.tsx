import type { LucideProps } from 'lucide-react';
import type { FC } from 'react';

/**
 * App Logo (Hexagon with internal geometry)
 * @param size - Size in pixels (default: 24)
 * @param className - Additional CSS classes
 */
export const AppLogo: FC<LucideProps> = ({ size = 24, className, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 320 320"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className={className}
        {...props}
    >
        <path d="M294.564 82.3086V237.69L160 315.381L25.4355 237.69V82.3086L160 4.61816L294.564 82.3086Z" strokeWidth="8" />
        <path d="M135.692 305.846C159.751 253.437 206.645 214.884 263.692 201.145" strokeWidth="4" />
        <path d="M277.755 198.3C284.541 197.183 291.45 196.411 298.462 196M298.462 196C298.508 195.997 297.846 195.975 298.462 196Z" strokeWidth="4" />
        <path d="M75.0768 49.2308C81.911 59.1451 84.923 69.5092 84.923 82.4615C84.923 116.448 57.3713 144 23.3845 144" strokeWidth="4" />
        <path d="M21.8462 100.615C66.8588 102.376 109.148 113.076 147.056 131.036" strokeWidth="4" />
        <path d="M227.777 185.693C247.757 204.509 265.225 225.956 279.692 249.538" strokeWidth="4" />
        <path d="M144.923 218.462C131.534 228.09 116.879 235.819 100.923 241.538" strokeWidth="4" />
        <path d="M212.615 112C214.377 102.153 215.077 92.3361 215.077 81.8462C215.077 62.7204 214.819 47.6595 209 30.5" strokeWidth="4" />
        <path d="M79.3847 248C68.9981 250.478 58.6094 251.952 47.6924 252.615" strokeWidth="4" />
        <path d="M146.769 168.923C145.312 164.486 144.585 160.62 144.585 155.692C144.585 130.882 164.574 110.769 189.231 110.769C213.888 110.769 233.877 130.882 233.877 155.692C233.877 175.941 221.377 192.543 203.077 198.154" strokeWidth="3" />
        <path d="M142.596 172.923C140.471 167.368 139.692 162.001 139.692 155.692C139.692 128.163 161.872 105.846 189.231 105.846C216.59 105.846 238.769 128.163 238.769 155.692C238.769 179.044 223.388 198.281 201.846 203.692" strokeWidth="3" />
        <circle cx="89.2308" cy="243.077" r="11.6923" strokeWidth="3" />
        <circle cx="3.07692" cy="3.07692" r="3.07692" transform="matrix(-1 0 0 1 112 245.538)" fill="currentColor" />
        <circle cx="8" cy="8" r="8" transform="matrix(-1 0 0 1 278.769 191.385)" strokeWidth="3" />
        <circle cx="6.15385" cy="6.15385" r="6.15385" transform="matrix(-1 0 0 1 194.462 84.3077)" strokeWidth="4" />
        <circle cx="168.923" cy="194.769" r="34.7692" strokeWidth="4" />
    </svg>
);
