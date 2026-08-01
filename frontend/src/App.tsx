import React from 'react';
import { AuthInputs } from './ui/login/Auth';
import { ServerSettings } from './ui/login/ServerSettings';
import { CharacterPreview } from './ui/login/CharacterPreview';
import { MapPreview } from './ui/login/MapPreview';
import { PlayerSelect } from './ui/login/PlayerSelect';
import { StartButton, Game } from './ui/login/StartGame';
import { Agreements } from './ui/login/Agreements';
import { useLoginContext } from './hooks/useLoginContext';

import './App.css';

type AppProps = {
    title: string;
    subtitle: React.ReactNode;
    // version: string;
};

const App: React.FC<AppProps> = (props: AppProps) => {
    const { gameRunning } = useLoginContext();

    if (gameRunning) {
        console.log('game running');
        return <Game />;
    }

    return (
        <>
            <MapPreview />
            <div id='login-ui'>
                <div className='login-title'>{props.title}</div>
                <div className='login-subtitle'>
                    {props.subtitle}
                    {/* <br /> */}
                    {/* {props.version} */}
                </div>
                <AuthInputs />
                <PlayerSelect />
                <CharacterPreview />
                <ServerSettings />
                <Agreements />
                <StartButton />
            </div>
        </>
    );
};

export default App;
