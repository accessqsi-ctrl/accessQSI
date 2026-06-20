const express = require("express");
const path = require("path");
const { PassThrough, Readable } = require("stream");

const SRC_MARKER = "/BackendAccessQ/src/";

exports.clearSrcModules = () => {
    for (const key of Object.keys(require.cache)) {
        if (key.includes(SRC_MARKER)) {
            delete require.cache[key];
        }
    }
};

exports.mockModule = (modulePath, exportsValue) => {
    const resolved = require.resolve(path.resolve(process.cwd(), modulePath));
    require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports: exportsValue
    };
};

exports.mockPackage = (packageName, exportsValue) => {
    const resolved = require.resolve(packageName);
    require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports: exportsValue
    };
};

exports.authAs = (user) => {
    return (req, res, next) => {
        req.user = typeof user === "function" ? user() : user;
        next();
    };
};

exports.mountRouter = (basePath, router) => {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(basePath, router);
    app.use((err, req, res, next) => {
        res.status(500).json({ success: false, message: err.message });
    });
    return app;
};

exports.request = async (app, method, url, body, options = {}) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = new Readable({
        read() {
            this.push(payload);
            this.push(null);
        }
    });

    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = body
        ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) }
        : {};
    req.cookies = options.cookies || {};
    req.socket = new PassThrough();
    req.socket.encrypted = false;

    const headers = {};
    const chunks = [];

    const res = {
        statusCode: 200,
        locals: {},
        setHeader(name, value) {
            headers[name.toLowerCase()] = value;
        },
        getHeader(name) {
            return headers[name.toLowerCase()];
        },
        getHeaders() {
            return { ...headers };
        },
        removeHeader(name) {
            delete headers[name.toLowerCase()];
        },
        writeHead(statusCode, values) {
            this.statusCode = statusCode;
            if (values) {
                for (const [name, value] of Object.entries(values)) {
                    this.setHeader(name, value);
                }
            }
        },
        write(chunk) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        },
        end(chunk) {
            if (chunk) this.write(chunk);
            this.finished = true;
            this.writableEnded = true;
            this._resolve();
        },
        download(filePath, filename, callback) {
            this.statusCode = this.statusCode || 200;
            this.setHeader("content-disposition", `attachment; filename="${filename}"`);
            this.end(JSON.stringify({ downloaded: true, filePath, filename }));
            if (callback) callback();
        }
    };

    await new Promise((resolve, reject) => {
        res._resolve = resolve;
        app.handle(req, res, reject);
    });

    const text = Buffer.concat(chunks).toString("utf8");
    let parsedBody = null;
    if (text) {
        try {
            parsedBody = JSON.parse(text);
        } catch {
            parsedBody = text;
        }
    }

    return {
        status: res.statusCode,
        body: parsedBody
    };
};
