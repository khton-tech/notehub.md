// Shared Tailwind preset with NH design tokens
module.exports = {
  theme: {
    extend: {
      colors: {
        nh: {
          main: 'var(--nh-bg-main)',
          sidebar: 'var(--nh-bg-sidebar)',
          surface: 'var(--nh-bg-surface)',
          secondary: 'var(--nh-bg-secondary)',
          hover: 'var(--nh-bg-hover)',
          accent: 'var(--nh-accent-primary)',
          'accent-sec': 'var(--nh-accent-secondary)',
          danger: 'var(--nh-danger)',
          glass: 'var(--nh-glass-bg)',
        },
        'nh-text': {
          DEFAULT: 'var(--nh-text-primary)',
          secondary: 'var(--nh-text-secondary)',
          muted: 'var(--nh-text-muted)',
          error: 'var(--nh-text-error)',
        },
        'nh-border': {
          DEFAULT: 'var(--nh-border-secondary)',
          subtle: 'var(--nh-border-subtle)',
          accent: 'var(--nh-border-accent)',
          glass: 'var(--nh-glass-border)',
        },
      },
      boxShadow: {
        'nh-sm': 'var(--nh-shadow-sm)',
        'nh-md': 'var(--nh-shadow-md)',
        'nh-lg': 'var(--nh-shadow-lg)',
        'nh-glow': 'var(--nh-panel-glow)',
        'nh-glow-accent-sm': 'var(--nh-glow-accent-sm)',
        'nh-glow-accent': 'var(--nh-glow-accent-md)',
        'nh-glow-accent-lg': 'var(--nh-glow-accent-lg)',
      },
      borderRadius: {
        'nh-sm': '6px',
        'nh': '10px',
        'nh-lg': '14px',
      },
      zIndex: {
        'nh-dropdown': '100',
        'nh-sticky': '200',
        'nh-titlebar': '250',
        'nh-overlay': '300',
        'nh-modal': '400',
        'nh-toast': '500',
      },
      transitionDuration: {
        'nh-fast': '100ms',
        'nh-base': '200ms',
        'nh-slow': '300ms',
      },
      fontFamily: {
        nh: 'var(--nh-font-family)',
        'nh-mono': 'var(--nh-font-family-mono)',
      },
    },
  },
};
