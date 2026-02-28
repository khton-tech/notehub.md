import { SystemPlugin } from '@notehub/core';
import type { PluginManifest, SettingsTabDef, SettingsGroupDef, SettingsItemDef } from '@notehub/core';
import type { TranslationVariables } from './types';
import en from './locales/en';
import ru from './locales/ru';

export class I18nPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.i18n',
        name: 'Translation Service',
        version: '0.1.0',
        type: 'system',
    };

    /** Active language code (e.g. 'en', 'ru') */
    private currentLanguage = 'en';

    /** Nested dictionary of translations: { lang: { namespace: { key: value } } } */
    private registry: Record<string, Record<string, any>> = {};

    protected async onLoad(): Promise<void> {
        this.log('info', 'Loading I18n Plugin...');

        // Register default translations
        this.registerNamespace('i18n', { en: en.i18n, ru: ru.i18n });

        // Register API Methods
        this.registerApi('i18n:register-namespace', this.registerNamespace.bind(this));
        this.registerApi('i18n:t', this.t.bind(this));
        this.registerApi('i18n:set-language', this.setLanguage.bind(this));
        this.registerApi('i18n:get-language', this.getLanguage.bind(this));

        // Load language preference from config-manager
        const savedLanguage = await this.app.api.invoke('config:get', 'window.language', 'en');
        if (typeof savedLanguage === 'string') {
            this.currentLanguage = savedLanguage;
        }

        // Wait a slight tick for Settings Manager to be fully up, then register settings
        setTimeout(() => {
            this.registerSettingsUI();
        }, 500);

        // Listen to config changes (e.g., from settings UI)
        this.registerEvent('config:updated', async (payload: any) => {
            if (payload.key === 'window.language' && payload.value !== this.currentLanguage) {
                this.log('info', `Detected language config change to '${payload.value}'`);
                await this.setLanguage(payload.value);
            }
        });

        this.log('info', `Loaded with default language: ${this.currentLanguage}`);
    }

    protected async onUnload(): Promise<void> {
        this.log('info', 'Unloading I18n Plugin...');
        this.registry = {};

        // Remove settings UI
        this.app.api.invoke('settings:unregister-item', 'window.language');

        this.log('info', 'Unloaded');
    }

    // ========================================================================
    // Core Translation Engine
    // ========================================================================

    /**
     * Set the current language and persist it to config.
     */
    private async setLanguage(lang: string): Promise<void> {
        this.currentLanguage = lang;
        await this.app.api.invoke('config:set', 'window.language', lang);
        this.app.events.emit('i18n:language-changed', { language: lang });
        this.log('info', `Language changed to '${lang}'`);

        // Re-evaluate localized UI elements
        this.registerSettingsUI();
    }

    private getLanguage(): string {
        return this.currentLanguage;
    }

    /**
     * Register a new translation namespace.
     * `translations` should have structure: { en: { ... }, ru: { ... } }
     */
    private registerNamespace(namespace: string, translations: Record<string, any>): void {
        for (const [lang, strings] of Object.entries(translations)) {
            if (!this.registry[lang]) {
                this.registry[lang] = {};
            }
            this.registry[lang][namespace] = strings;
        }
        this.log('info', `Registered namespace: ${namespace}`);

        // Emit an event so UI can re-render if it was waiting for this namespace
        this.app.events.emit('i18n:namespace-registered', { namespace });
    }

    /**
     * Resolve a translation key like "namespace.nested.key"
     */
    private t(key: string, variables?: TranslationVariables): string {
        const parts = key.split('.');
        const namespace = parts[0] || '';
        const path = parts.slice(1);

        // Try current language, fallback to 'en'
        const langsToTry = this.currentLanguage === 'en' ? ['en'] : [this.currentLanguage, 'en'];

        for (const lang of langsToTry) {
            let currentStr: any = this.registry[lang]?.[namespace];

            for (const p of path) {
                if (currentStr && typeof currentStr === 'object') {
                    currentStr = (currentStr as any)[p];
                } else {
                    currentStr = undefined;
                    break;
                }
            }

            if (typeof currentStr === 'string') {
                return this.interpolate(currentStr, variables);
            }
        }

        // Return the key itself if not found
        console.warn(`[I18nPlugin] Translation missing for key: "${key}" (namespace: "${namespace}"). Registry state:`, this.registry);
        return key;
    }

    /**
     * Replace {variable} in strings
     */
    private interpolate(text: string, variables?: TranslationVariables): string {
        if (!variables) return text;
        return text.replace(/{([^{}]+)}/g, (match, key) => {
            const trimmedKey = key.trim();
            return variables[trimmedKey] !== undefined ? String(variables[trimmedKey]) : match;
        });
    }

    // ========================================================================
    // Settings UI Integration
    // ========================================================================

    private registerSettingsUI() {
        // Register Tab (if General doesn't exist, we provide it)
        const tab: SettingsTabDef = {
            id: 'general',
            label: this.t('i18n.settings.generalTab'),
            icon: 'settings-2',
            order: 10,
            category: 'core'
        };
        this.app.api.invoke('settings:register-tab', tab);

        // Register Group
        const group: SettingsGroupDef = {
            id: 'display',
            tabId: 'general',
            label: this.t('i18n.settings.displayGroup'),
            order: 10
        };
        this.app.api.invoke('settings:register-group', group);

        // Register Item
        const item: SettingsItemDef = {
            key: 'window.language',
            type: 'select',
            label: this.t('i18n.settings.languageLabel'),
            description: this.t('i18n.settings.languageDescription'),
            groupId: 'display',
            order: 10,
            options: [
                { label: 'English', value: 'en' },
                { label: 'Русский', value: 'ru' }
            ],
            defaultValue: 'en'
        };
        this.app.api.invoke('settings:register-item', item);
    }
}

export default I18nPlugin;
