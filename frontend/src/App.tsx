import React from 'react';
import { UserInfo } from './ui/login/UserInfo';
import { AuthCard } from './ui/login/AuthCard';
import { CharacterPreview } from './ui/login/CharacterPreview';
import { MapPreview } from './ui/login/MapPreview';
import { PlayerSelect } from './ui/login/PlayerSelect';
import { StartButton, Game } from './ui/login/StartGame';
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

const App: React.FC<AppProps> = (props: AppProps) => {
    const { gameRunning, setGameRunning } = useLoginContext();
    const { user } = useAuth();

    // logout reset effect
    React.useEffect(() => {
        if (user == null && gameRunning) {
            setGameRunning(false);
        }
    }, [user, gameRunning, setGameRunning]);

    if (gameRunning && user != null) {
        console.log('game running');
        return <Game nickname={user.nickname} />;
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
                <StartButton />
            </div>
        </>
    );
};

export default App;
