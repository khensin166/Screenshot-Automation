/**
 * server.js
 * Screenshot Service - API dinamis untuk mengambil screenshot halaman web.
 * Dapat digunakan dari n8n atau tool automation lainnya via HTTP POST.
 */

const express = require('express');
const puppeteer = require('puppeteer');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 8081;
const SERVICE_VERSION = '2.0.0';

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.json());

// Middleware: Logging setiap request yang masuk
app.use((req, res, next) => {
    const startTime = Date.now();
    res.on('finish', () => {
        logger.info('Request selesai', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: Date.now() - startTime,
        });
    });
    next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Format Response Sukses
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Khusus endpoint screenshot, response langsung berupa binary gambar.
 * Helper ini hanya dipakai untuk endpoint-endpoint non-screenshot (health, dsb).
 */
function successResponse(res, statusCode = 200, data = {}) {
    return res.status(statusCode).json({
        status: 'success',
        ...data,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Format Response Gagal
// ─────────────────────────────────────────────────────────────────────────────
function errorResponse(res, statusCode = 500, message = 'Terjadi kesalahan internal', details = null) {
    const payload = {
        status: 'error',
        message,
    };
    if (details) payload.details = details;
    return res.status(statusCode).json(payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint: Health Check
// GET /health
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    return successResponse(res, 200, {
        service: 'screenshot-service',
        version: SERVICE_VERSION,
        uptime: `${Math.floor(process.uptime())}s`,
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint: Screenshot
// POST /screenshot
// ─────────────────────────────────────────────────────────────────────────────
app.post('/screenshot', async (req, res) => {
    const requestId = `req-${Date.now()}`;

    // ── 1. Validasi & Ekstraksi Parameter ─────────────────────────────────────
    const {
        url,
        viewport       = {},
        auth           = {},
        waitOptions    = {},
        screenshotOptions = {},
    } = req.body || {};

    if (!url) {
        logger.warn('Request ditolak: parameter url tidak ada', { requestId });
        return errorResponse(res, 400, 'Parameter "url" wajib diisi di dalam request body.');
    }

    // Nilai default untuk setiap parameter
    const config = {
        viewport: {
            width:  viewport.width  || 1920,
            height: viewport.height || 1080,
            deviceScaleFactor: viewport.deviceScaleFactor || 1,
        },
        waitUntil:       waitOptions.waitUntil       || 'networkidle0',
        timeout:         waitOptions.timeout          || 60000,
        delayAfterLoad:  waitOptions.delayAfterLoad   || 0,
        waitForSelector: waitOptions.waitForSelector  || null,
        fullPage:        screenshotOptions.fullPage   || false,
        imageType:       screenshotOptions.type       || 'png',
    };

    logger.info('Memulai proses screenshot', {
        requestId,
        url,
        authType: auth.type || 'none',
        config,
    });

    // ── 2. Inisialisasi Browser ───────────────────────────────────────────────
    let browser;
    try {
        logger.debug('Meluncurkan browser Chromium', { requestId });

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
        });

        const page = await browser.newPage();
        await page.setViewport(config.viewport);

        // ── 3. Penanganan Autentikasi ──────────────────────────────────────────
        if (auth.type === 'basic') {
            if (!auth.username || !auth.password) {
                logger.warn('Auth type "basic" dipilih tetapi username/password kosong', { requestId });
                return errorResponse(res, 400, 'Parameter auth.username dan auth.password wajib diisi jika auth.type adalah "basic".');
            }
            const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
            await page.setExtraHTTPHeaders({ 'Authorization': `Basic ${credentials}` });
            logger.info('Autentikasi Basic diterapkan', { requestId, username: auth.username });

        } else if (auth.type === 'header') {
            if (!auth.headers || typeof auth.headers !== 'object') {
                logger.warn('Auth type "header" dipilih tetapi auth.headers kosong atau bukan object', { requestId });
                return errorResponse(res, 400, 'Parameter auth.headers wajib berupa object jika auth.type adalah "header".');
            }
            await page.setExtraHTTPHeaders(auth.headers);
            logger.info('Autentikasi Custom Header diterapkan', { requestId, headerKeys: Object.keys(auth.headers) });
        }

        // ── 4. Navigasi Halaman ────────────────────────────────────────────────
        logger.info(`Membuka URL dan menunggu event: ${config.waitUntil}`, { requestId, url });
        await page.goto(url, { waitUntil: config.waitUntil, timeout: config.timeout });

        // ── 5. Strategi Tunggu Tambahan ────────────────────────────────────────
        if (config.waitForSelector) {
            logger.debug(`Menunggu selector CSS: "${config.waitForSelector}"`, { requestId });
            await page.waitForSelector(config.waitForSelector, { timeout: config.timeout });
            logger.debug(`Selector "${config.waitForSelector}" ditemukan`, { requestId });
        }

        if (config.delayAfterLoad > 0) {
            logger.debug(`Jeda statis selama ${config.delayAfterLoad}ms`, { requestId });
            await new Promise(resolve => setTimeout(resolve, config.delayAfterLoad));
        }

        // ── 6. Proses Screenshot ───────────────────────────────────────────────
        logger.info('Mengambil screenshot...', { requestId, fullPage: config.fullPage, type: config.imageType });
        const screenshotBuffer = await page.screenshot({
            type: config.imageType,
            fullPage: config.fullPage,
        });

        logger.info('Screenshot berhasil. Mengirim response.', {
            requestId,
            imageSizeBytes: screenshotBuffer.length,
        });

        res.set('Content-Type', `image/${config.imageType}`);
        res.set('X-Request-Id', requestId);
        return res.send(screenshotBuffer);

    } catch (error) {
        // ── 7. Penanganan Error ────────────────────────────────────────────────
        logger.error('Gagal mengambil screenshot', {
            requestId,
            url,
            errorName:    error.name,
            errorMessage: error.message,
        });

        // Berikan pesan error yang lebih spesifik berdasarkan jenis error
        if (error.name === 'TimeoutError') {
            return errorResponse(res, 504, 'Halaman gagal dimuat dalam batas waktu yang ditentukan. Coba naikkan nilai waitOptions.timeout.', { timeout: config.timeout });
        }

        return errorResponse(res, 500, 'Terjadi kesalahan internal saat memproses screenshot.', { reason: error.message });

    } finally {
        if (browser) {
            await browser.close();
            logger.debug('Browser Chromium ditutup', { requestId });
        }
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Penanganan Endpoint yang Tidak Dikenal (404)
// ─────────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
    logger.warn('Request ke endpoint yang tidak dikenal', { method: req.method, path: req.path });
    return errorResponse(res, 404, `Endpoint ${req.method} ${req.path} tidak ditemukan.`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    logger.info('Screenshot Service berhasil dijalankan', {
        port: PORT,
        version: SERVICE_VERSION,
        nodeVersion: process.version,
    });
});
