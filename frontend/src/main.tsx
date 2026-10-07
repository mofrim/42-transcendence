import { ConfigProvider } from 'antd';
import { createRoot } from 'react-dom/client';
import { LoginProvider } from './ui/login/LoginProvider.tsx';
import { AuthProvider } from './ui/login/AuthProvider.tsx';
import { getAppFontFamily, loadAppFont } from './typography.ts';
import App from './App.tsx';

const appFontFamily = getAppFontFamily();
const appTheme = {
    token: {
        fontFamily: appFontFamily,
        fontFamilyCode: appFontFamily,
    },
};

ConfigProvider.config({
    holderRender: (children) => (
        <ConfigProvider theme={appTheme}>{children}</ConfigProvider>
    ),
});

const renderApp = (): void => {
    createRoot(document.getElementById('root')!).render(
        <ConfigProvider theme={appTheme}>
            <AuthProvider>
                <LoginProvider>
                    <App
                        title='ft_transcendence'
                        subtitle={
                            <>
                                42 Wolfsburg Simulator project has been created
                                as part of the 42 curriculum by{' '}
                                <a
                                    href='https://profile-v3.intra.42.fr/users/alice'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                >
                                    alice
                                </a>
                                ,{' '}
                                <a
                                    href='https://profile-v3.intra.42.fr/users/bob'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                >
                                    bob
                                </a>
                                ,{' '}
                                <a
                                    href='https://profile-v3.intra.42.fr/users/freddy'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                >
                                    freddy
                                </a>
                                ,{' '}
                                <a
                                    href='https://profile-v3.intra.42.fr/users/jeff'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                >
                                    jeff
                                </a>
                                ,{' '}
                                <a
                                    href='https://profile-v3.intra.42.fr/users/mandy'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                >
                                    mandy
                                </a>
                                .
                            </>
                        }
                    />
                </LoginProvider>
            </AuthProvider>
        </ConfigProvider>
    );
};

void loadAppFont().then(renderApp, renderApp);
