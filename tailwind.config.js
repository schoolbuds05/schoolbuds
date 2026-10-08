import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
    ],

    theme: {
        extend: {
            colors: {
                portal: {
                    page: 'var(--portal-page)',
                    shell: 'var(--portal-shell-bg)',
                    sidebar: 'var(--portal-sidebar)',
                    'sidebar-heading': 'var(--portal-sidebar-heading)',
                    'sidebar-text': 'var(--portal-sidebar-text)',
                    'sidebar-icon': 'var(--portal-sidebar-icon)',
                    'sidebar-icon-text': 'var(--portal-sidebar-icon-text)',
                    content: 'var(--portal-content)',
                    header: 'var(--portal-header)',
                    card: 'var(--portal-card)',
                    input: 'var(--portal-input)',
                    hover: 'var(--portal-hover)',
                    'accent-soft': 'var(--portal-accent-soft)',
                    'accent-border': 'var(--portal-accent-border)',
                    accent: 'var(--portal-accent)',
                    'accent-hover': 'var(--portal-accent-hover)',
                    text: 'var(--portal-text)',
                    'text-soft': 'var(--portal-text-soft)',
                    'text-muted': 'var(--portal-text-muted)',
                    border: 'var(--portal-border)',
                    'border-strong': 'var(--portal-border-strong)',
                },
                violet: {
                    50: '#fef2f2',
                    100: '#fee2e2',
                    200: '#fecaca',
                    300: '#fca5a5',
                    400: '#f87171',
                    500: '#ef4444',
                    600: '#dc2626',
                    700: '#b91c1c',
                    800: '#991b1b',
                    900: '#7f1d1d',
                    950: '#450a0a',
                },
            },
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
            },
        },
    },

    plugins: [forms],
};
