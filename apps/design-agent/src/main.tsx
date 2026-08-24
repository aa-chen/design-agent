import './shims/node-globals';
import 'antd/dist/reset.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { ThemeProvider } from './theme/ThemeProvider';

/** 首屏渲染前同步主题，避免浅色闪烁 */
function syncThemeFromStorage() {
  try {
    const raw = localStorage.getItem('design-agent-theme');
    if (!raw) return;
    const parsed = JSON.parse(raw) as { state?: { mode?: string } };
    if (parsed.state?.mode === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.dataset.theme = 'dark';
    }
  } catch {
    /* ignore */
  }
}

syncThemeFromStorage();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
