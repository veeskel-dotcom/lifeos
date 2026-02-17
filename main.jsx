import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './theme/index.css';
import './theme/ios-overrides.css';
import './lib/storageHealth'; // активировать QuotaExceeded handler

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
