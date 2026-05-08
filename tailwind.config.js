/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        espresso: '#21130f',
        walnut: '#372016',
        burgundy: '#4a161a',
        brass: '#b88a3d',
        paper: '#d8c09a',
        ivory: '#f2e6cf',
        smoke: '#6f6253',
        teal: '#476f67',
        police: '#2f4a66',
        crimson: '#8b1f24',
      },
      boxShadow: {
        dossier: '0 18px 50px rgba(0,0,0,0.45)',
        card: '0 10px 25px rgba(25, 12, 8, 0.35)',
        glow: '0 0 20px rgba(184,138,61,0.22)',
      },
      fontFamily: {
        display: ['Georgia', 'Songti SC', 'SimSun', 'serif'],
        body: ['Inter', 'system-ui', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['Courier New', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
