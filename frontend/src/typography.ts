import './typography.css';

const APP_FONT_CSS_VARIABLE = '--app-font-family';

export const APP_FONT_WEIGHT_STRONG = 800;

export const getAppFontFamily = (): string => {
    const fontFamily = getComputedStyle(document.documentElement)
        .getPropertyValue(APP_FONT_CSS_VARIABLE)
        .trim();

    return fontFamily || 'sans-serif';
};

export const loadAppFont = async (): Promise<void> => {
    await document.fonts.load(`400 1rem ${getAppFontFamily()}`);
};
