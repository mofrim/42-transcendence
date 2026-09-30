import type { Character, PublicUserProfile } from 'ftr-common/sharedTypes';

import { CharacterPreviewView } from '../login/PreviewCharacter';

export const PROFILE_PANEL_ID = 'game-profile-panel';

type ProfilePanelProps = {
    readonly character: Character;
    readonly email: string;
    readonly isLoading: boolean;
    readonly isLoggingOut: boolean;
    readonly isOpen: boolean;
    readonly loadFailed: boolean;
    readonly nickname: string;
    readonly publicProfile: PublicUserProfile | null;
    readonly selectedNickname: string;
    readonly canLogout: boolean;
    readonly onLogout: () => Promise<void>;
};

export function ProfilePanel({
    character,
    email,
    isLoading,
    isLoggingOut,
    isOpen,
    loadFailed,
    nickname,
    publicProfile,
    selectedNickname,
    canLogout,
    onLogout,
}: ProfilePanelProps) {
    const isOwnProfile = selectedNickname === nickname;
    let profileNickname = publicProfile?.nickname;
    let profileCharacter = publicProfile?.character;
    let profileAriaLabel = 'Player profile ' + selectedNickname;
    let profileTitle = 'Player Profile';
    let profileStatus = 'Offline';

    if (isOwnProfile) {
        profileNickname = nickname;
        profileCharacter = character;
        profileAriaLabel = 'Your player profile';
        profileTitle = 'Student ID';
    }
    if (publicProfile?.isLoggedIn === true) {
        profileStatus = 'Online';
    }

    return (
        <aside
            id={PROFILE_PANEL_ID}
            className='hud-panel hud-profile-panel'
            aria-label={profileAriaLabel}
            hidden={!isOpen}
        >
            <h2 className='hud-title'>🪪 {profileTitle}</h2>
            {isLoading && (
                <p className='hud-match-history-empty'>Loading profile...</p>
            )}
            {loadFailed && (
                <p className='hud-match-history-empty'>
                    Profile could not be loaded.
                </p>
            )}
            {isOpen && profileCharacter !== undefined && !loadFailed && (
                <CharacterPreviewView
                    character={profileCharacter}
                    className='hud-profile-character-preview'
                    canvasClassName='hud-profile-character-preview-canvas'
                />
            )}
            {profileNickname !== undefined && !loadFailed && (
                <p className='hud-profile-nickname'>
                    <strong>Intraname:</strong> {profileNickname}
                    {isOwnProfile && ' ✏️'}
                </p>
            )}
            {isOwnProfile && (
                <>
                    <p className='hud-profile-email'>
                        <strong>E-Mail:</strong> {email}
                    </p>
                    <button
                        type='button'
                        className='hud-profile-logout'
                        disabled={isLoggingOut || !canLogout}
                        aria-busy={isLoggingOut}
                        onClick={() => void onLogout()}
                    >
                        {isLoggingOut ? 'Logging out…' : '🚪 Logout'}
                    </button>
                </>
            )}
            {!isOwnProfile && publicProfile !== null && (
                <p className='hud-profile-status'>
                    <strong>Status:</strong> {profileStatus}
                </p>
            )}
        </aside>
    );
}
