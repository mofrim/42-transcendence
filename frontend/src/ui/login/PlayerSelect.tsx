import { useLoginContext } from '../../hooks/useLoginContext';

// TODO completely move this to in-game ui or, when user-service is ready make
// this edit the settings stored in database

export const PlayerSelect: React.FC = () => {
    const { avatar, setAvatar } = useLoginContext();

    const handleChange = (value: string) => {
        console.log(
            `changing avatar to: ${value === 'true' ? 'Male' : 'Female'}`
        );
        setAvatar(value);
    };

    return (
        <div
            className='player-select'
            role='radiogroup'
            aria-label='Player character selection'
        >
            <label className='player-option'>
                <input
                    type='radio'
                    name='player-character'
                    value='true'
                    onChange={(e) => handleChange(e.target.value)}
                    checked={avatar === 'true'}
                />
                <span>
                    <strong>👨🏻‍💻 Male</strong>
                </span>
            </label>

            <label className='player-option'>
                <input
                    type='radio'
                    name='player-character'
                    value='false'
                    onChange={(e) => handleChange(e.target.value)}
                    checked={avatar === 'false'}
                />
                <span>
                    <strong>👩🏻‍💻 Female</strong>
                </span>
            </label>
        </div>
    );
};
