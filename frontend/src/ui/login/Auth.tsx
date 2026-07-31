import React, { useEffect, useState } from 'react';
import { useLoginContext } from '../../hooks/useLoginContext';

/** developer credits */
const NICKNAMES = ['Anatolij', 'Daniel', 'Lukas', 'Maryam', 'Moritz'] as const;
const getRandomNickname = (currentNickname?: string): string => {
    let availableNicknames: readonly string[] = NICKNAMES;

    if (currentNickname) {
        availableNicknames = NICKNAMES.filter(
            (nickname) => nickname !== currentNickname
        );
    }

    return (
        availableNicknames[
            Math.floor(Math.random() * availableNicknames.length)
        ] ?? NICKNAMES[0]
    );
};

// TODO add proper login / auth logic here
export const AuthInputs: React.FC = () => {
    const { nicknameRef, setAvatar } = useLoginContext();
    const [nickname, setNickname] = useState(getRandomNickname);
    const updateNickname = (value: string) => {
        setNickname(value);
        nicknameRef.current = value;
    };

    useEffect(() => {
        nicknameRef.current = nickname;
        /** Update the avatar according to the selected nickname */
        if (nickname === 'Maryam') {
            setAvatar('false');
        } else {
            setAvatar('true');
        }
    }, [nickname, nicknameRef, setAvatar]);

    return (
        <>
            <input id='email' type='text' placeholder='Email' />
            <input id='password' type='password' placeholder='Password' />
            <div className='nickname-field'>
                <label htmlFor='nickname'>Nickname</label>
                <div className='nickname-row'>
                    <input
                        id='nickname'
                        className='nickname-input'
                        name='nickname'
                        type='text'
                        placeholder='Choose a nickname'
                        autoComplete='nickname'
                        spellCheck='false'
                        value={nickname}
                        onChange={(event) => updateNickname(event.target.value)}
                    />
                    <button
                        className='nickname-randomize'
                        type='button'
                        aria-label='Choose a random nickname'
                        title='Choose a random nickname'
                        onClick={() =>
                            updateNickname(getRandomNickname(nickname))
                        }
                    >
                        <span
                            className='nickname-randomize-icon'
                            aria-hidden='true'
                        >
                            🎲
                        </span>
                    </button>
                </div>
            </div>
        </>
    );
};
