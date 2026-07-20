import React from 'react';
import { AuthInputs } from './ui/login/Auth';
import { ServerSettings } from './ui/login/ServerSettings';
import { CharacterPreview } from './ui/login/CharacterPreview';
import { PlayerSelect } from './ui/login/PlayerSelect';
import { StartButton, Game } from './ui/login/StartGame';
import { useLoginContext } from './hooks/useLoginContext';

import './App.css';

type AppProps = {
    title: string;
    subtitle: string;
    version: string;
};

const App: React.FC<AppProps> = (props: AppProps) => {
    const { gameRunning } = useLoginContext();

    if (gameRunning) {
        console.log('game running');
        return <Game />;
    }

    return (
        <>
            <div id='login-ui'>
                <div className='login-title'>{props.title}</div>
                <div className='login-subtitle'>
                    {props.subtitle}
                    <br />
                    {props.version}
                </div>
                <AuthInputs />
                <PlayerSelect />
                <CharacterPreview />
                <ServerSettings />

                {/* TODO make this components too! */}
                <label className='terms'>
                    <input type='checkbox' id='privacy-checkbox' />
                    <span>
                        I agree to the
                        <a href='/privacy-policy.html' target='_blank'>
                            Privacy Policy
                        </a>
                    </span>
                </label>
                <label className='terms'>
                    <input type='checkbox' id='tos-checkbox' />
                    <span>
                        I agree to the
                        <a href='/terms.html' target='_blank'>
                            Terms of Service
                        </a>
                    </span>
                </label>

                <StartButton />
            </div>
        </>
    );
};

export default App;
