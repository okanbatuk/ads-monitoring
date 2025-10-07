import { MantineTheme, MantineThemeOverride } from '@mantine/core';

const fontFamily = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

type Theme = MantineTheme & {
  colorScheme: 'light' | 'dark';
  colors: {
    dark: string[];
    gray: string[];
    blue: string[];
    teal: string[];
    indigo: string[];
  };
  black: string;
  lineHeights: {
    md: string | number;
  };
};

interface MyThemeOverride extends MantineThemeOverride {
  globalStyles?: (theme: Theme) => Record<string, any>;
}

export const theme: MyThemeOverride & { colorScheme?: 'light' | 'dark' } = {
  colorScheme: 'light',
  primaryColor: 'indigo',
  fontFamily,
  fontSizes: {
    xs: '0.75rem',   // 12px
    sm: '0.875rem',  // 14px
    md: '1rem',      // 16px
    lg: '1.125rem',  // 18px
    xl: '1.25rem',   // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
  },
  colors: {
    gray: [
      '#f8f9fa',
      '#f1f3f5',
      '#e9ecef',
      '#dee2e6',
      '#ced4da',
      '#adb5bd',
      '#868e96',
      '#495057',
      '#343a40',
      '#212529',
    ],
    blue: [
      '#e7f5ff',
      '#d0ebff',
      '#a5d8ff',
      '#74c0fc',
      '#4dabf7',
      '#339af0',
      '#228be6',
      '#1c7ed6',
      '#1971c2',
      '#1864ab',
    ],
    teal: [
      '#e6fcf5',
      '#c3fae8',
      '#96f2d7',
      '#63e6be',
      '#38d9a9',
      '#20c997',
      '#12b886',
      '#0ca678',
      '#099268',
      '#087f5b',
    ],
    indigo: [
      '#edf2ff',
      '#dbe4ff',
      '#bac8ff',
      '#91a7ff',
      '#748ffc',
      '#5c7cfa',
      '#4c6ef5',
      '#4263eb',
      '#3b5bdb',
      '#364fc7',
    ],
  },
  components: {
    Container: {
      defaultProps: {
        sizes: {
          xs: 540,
          sm: 720,
          md: 960,
          lg: 1140,
          xl: 1320,
        },
      },
    },
    Card: {
      defaultProps: {
        shadow: 'sm',
        radius: 'md',
        p: 'lg',
        withBorder: true,
      },
    },
    Button: {
      defaultProps: {
        size: 'md',
        radius: 'md',
      },
    },
  },
  globalStyles: (theme: Theme) => ({
    '*, *::before, *::after': {
      boxSizing: 'border-box',
    },
    'html, body': {
      height: '100%',
      margin: 0,
      padding: 0,
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    },
    'body': {
      backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[7] : theme.colors.gray[0],
      color: theme.colorScheme === 'dark' ? theme.colors.gray[0] : theme.colors.gray[9],
      lineHeight: theme.lineHeights.md,
      fontSize: theme.fontSizes.md,
    },
    '#root': {
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    },
    'a': {
      color: 'inherit',
      textDecoration: 'none',
      '&:hover': {
        textDecoration: 'underline',
      },
    },
  }),
};
