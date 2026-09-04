export const MAP_MODEL_PATH = '/glb/42WOB_v5.glb';

/** all both gender */
export function getPlayerModelPath(character: boolean): string {
    if (character) {
        return '/glb/Main_Male.glb';
    }

    return '/glb/Main_Female.glb';
}
