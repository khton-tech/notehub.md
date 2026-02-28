export interface TranslationVariables {
    [key: string]: string | number | boolean;
}

export interface I18nTranslations {
    [key: string]: string | I18nTranslations;
}

export type I18nNamespace = Record<string, I18nTranslations>;
