export const Colors = {
  primary: '#3BA6FF',
  primary600: '#1F8FE8',
  primary100: '#E6F4FF',
  success: '#27AE60',
  error: '#E74C3C',
  warning: '#F39C12',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#7C7C7C',
  lightGray: '#F5F5F5',
  darkGray: '#333333',
  background: '#FFFFFF',
  surface: '#E6F4FF',
  text: '#333333',
  textSecondary: '#7C7C7C',
  border: '#E0E0E0',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    color: Colors.text,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: Colors.text,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  body: {
    fontSize: 16,
    fontWeight: 'normal' as const,
    color: Colors.text,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: 'normal' as const,
    color: Colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    fontWeight: 'normal' as const,
    color: Colors.textSecondary,
  },
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  round: 999,
};