import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Suppress known browser extension errors in development
if (import.meta.env.DEV) {
  const originalError = console.error;
  console.error = (...args) => {
    if (
      args.length > 0 &&
      typeof args[0] === 'string' &&
      (args[0].includes('message channel closed before a response was received') ||
       args[0].includes('A listener indicated an asynchronous response'))
    ) {
      // Suppress these browser extension errors only
      return;
    }
    originalError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
