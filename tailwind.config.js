/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif']
            },
            colors: {
                midnight: '#050505',
                electric: '#2563EB',
                gold: '#F59E0B',
            }
        },
    },
    plugins: [],
}
