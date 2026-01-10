/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        grotesk: ['Space Grotesk', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        background: '#09090B', // Rich Black
        foreground: '#FAFAFA', // Off-white
        card: {
          DEFAULT: '#09090B',
          foreground: '#FAFAFA',
        },
        popover: {
          DEFAULT: '#09090B',
          foreground: '#FAFAFA',
        },
        primary: {
          DEFAULT: '#DFE104', // Acid Yellow
          foreground: '#000000',
        },
        secondary: {
          DEFAULT: '#27272A', // Zinc 800
          foreground: '#FAFAFA',
        },
        muted: {
          DEFAULT: '#27272A',
          foreground: '#A1A1AA', // Zinc 400
        },
        accent: {
          DEFAULT: '#DFE104',
          foreground: '#000000',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        border: '#3F3F46', // "Zinc 700"
        input: '#3F3F46',
        ring: '#DFE104',
      },
      animation: {
        skeleton: 'skeleton-pulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        'skeleton-pulse': {
          '0%, 100%': { opacity: 0.4 },
          '50%': { opacity: 0.7 },
        },
      },
      borderRadius: {
        lg: '0px',
        md: '0px',
        sm: '0px',
      },
      fontSize: {
        // Massive scaling text utilities
        'v-hero': 'clamp(3rem, 12vw, 14rem)',
        'v-h2': 'clamp(2.5rem, 8vw, 6rem)',
        'v-h3': 'clamp(1.5rem, 4vw, 3rem)',
      },
      letterSpacing: {
        tighter: '-0.05em',
        tight: '-0.025em',
      },
      lineHeight: {
        none: '0.8',
        tight: '1.1',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
