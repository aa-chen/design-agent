import { DesignProvider } from '@da/ui';
import 'antd/dist/reset.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesignProvider>
      <App />
    </DesignProvider>
  </React.StrictMode>,
);
