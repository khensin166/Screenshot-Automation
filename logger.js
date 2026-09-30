/**
 * logger.js
 * Utilitas logging terstruktur untuk Screenshot Service.
 * Setiap log akan dicetak dalam format JSON agar mudah dibaca
 * oleh sistem monitoring manapun (Loki, Datadog, dsb).
 */

const LOG_LEVELS = {
    DEBUG: 'DEBUG',
    INFO:  'INFO',
    WARN:  'WARN',
    ERROR: 'ERROR',
};

/**
 * Mencetak log terstruktur ke console.
 * @param {string} level   - Level log (DEBUG, INFO, WARN, ERROR)
 * @param {string} message - Pesan utama log
 * @param {object} [meta]  - Data tambahan (opsional)
 */
function log(level, message, meta = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta,
    };

    // Error dan Warning dicetak ke stderr, lainnya ke stdout
    if (level === LOG_LEVELS.ERROR || level === LOG_LEVELS.WARN) {
        console.error(JSON.stringify(entry));
    } else {
        console.log(JSON.stringify(entry));
    }
}

const logger = {
    debug: (message, meta)  => log(LOG_LEVELS.DEBUG, message, meta),
    info:  (message, meta)  => log(LOG_LEVELS.INFO,  message, meta),
    warn:  (message, meta)  => log(LOG_LEVELS.WARN,  message, meta),
    error: (message, meta)  => log(LOG_LEVELS.ERROR, message, meta),
};

module.exports = logger;
