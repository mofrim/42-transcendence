import { useAuth } from '../../hooks/useAuthContext';

// TODO add proper login / auth logic here
export const AuthInputs: React.FC = () => {
    const { user } = useAuth();

    return (
        <>
            <input id='email' type='email' placeholder='Email' />
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
                        value={user!.nickname}
                    />
                </div>
            </div>
        </>
    );
};
