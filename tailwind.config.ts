import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-serif', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        border: 'var(--border-default)',
        input: 'var(--border-default)',
        ring: 'var(--ring)',
        background: 'var(--bg-app)',
        foreground: 'var(--text-primary)',
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          active: 'var(--primary-active)',
          soft: 'var(--primary-soft)',
          foreground: 'var(--text-inverse)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          hover: 'var(--secondary-hover)',
          foreground: 'var(--secondary-text)',
          text: 'var(--secondary-text)',
        },
        destructive: {
          DEFAULT: 'var(--error)',
          foreground: 'var(--text-inverse)',
        },
        muted: {
          DEFAULT: 'var(--bg-muted)',
          foreground: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
          foreground: 'var(--text-inverse)',
        },
        popover: {
          DEFAULT: 'var(--bg-surface)',
          foreground: 'var(--text-primary)',
        },
        card: {
          DEFAULT: 'var(--bg-surface)',
          foreground: 'var(--text-primary)',
        },
        surface: {
          DEFAULT: 'var(--bg-surface)',
          secondary: 'var(--bg-surface-secondary)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)',
        },
        success: {
          DEFAULT: 'var(--success)',
          background: 'var(--success-bg)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          background: 'var(--warning-bg)',
        },
        error: {
          DEFAULT: 'var(--error)',
          background: 'var(--error-bg)',
        },
        info: {
          DEFAULT: 'var(--info)',
          background: 'var(--info-bg)',
        },
        medal: {
          gold: 'var(--medal-gold)',
          silver: 'var(--medal-silver)',
          bronze: 'var(--medal-bronze)',
        },
        canvas: '#0F172A',
        'canvas-light': '#162133',
      },
      borderRadius: {
        xl: 'var(--radius-xl)',
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        popover: 'var(--shadow-popover)',
      },
      animation: {
        'drift-1': 'drift-1 14s ease-in-out infinite',
        'drift-2': 'drift-2 18s ease-in-out infinite',
        'drift-3': 'drift-3 12s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
