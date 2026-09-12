import React from 'react';
import { UserInfo } from './ui/login/UserInfo';
import { AuthCard } from './ui/login/AuthCard';
import { CharacterPreview } from './ui/login/PreviewCharacter';
import { MapPreview } from './ui/login/PreviewMap';
import { PlayerSelect } from './ui/login/PlayerSelect';
import { Agreements } from './ui/login/Agreements';
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
    // TODO extend with registration possibility
    // TODO either put agreemnents here or in the next view
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
        <>
            <MapPreview />
            <div id='login-ui'>
                <div className='login-title'>{props.title}</div>
                <div className='login-subtitle'>{props.subtitle}</div>
                <UserInfo />
                <PlayerSelect />
                <CharacterPreview />
                <Agreements />
                <button
                    id='start-btn'
                    onClick={() => {
                        setIsSpectator(false);
                        setGameRunning(true);
                    }}
                >
                    ENTER
                </button>
            </div>
        </>
    );
};

export default App;
