export const DEFAULT_PLAYER_NICKNAME = 'Player';

export function normalizePlayerNickname(nickname: string): string {
    return nickname.trim() || DEFAULT_PLAYER_NICKNAME;
}
