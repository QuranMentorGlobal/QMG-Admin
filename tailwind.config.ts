import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        green: {
          DEFAULT: '#B8952A',
          dark:    '#0B0B0B',
          mid:     '#D4AF50',
          light:   '#F7F1E2',
        },
        gold: {
          DEFAULT: '#B8952A',
          light:   '#D4AF50',
          pale:    '#F0E4B8',
        },
        cream: {
          DEFAULT: '#F5F0E8',
          dark:    '#EDE6D6',
        },
        ink: {
          DEFAULT: '#1A1A1A',
          mid:     '#3D3D3D',
          light:   '#6B6B6B',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body:    ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
