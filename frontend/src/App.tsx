import React from 'react';
import { UserInfo } from './ui/login/UserInfo';
import { AuthCard } from './ui/login/AuthCard';
import { CharacterPreview } from './ui/login/CharacterPreview';
import { MapPreview } from './ui/login/MapPreview';
import { PlayerSelect } from './ui/login/PlayerSelect';
import { Agreements } from './ui/login/Agreements';
import { useLoginContext } from './hooks/useLoginContext';
import { useAuth } from './hooks/useAuthContext';
import axios from 'axios';

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
    const { gameRunning, setGameRunning, serverAddrRef } = useLoginContext();
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
        if (!isInitializing && user == null && gameRunning) {
            setGameRunning(false);
        }
    }, [user, isInitializing, gameRunning, setGameRunning]);

    if (isInitializing) {
        return null;
    }

    if (gameRunning && user != null) {
        console.log('game running');
        return (
            <React.Suspense fallback={null}>
                <LoadGame nickname={user.nickname} email={user.email} />
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
                <button id='start-btn' onClick={() => setGameRunning(true)}>
                    ENTER
                </button>
            </div>
        </>
    );
};

export default App;
