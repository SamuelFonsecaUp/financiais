import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { FinancialProvider } from './context/FinancialContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FinancialProvider>
      <App />
    </FinancialProvider>
  </React.StrictMode>
);
