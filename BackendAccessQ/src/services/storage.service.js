const fs = require("fs");
const path = require("path");
const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand
} = require("@aws-sdk/client-s3");

const bundledStaticsRoot = path.resolve(__dirname, "../statics");
const storageRoot = process.env.FILE_STORAGE_ROOT
    ? path.resolve(process.env.FILE_STORAGE_ROOT)
    : bundledStaticsRoot;
const storageDriver = String(process.env.STORAGE_DRIVER || "local").trim().toLowerCase();
const managedAssetDirectories = new Set(["card-backgrounds", "card-logos"]);
let r2Client;

const normalizedPublicBaseUrl = () => String(process.env.R2_PUBLIC_URL || "").trim().replace(/\/+$/, "");

const getR2Config = () => {
    const accountId = String(process.env.R2_ACCOUNT_ID || "").trim();
    const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim();
    const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();
    const bucket = String(process.env.R2_BUCKET || "").trim();
    const publicUrl = normalizedPublicBaseUrl();
    const missing = [
        ["R2_ACCOUNT_ID", accountId],
        ["R2_ACCESS_KEY_ID", accessKeyId],
        ["R2_SECRET_ACCESS_KEY", secretAccessKey],
        ["R2_BUCKET", bucket],
        ["R2_PUBLIC_URL", publicUrl]
    ].filter(([, value]) => !value).map(([name]) => name);

    if (missing.length) throw new Error(`Configuration R2 incomplète : ${missing.join(", ")}.`);

    return {
        bucket,
        publicUrl,
        endpoint: String(process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, ""),
        credentials: { accessKeyId, secretAccessKey }
    };
};

const getR2Client = () => {
    if (!r2Client) {
        const config = getR2Config();
        r2Client = new S3Client({
            region: "auto",
            endpoint: config.endpoint,
            credentials: config.credentials
        });
    }
    return r2Client;
};


const assertPersistentStorageConfigured = () => {
    if (!["local", "r2"].includes(storageDriver)) {
        throw new Error("STORAGE_DRIVER doit être 'local' ou 'r2'.");
    }
    if (storageDriver === "r2") {
        getR2Config();
        return;
    }
    if (process.env.NODE_ENV === "production" && !process.env.FILE_STORAGE_ROOT) {
        throw new Error("FILE_STORAGE_ROOT doit pointer vers un volume persistant en production.");
    }

    fs.mkdirSync(storageRoot, { recursive: true });
    fs.accessSync(storageRoot, fs.constants.R_OK | fs.constants.W_OK);
};

const resolveInside = (root, segments) => {
    const candidate = path.resolve(root, ...segments);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error("Chemin de stockage invalide.");
    }
    return candidate;
};

const storagePath = (...segments) => resolveInside(storageRoot, segments);
const bundledPath = (...segments) => resolveInside(bundledStaticsRoot, segments);
const assertManagedAsset = (directory, filename) => {
    if (!managedAssetDirectories.has(directory)) throw new Error("Répertoire de ressource non autorisé.");
    if (!filename || filename.includes("/") || filename.includes("\\")) throw new Error("Nom de ressource invalide.");
    return `${directory}/${filename}`;
};

const contentTypeForFilename = (filename) => ({
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
}[path.extname(filename).toLowerCase()] || "application/octet-stream");

const publicUrlForKey = (key) => storageDriver === "r2"
    ? `${getR2Config().publicUrl}/${key.split("/").map(encodeURIComponent).join("/")}`
    : `/${key}`;


const ensureDirectory = async (directory) => {
    await fs.promises.mkdir(directory, { recursive: true });
};

