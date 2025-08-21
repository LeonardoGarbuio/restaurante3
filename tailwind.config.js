module.exports = {
  content: ["./pages/*.{html,js}", "./index.html", "./*.html"],
  theme: {
    extend: {
      colors: {
        // Primary Colors - Portuguese flag red
        primary: {
          DEFAULT: "#C41E3A", // Portuguese flag red
          50: "#FDF2F4", // Very light red
          100: "#FCE7EA", // Light red
          200: "#F8CDD3", // Lighter red
          300: "#F2A1AC", // Medium light red
          400: "#E96B7A", // Medium red
          500: "#C41E3A", // Base primary red
          600: "#A8182F", // Darker red
          700: "#8B1426", // Dark red
          800: "#6E101D", // Very dark red
          900: "#520C16", // Darkest red
        },
        // Secondary Colors - Portuguese flag green
        secondary: {
          DEFAULT: "#228B22", // Portuguese flag green
          50: "#F0F9F0", // Very light green
          100: "#E1F3E1", // Light green
          200: "#C3E7C3", // Lighter green
          300: "#94D494", // Medium light green
          400: "#5CB85C", // Medium green
          500: "#228B22", // Base secondary green
          600: "#1E7A1E", // Darker green
          700: "#1A681A", // Dark green
          800: "#155615", // Very dark green
          900: "#104410", // Darkest green
        },
        // Accent Colors - High-contrast orange
        accent: {
          DEFAULT: "#FF6B35", // High-contrast orange
          50: "#FFF4F0", // Very light orange
          100: "#FFE9E1", // Light orange
          200: "#FFD3C3", // Lighter orange
          300: "#FFB394", // Medium light orange
          400: "#FF8F5C", // Medium orange
          500: "#FF6B35", // Base accent orange
          600: "#E55A2B", // Darker orange
          700: "#CC4A21", // Dark orange
          800: "#B33A17", // Very dark orange
          900: "#992A0D", // Darkest orange
        },
        // Background Colors
        background: "#FFFEF7", // Warm cream
        surface: "#F5F5DC", // Subtle beige
        // Text Colors
        text: {
          primary: "#2C1810", // Dark brown
          secondary: "#5D4E37", // Medium brown
        },
        // Status Colors
        success: {
          DEFAULT: "#32CD32", // Fresh green
          50: "#F0FFF0", // Very light success green
          100: "#E1FFE1", // Light success green
          200: "#C3FFC3", // Lighter success green
          300: "#94FF94", // Medium light success green
          400: "#5CFF5C", // Medium success green
          500: "#32CD32", // Base success green
          600: "#2BB82B", // Darker success green
          700: "#24A324", // Dark success green
          800: "#1D8E1D", // Very dark success green
          900: "#167916", // Darkest success green
        },
        warning: {
          DEFAULT: "#FFD700", // Golden yellow
          50: "#FFFEF0", // Very light warning yellow
          100: "#FFFDE1", // Light warning yellow
          200: "#FFFBC3", // Lighter warning yellow
          300: "#FFF794", // Medium light warning yellow
          400: "#FFF15C", // Medium warning yellow
          500: "#FFD700", // Base warning yellow
          600: "#E5C200", // Darker warning yellow
          700: "#CCAD00", // Dark warning yellow
          800: "#B39800", // Very dark warning yellow
          900: "#998300", // Darkest warning yellow
        },
        error: {
          DEFAULT: "#DC143C", // Clear red
          50: "#FDF2F4", // Very light error red
          100: "#FCE7EA", // Light error red
          200: "#F8CDD3", // Lighter error red
          300: "#F2A1AC", // Medium light error red
          400: "#E96B7A", // Medium error red
          500: "#DC143C", // Base error red
          600: "#C41235", // Darker error red
          700: "#AC102E", // Dark error red
          800: "#940E27", // Very dark error red
          900: "#7C0C20", // Darkest error red
        },
      },
      fontFamily: {
        'playfair': ['Playfair Display', 'serif'],
        'open-sans': ['Open Sans', 'sans-serif'],
        'montserrat': ['Montserrat', 'sans-serif'],
        'dancing': ['Dancing Script', 'cursive'],
        'sans': ['Open Sans', 'sans-serif'],
        'serif': ['Playfair Display', 'serif'],
      },
      fontSize: {
        'hero': ['3.5rem', { lineHeight: '1.1', fontWeight: '700' }],
        'heading-xl': ['2.5rem', { lineHeight: '1.2', fontWeight: '600' }],
        'heading-lg': ['2rem', { lineHeight: '1.3', fontWeight: '600' }],
        'heading-md': ['1.5rem', { lineHeight: '1.4', fontWeight: '600' }],
        'cta': ['1.125rem', { lineHeight: '1.5', fontWeight: '700' }],
      },
      boxShadow: {
        'cta': '0 4px 12px rgba(196, 30, 58, 0.15)',
        'cta-hover': '0 6px 16px rgba(196, 30, 58, 0.2)',
        'food-card': '0 2px 8px rgba(0, 0, 0, 0.1)',
        'food-card-hover': '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      transitionDuration: {
        '250': '250ms',
      },
      transitionTimingFunction: {
        'ease-in-out': 'ease-in-out',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}