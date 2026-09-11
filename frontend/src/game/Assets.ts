// Path
const MODEL = '/glb/';
const IMG = '/textures/';

// region: models
export const MODEL_MAP = `${MODEL}42WOB_v6.glb`;
export const MODEL_DOOR_A = `${MODEL}ES_DOOR_A.glb`;
export const MODEL_DOOR_B = `${MODEL}ES_DOOR_B.glb`;
export const MODEL_CLOUDS = `${MODEL}Clouds1.glb`;
export const MODEL_ROCKS = `${MODEL}RocksBorder4.glb`;
export const MODEL_DUCK_DOWN = `${MODEL}Duck_down.glb`;
export const MODEL_DUCK_UP = `${MODEL}Duck_up.glb`;
export const MODEL_DISPLAY = `${MODEL}Display.glb`;
export const MODEL_NPC = `${MODEL}NPC_Man_1.glb`;
export const MODEL_MALE = `${MODEL}Main_Male.glb`;
export const MODEL_FEMALE = `${MODEL}Main_Female.glb`;
// endregion

// region: images
export const IMG_USER_A = `${IMG}UserA.png`;
export const IMG_USER_B = `${IMG}UserB.png`;
export const IMG_GRADIENT = `${IMG}gradientMaps/twoTone2.jpg`;
export const IMG_DISPLAY_INTRA = `${IMG}42_Display_intra.jpg`;
export const IMG_DISPLAY_BOOKING = `${IMG}42_Display_booking.jpg`;
export const IMG_DISPLAY_EVAL = `${IMG}42_Display_eval.jpg`;
export const IMG_DISPLAY_GRAPH = `${IMG}42_Display_graph.jpg`;
export const IMG_VS_BEAM = `${IMG}VS_Beam2.jpg`;
export const IMG_VS = `${IMG}VS_2.png`;
export const IMG_DRAW = `${IMG}Draw.png`;
export const IMG_X = `${IMG}X.jpg`;
export const IMG_O = `${IMG}O.jpg`;
export const IMG_EMPTY = `${IMG}Empty.jpg`;
// endregion

// region: characters
/** all both gender */
export function getPlayerModelPath(character: boolean): string {
    if (character) {
        return MODEL_MALE;
    }

    return MODEL_FEMALE;
}

/** all both gender images */
export function getPlayerImagePath(character: boolean): string {
    if (character) {
        return IMG_USER_A;
    }

    return IMG_USER_B;
}
// endregion
