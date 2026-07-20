const fs = require("fs");
const path = require("path");

const bundledStaticsRoot = path.resolve(__dirname, "../statics");
const storageRoot = process.env.FILE_STORAGE_ROOT
    ? path.resolve(process.env.FILE_STORAGE_ROOT)
    : bundledStaticsRoot;

const resolveInside = (root, segments) => {
    const candidate = path.resolve(root, ...segments);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error("Chemin de stockage invalide.");
    }
    return candidate;
};

const storagePath = (...segments) => resolveInside(storageRoot, segments);
const bundledPath = (...segments) => resolveInside(bundledStaticsRoot, segments);

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

const removeFile = async (filePath) => {
    if (!filePath) return;
    try {
        await fs.promises.unlink(filePath);
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
};

const removeQrAssets = async (token) => {
    await Promise.all([
        removeFile(storagePath("qrcodes", `qr_${token}.png`)),
        removeFile(storagePath("cards", `card_${token}.svg`)),
        removeFile(storagePath("cards", `card_${token}.pdf`))
    ]);
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
    bundledStaticsRoot,
    storageRoot,
    storagePath,
    ensureDirectory,
    findPublicAsset,
    removeFile,
    removeQrAssets,
    writeFileAtomically,
    moveFile
};
