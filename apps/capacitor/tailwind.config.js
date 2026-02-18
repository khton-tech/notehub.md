/** @type {import('tailwindcss').Config} */
export default {
    presets: [require('../../packages/shared/tailwind-preset.js')],
    content: [
        "./src/**/*.{ts,tsx}",
        "../../packages/plugins/**/src/**/*.{ts,tsx}",
        "./index.html"
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}
