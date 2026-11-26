import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

// StrictMode liga double-invoke de efeitos em desenvolvimento, o que
// expoe exatamente a classe de bug que `useEngineOpponent` precisa evitar
// (duas buscas disparadas para a mesma posicao). Ver o comentario em
// `searchingKeyRef` naquele hook.
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
