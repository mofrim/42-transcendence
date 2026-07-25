import React from 'react';

// TODO add proper login / auth logic here
export const AuthInputs: React.FC = () => {
    return (
        <>
            <input id='email' type='text' placeholder='Email' />
            <input id='password' type='password' placeholder='Password' />
        </>
    );
};
