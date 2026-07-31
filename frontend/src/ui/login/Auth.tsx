import React from 'react';
import { useLoginContext } from '../../hooks/useLoginContext';

// TODO add proper login / auth logic here
export const AuthInputs: React.FC = () => {
    const { nicknameRef } = useLoginContext();

    return (
        <>
            <input id='email' type='text' placeholder='Email' />
            <input id='password' type='password' placeholder='Password' />
            <label className='nickname-field'>
                <span>Nickname</span>
                <input
                    id='nickname'
                    className='nickname-input'
                    name='nickname'
                    type='text'
                    placeholder='Choose a nickname'
                    autoComplete='nickname'
                    spellCheck='false'
                    onChange={(event) => {
                        nicknameRef.current = event.target.value;
                    }}
                />
            </label>
        </>
    );
};
