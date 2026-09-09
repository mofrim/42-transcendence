export const MAP_MODEL_PATH = '/glb/42WOB_v6.glb';
export const EVENT_SPACE_DOOR_A_PATH = '/glb/ES_DOOR_A.glb';
export const EVENT_SPACE_DOOR_B_PATH = '/glb/ES_DOOR_B.glb';
export const CLOUDS_PATH = '/glb/Clouds1.glb';
export const ROCKS_BORDER_PATH = '/glb/RocksBorder4.glb';

/** all both gender */
export function getPlayerModelPath(character: boolean): string {
    if (character) {
        return '/glb/Main_Male.glb';
    }

    return '/glb/Main_Female.glb';
}
