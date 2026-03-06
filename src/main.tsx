import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, theme, App as AntApp } from 'antd'
import { AuthProvider } from './AuthContext'
import App from './App.tsx'
import './index.css'

// Custom black and white theme tokens
const customTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    // Primary colors - monochrome
    colorPrimary: '#ffffff',
    colorPrimaryBg: '#1a1a1a',
    colorPrimaryBgHover: '#2a2a2a',
    colorPrimaryBorder: '#404040',
    colorPrimaryHover: '#e0e0e0',
    colorPrimaryActive: '#ffffff',
    colorPrimaryText: '#ffffff',
    colorPrimaryTextActive: '#ffffff',

    // Background colors
    colorBgContainer: '#141414',
    colorBgElevated: '#1f1f1f',
    colorBgLayout: '#0a0a0a',
    colorBgSpotlight: '#1a1a1a',

    // Text colors
    colorText: '#ffffff',
    colorTextSecondary: '#a0a0a0',
    colorTextTertiary: '#666666',
    colorTextQuaternary: '#404040',

    // Border colors
    colorBorder: '#303030',
    colorBorderSecondary: '#252525',

    // Success, Warning, Error - kept minimal
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',

    // Other tokens
    borderRadius: 6,
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
  },
  components: {
    Button: {
      colorPrimary: '#ffffff',
      colorPrimaryHover: '#e0e0e0',
      colorPrimaryActive: '#cccccc',
      colorBgContainer: '#1a1a1a',
      colorBorder: '#404040',
      primaryColor: '#000000',
      defaultBg: '#1a1a1a',
      defaultColor: '#ffffff',
      defaultBorderColor: '#404040',
    },
    Card: {
      colorBgContainer: '#141414',
      colorBorderSecondary: '#252525',
    },
    Input: {
      colorBgContainer: '#1a1a1a',
      colorBorder: '#404040',
      colorText: '#ffffff',
      colorTextPlaceholder: '#666666',
    },
    Modal: {
      colorBgElevated: '#1a1a1a',
    },
    Spin: {
      colorPrimary: '#ffffff',
    },
  },
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider theme={customTheme}>
      <AntApp>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
)
