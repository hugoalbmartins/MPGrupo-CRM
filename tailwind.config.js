/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html"
  ],
  theme: {
  	extend: {
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
  			},
  			gold: {
  				50: '#fffbeb',
  				100: '#fef3c7',
  				200: '#fde68a',
  				300: '#fcd34d',
  				400: '#fbbf24',
  				500: '#f59e0b',
  				600: '#d97706',
  				700: '#b45309',
  				800: '#92400e',
  				900: '#78350f'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'fade-in': {
  				from: {
  					opacity: '0'
  				},
  				to: {
  					opacity: '1'
  				}
  			},
  			'slide-up': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(20px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'slide-down': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(-20px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'scale-in': {
  				from: {
  					opacity: '0',
  					transform: 'scale(0.95)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'scale(1)'
  				}
  			},
  			'shimmer': {
  				'0%': {
  					backgroundPosition: '-200% 0'
  				},
  				'100%': {
  					backgroundPosition: '200% 0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'fade-in': 'fade-in 0.5s ease-in-out',
  			'slide-up': 'slide-up 0.5s ease-out',
  			'slide-down': 'slide-down 0.5s ease-out',
  			'scale-in': 'scale-in 0.3s ease-out',
  			'shimmer': 'shimmer 2s linear infinite'
  		},
  		backdropBlur: {
  			xs: '2px'
  		},
  		boxShadow: {
  			'glass': '0 8px 32px 0 rgba(15, 23, 42, 0.1)',
  			'glass-lg': '0 12px 48px 0 rgba(15, 23, 42, 0.15)',
  			'gold-glow': '0 0 20px rgba(251, 191, 36, 0.3)',
  			'navy-glow': '0 0 30px rgba(15, 23, 42, 0.4)'
  		}
  	}
  },
  plugins: [require('tailwindcss-animate')],
};