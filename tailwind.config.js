/** @type {import('tailwindcss').Config} */
function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        hub: {
          bg: withOpacity('--hub-bg'),
          surface: withOpacity('--hub-surface'),
          subtle: withOpacity('--hub-subtle'),
          border: withOpacity('--hub-border'),
          'border-strong': withOpacity('--hub-border-strong'),
          muted: withOpacity('--hub-muted'),
          text: withOpacity('--hub-text'),
          link: withOpacity('--hub-link'),
          success: withOpacity('--hub-success'),
          'success-text': withOpacity('--hub-success-text'),
          warning: withOpacity('--hub-warning'),
          'warning-text': withOpacity('--hub-warning-text'),
          danger: withOpacity('--hub-danger'),
          'danger-text': withOpacity('--hub-danger-text'),
          purple: withOpacity('--hub-purple'),
          'purple-text': withOpacity('--hub-purple-text'),
          accent: withOpacity('--hub-accent'),
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
