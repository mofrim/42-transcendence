const INTRO_CUTSCENE_USER_ID_KEY = 'intro-cutscene-user-id';

export function sawShownIntroCutscene(userId: number): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    return (
        window.sessionStorage.getItem(INTRO_CUTSCENE_USER_ID_KEY) ===
        String(userId)
    );
}

export function IntroCutsceneSeen(userId: number): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.sessionStorage.setItem(INTRO_CUTSCENE_USER_ID_KEY, String(userId));
}

export function resetIntroCutsceneSession(): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.sessionStorage.removeItem(INTRO_CUTSCENE_USER_ID_KEY);
}
