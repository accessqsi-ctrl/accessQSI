const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "../..");
let cachedKeys = null;

const normalizePem = (value) => String(value || "").trim().replace(/\\n/g, "\n");

const readCandidate = (inlineValue, configuredPath, defaultFilename) => {
    const inlinePem = normalizePem(inlineValue);
    if (inlinePem) {
        try { crypto.createPrivateKey(inlinePem); return inlinePem; } catch {}
        try { crypto.createPublicKey(inlinePem); return inlinePem; } catch {}
    }
    const filename = configuredPath || defaultFilename;
    const resolvedPath = path.isAbsolute(filename) ? filename : path.resolve(projectRoot, filename);
    return fs.existsSync(resolvedPath) ? fs.readFileSync(resolvedPath, "utf8").trim() : "";
};

const loadKeys = () => {
    if (cachedKeys) return cachedKeys;
    const privatePem = readCandidate(process.env.PRIVATE_KEY, process.env.PRIVATE_KEY_PATH, "private.pem");
    const publicPem = readCandidate(process.env.PUBLIC_KEY, process.env.PUBLIC_KEY_PATH, "public.pem");
    let privateKey;
    let publicKey;
    try {
        privateKey = crypto.createPrivateKey(privatePem);
        publicKey = crypto.createPublicKey(publicPem);
    } catch (error) {
        throw new Error(`Configuration JWT RSA invalide. Configurez PRIVATE_KEY_PATH et PUBLIC_KEY_PATH avec des fichiers PEM valides. (${error.code || error.message})`);
    }
    if (privateKey.asymmetricKeyType !== "rsa" || publicKey.asymmetricKeyType !== "rsa") throw new Error("Les clés JWT doivent être RSA pour RS256.");
    const derived = crypto.createPublicKey(privateKey).export({ type: "spki", format: "pem" });
    const supplied = publicKey.export({ type: "spki", format: "pem" });
    if (derived !== supplied) throw new Error("PRIVATE_KEY et PUBLIC_KEY ne forment pas la même paire RSA.");
    cachedKeys = { privateKey, publicKey };
    return cachedKeys;
};

exports.getPrivateKey = () => loadKeys().privateKey;
exports.getPublicKey = () => loadKeys().publicKey;
exports.validateJwtKeys = () => Boolean(loadKeys());
