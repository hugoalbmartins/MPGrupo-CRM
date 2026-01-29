/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html"
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
  			display: ['Montserrat', 'Inter', 'system-ui', 'sans-serif']
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			'2xl': '1rem',
  			'3xl': '1.5rem'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			chocolate: {
  				50: '#fdf8f3',
  				100: '#f9ede0',
  				200: '#f2d9c0',
  				300: '#e9c097',
  				400: '#dea06c',
  				500: '#d4854b',
  				600: '#c66f3f',
  				700: '#a55635',
  				800: '#7B3F00',
  				900: '#5c3210',
  				950: '#331a08'
  			},
  			gold: {
  				50: '#fdfbf3',
  				100: '#faf5dc',
  				200: '#f5e9b8',
  				300: '#edd88b',
  				400: '#D4AF37',
  				500: '#c9a12e',
  				600: '#b08925',
  				700: '#8f6a20',
  				800: '#755521',
  				900: '#62471f',
  				950: '#38260e'
  			},
  			cream: {
  				50: '#FFFDF8',
  				100: '#FFF9ED',
  				200: '#FFF3DB',
  				300: '#FFEAC4',
  				400: '#FFE0A8',
  				500: '#F5D090'
  			},
  			navy: {
  				50: '#f0f4f8',
  				100: '#d9e2ec',
  				200: '#bcccdc',
  				300: '#9fb3c8',
  				400: '#829ab1',
  				500: '#627d98',
  				600: '#486581',
  				700: '#334e68',
  				800: '#243b53',
  				900: '#0f172a'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			},
  			'fade-in': {
  				from: { opacity: '0' },
  				to: { opacity: '1' }
  			},
  			'slide-up': {
  				from: { opacity: '0', transform: 'translateY(20px)' },
  				to: { opacity: '1', transform: 'translateY(0)' }
  			},
  			'slide-down': {
  				from: { opacity: '0', transform: 'translateY(-20px)' },
  				to: { opacity: '1', transform: 'translateY(0)' }
  			},
  			'scale-in': {
  				from: { opacity: '0', transform: 'scale(0.95)' },
  				to: { opacity: '1', transform: 'scale(1)' }
  			},
  			'shimmer': {
  				'0%': { backgroundPosition: '-200% 0' },
  				'100%': { backgroundPosition: '200% 0' }
  			},
  			'pulse-gold': {
  				'0%, 100%': { boxShadow: '0 0 0 0 rgba(212, 175, 55, 0.4)' },
  				'50%': { boxShadow: '0 0 0 8px rgba(212, 175, 55, 0)' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'fade-in': 'fade-in 0.5s ease-in-out',
  			'slide-up': 'slide-up 0.5s ease-out',
  			'slide-down': 'slide-down 0.5s ease-out',
  			'scale-in': 'scale-in 0.3s ease-out',
  			'shimmer': 'shimmer 2s linear infinite',
  			'pulse-gold': 'pulse-gold 2s ease-in-out infinite'
  		},
  		backdropBlur: {
  			xs: '2px'
  		},
  		boxShadow: {
  			'glass': '0 8px 32px 0 rgba(123, 63, 0, 0.08)',
  			'glass-lg': '0 12px 48px 0 rgba(123, 63, 0, 0.12)',
  			'gold-glow': '0 0 20px rgba(212, 175, 55, 0.35)',
  			'chocolate-glow': '0 0 30px rgba(123, 63, 0, 0.25)',
  			'premium': '0 25px 50px -12px rgba(123, 63, 0, 0.15)',
  			'card': '0 1px 3px rgba(123, 63, 0, 0.08), 0 4px 12px rgba(123, 63, 0, 0.04)'
  		}
  	}
  },
  plugins: [require('tailwindcss-animate')],
};
