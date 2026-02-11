import { SystemPlugin } from '@notehub/core';
import type { PluginManifest } from '@notehub/core';

/**
 * Log levels for message severity classification
 */
export enum LogLevel {
    LOG = 'LOG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    CRITICAL = 'CRITICAL',
}

/**
 * Log entry structure for events
 */
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    source: string;
    message: string;
}

/**
 * LoggerPlugin - Centralized logging system
 *
 * Provides a unified API for logging messages across the application.
 * All log messages are formatted and emitted as events for UI consumption.
 *
 * API Methods:
 * - `logger:log` - Log a message with specified level
 * - `logger:info` - Convenience wrapper for INFO level
 * - `logger:warn` - Convenience wrapper for WARN level
 * - `logger:error` - Convenience wrapper for ERROR level
 *
 * Events:
 * - `sys:log` - Emitted on every log call with LogEntry payload
 */
export class LoggerPlugin extends SystemPlugin {
    readonly manifest: PluginManifest = {
        id: 'nh.system.logger',
        name: 'Logger',
        version: '0.0.0',
        type: 'system',
    };

    /**
     * Format a log entry as a string
     * Format: [ISO-TIME] [LEVEL] [SOURCE] Message
     */
    private formatMessage(level: LogLevel, source: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] [${source}] ${message}`;
    }

    /**
     * Create a LogEntry object
     */
    private createEntry(level: LogLevel, source: string, message: string): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            source,
            message,
        };
    }

    /**
     * Core logging method - uses console directly since this IS the logger.
     * Overrides SystemPlugin.log() to avoid recursive calls.
     */
    private selfLog(level: LogLevel, source: string, message: string): void {
        const formattedMessage = this.formatMessage(level, source, message);
        const entry = this.createEntry(level, source, message);

        // Output to console based on level
        switch (level) {
            case LogLevel.ERROR:
            case LogLevel.CRITICAL:
                console.error(formattedMessage);
                break;
            case LogLevel.WARN:
                console.warn(formattedMessage);
                break;
            case LogLevel.INFO:
            case LogLevel.LOG:
            default:
                console.log(formattedMessage);
                break;
        }

        // Emit event for UI consumption (e.g., Developer Console)
        this.app.events.emit('sys:log', entry);
    }

    // =============== API Method Handlers ===============

    /**
     * API handler for logger:log
     */
    private handleLog = (level: string, source: string, message: string): void => {
        const logLevel = this.parseLevel(level);
        this.selfLog(logLevel, source, message);
    };

    /**
     * API handler for logger:info
     */
    private handleInfo = (source: string, message: string): void => {
        this.selfLog(LogLevel.INFO, source, message);
    };

    /**
     * API handler for logger:warn
     */
    private handleWarn = (source: string, message: string): void => {
        this.selfLog(LogLevel.WARN, source, message);
    };

    /**
     * API handler for logger:error
     */
    private handleError = (source: string, message: string): void => {
        this.selfLog(LogLevel.ERROR, source, message);
    };

    /**
     * Parse string to LogLevel, defaults to LOG for unknown values
     */
    private parseLevel(level: string): LogLevel {
        const normalized = level.toUpperCase();
        if (Object.values(LogLevel).includes(normalized as LogLevel)) {
            return normalized as LogLevel;
        }
        console.warn(`[Logger] Unknown log level: "${level}", defaulting to LOG`);
        return LogLevel.LOG;
    }

    // =============== Plugin Lifecycle ===============

    protected async onLoad(): Promise<void> {
        // Register API methods
        this.registerApi('logger:log', this.handleLog);
        this.registerApi('logger:info', this.handleInfo);
        this.registerApi('logger:warn', this.handleWarn);
        this.registerApi('logger:error', this.handleError);

        // Log our own initialization
        this.selfLog(LogLevel.INFO, 'Logger', 'Logger plugin initialized');
    }

    protected async onUnload(): Promise<void> {
        this.selfLog(LogLevel.INFO, 'Logger', 'Logger plugin unloading');
    }
}

// Default export for dynamic loading
export default LoggerPlugin;
