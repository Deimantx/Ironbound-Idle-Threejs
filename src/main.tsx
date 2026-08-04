import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { PlasmicHost } from './plasmic/PlasmicHost';
import './styles/global.css';

const root = document.getElementById('root')!;
const isPlasmicHost = window.location.pathname.replace(/\/$/, '') === '/plasmic-host';

createRoot(root).render(<StrictMode>{isPlasmicHost ? <PlasmicHost /> : <App />}</StrictMode>);