const findPublicAsset = (...segments) => {
    let sharedCandidate;
    let bundledCandidate;
    try {
        sharedCandidate = storagePath(...segments);
        bundledCandidate = bundledPath(...segments);
    } catch {
        return null;
    }
    if (fs.existsSync(sharedCandidate)) return sharedCandidate;
    return fs.existsSync(bundledCandidate) ? bundledCandidate : null;
};
const managedKeyFromPublicUrl = (publicUrl, directory) => {
    const normalizedUrl = String(publicUrl || "").split("?")[0].trim();
    const localPrefix = `/${directory}/`;
    if (normalizedUrl.startsWith(localPrefix)) {
        const filename = normalizedUrl.slice(localPrefix.length);
        return assertManagedAsset(directory, filename);
    }
    if (storageDriver !== "r2") return null;

    const publicBase = getR2Config().publicUrl;
    if (!normalizedUrl.startsWith(`${publicBase}/`)) return null;
    const encodedKey = normalizedUrl.slice(publicBase.length + 1);
    let key;
    try {
        key = encodedKey.split("/").map(decodeURIComponent).join("/");
    } catch {
        return null;
    }
    const prefix = `${directory}/`;
    if (!key.startsWith(prefix)) return null;
    return assertManagedAsset(directory, key.slice(prefix.length));
};


const removeFile = async (filePath) => {
    if (!filePath) return;
    try {
        await fs.promises.unlink(filePath);
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
};

const removeManagedPublicAsset = async (publicUrl, directory) => {
    const key = managedKeyFromPublicUrl(publicUrl, directory);
    if (!key) return false;

    if (storageDriver === "r2") {
        const config = getR2Config();
        await getR2Client().send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    } else {
        await removeFile(storagePath(...key.split("/")));
    }
    return true;
};

const bodyToBuffer = async (body) => {
    if (!body) return Buffer.alloc(0);
    if (typeof body.transformToByteArray === "function") return Buffer.from(await body.transformToByteArray());
    const chunks = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
};

const saveUploadedAsset = async ({ directory, filename, contentType, buffer, sourcePath }) => {
    const key = assertManagedAsset(directory, filename);
    const mimeType = contentType || contentTypeForFilename(filename);

    if (storageDriver === "r2") {
        const config = getR2Config();
        const body = buffer || await fs.promises.readFile(sourcePath);
        await getR2Client().send(new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: body,
            ContentType: mimeType,
            CacheControl: "public, max-age=31536000, immutable"
        }));
        if (sourcePath) await removeFile(sourcePath);
        return publicUrlForKey(key);
    }

    const targetPath = storagePath(...key.split("/"));
    if (sourcePath) await moveFile(sourcePath, targetPath);
    else await writeFileAtomically(targetPath, buffer);
    return publicUrlForKey(key);
};

const materializeManagedAsset = async (publicUrl) => {
    const cleanUrl = String(publicUrl || "").trim();
    if (!cleanUrl || cleanUrl.startsWith("data:")) return cleanUrl;

    for (const directory of managedAssetDirectories) {
        const key = managedKeyFromPublicUrl(cleanUrl, directory);
        if (!key) continue;

        if (storageDriver === "r2") {
            const config = getR2Config();
            const result = await getR2Client().send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
            const bytes = await bodyToBuffer(result.Body);
            const mimeType = result.ContentType || contentTypeForFilename(key);
            return `data:${mimeType};base64,${bytes.toString("base64")}`;
        }

        const filePath = findPublicAsset(...key.split("/"));
        if (!filePath || !fs.statSync(filePath).isFile()) return cleanUrl;
        return `data:${contentTypeForFilename(key)};base64,${fs.readFileSync(filePath).toString("base64")}`;
    }

    return cleanUrl;
};

const writeFileAtomically = async (targetPath, content, encoding) => {
    await ensureDirectory(path.dirname(targetPath));
    const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
    try {
        await fs.promises.writeFile(temporaryPath, content, encoding);
        await fs.promises.rename(temporaryPath, targetPath);
    } catch (error) {
        await removeFile(temporaryPath);
        throw error;
    }
};

const moveFile = async (sourcePath, targetPath) => {
    await ensureDirectory(path.dirname(targetPath));
    try {
        await fs.promises.rename(sourcePath, targetPath);
    } catch (error) {
        if (error.code !== "EXDEV") throw error;
        await fs.promises.copyFile(sourcePath, targetPath);
        await removeFile(sourcePath);
    }
};

module.exports = {
    storageDriver,
    bundledStaticsRoot,
    storageRoot,
    assertPersistentStorageConfigured,
    storagePath,
    ensureDirectory,
    findPublicAsset,
    publicUrlForKey,
    removeFile,
    removeManagedPublicAsset,
    saveUploadedAsset,
    materializeManagedAsset,
    writeFileAtomically,
    moveFile
};
