// import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LoginProvider } from './ui/login/LoginProvider.tsx';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
    // <StrictMode>
    <LoginProvider>
        <App
            title='ft_transcendence'
            subtitle='42 Wolfsburg Project'
            // version='v0.0.0'
        />
    </LoginProvider>
    // </StrictMode>
);
