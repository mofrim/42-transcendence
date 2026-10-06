import React from 'react';
import { AuthCard } from './ui/login/AuthCard';
import { MapPreview } from './ui/login/PreviewMap';
import { Entrance } from './ui/login/Entrance';
import { useLoginContext } from './hooks/useLoginContext';
import { useAuth } from './hooks/useAuthContext';
import axios from 'axios';
import { EventLogProvider } from './contexts/EventLogProvider.tsx';

import './App.css';

type AppProps = {
    title: string;
    subtitle: React.ReactNode;
    // version: string;
};

// make axios send credentials cookies per default for the whole app!
axios.defaults.withCredentials = true;

const LoadGame = React.lazy(() =>
    import('./ui/login/StartGame').then((module) => ({ default: module.Game }))
);

const App: React.FC<AppProps> = (props: AppProps) => {
    const {
        gameRunning,
        setGameRunning,
        isSpectator,
        setIsSpectator,
        serverAddrRef,
    } = useLoginContext();
    const { user, isInitializing } = useAuth();

    // set Addr which is used to connect to our app. this is needed to
    // initialize the socket.io-client with the correct addr.. and makes
    // ServerSettings obsolete!
    // Only done on first mount!
    //
    React.useEffect(() => {
        serverAddrRef.current = window.location.origin;
        console.log(`setting serverAddr to: ${window.location.origin}`);
    }, [serverAddrRef]);

    // logout reset effect
    React.useEffect(() => {
        if (!isInitializing && user == null && gameRunning && !isSpectator) {
            setGameRunning(false);
        }
    }, [user, isInitializing, gameRunning, isSpectator, setGameRunning]);

    if (isInitializing) {
        return null;
    }

    // FIXME unfortunately we still have to load EventLogProvider in
    // spectator-moe to have it available in Game component. but do we really
    // have to?
    if (gameRunning && isSpectator) {
        console.log('spectator mode running');
        return (
            <React.Suspense fallback={null}>
                <EventLogProvider>
                    <LoadGame isSpectator={true} />
                </EventLogProvider>
            </React.Suspense>
        );
    }

    if (gameRunning && user != null) {
        console.log('game running');
        return (
            <React.Suspense fallback={null}>
                <EventLogProvider>
                    <LoadGame isSpectator={false} />
                </EventLogProvider>
            </React.Suspense>
        );
    }

    // user has not logged in yet -> display only login form
    if (user == null) {
        return (
            <>
                <MapPreview />
                <div id='login-ui'>
                    <div className='login-title'>{props.title}</div>
                    <AuthCard />
                    <button
                        id='spectator-btn'
                        type='button'
                        onClick={() => {
                            setIsSpectator(true);
                            setGameRunning(true);
                        }}
                    >
                        SPECTATE
                    </button>
                </div>
            </>
        );
    }

    return (
        <Entrance
            title={props.title}
            subtitle={props.subtitle}
            setIsSpectator={setIsSpectator}
            setGameRunning={setGameRunning}
        />
    );
};

export default App;
