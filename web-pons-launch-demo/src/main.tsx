import React from 'react';
import ReactDOM from 'react-dom/client';
import { App, PrivyConnectedApp } from './App';
import { AppProviders } from './providers';
import './styles.css';

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID || '';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {privyAppId ? (
      <AppProviders privyAppId={privyAppId}>
        <PrivyConnectedApp />
      </AppProviders>
    ) : (
      <App
        auth={{
          authenticated: false,
          ready: true,
          walletAddress: '',
          chainId: undefined,
          chainReady: false,
          privyConfigured: false,
          onAuthClick: () => undefined
        }}
      />
    )}
  </React.StrictMode>
);
