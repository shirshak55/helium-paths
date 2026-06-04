import { existsSync } from "node:fs";
import path from "node:path";
import { getHeliumLinux } from "./linux.js";
const SUPPORTED_PLATFORMS = ["linux", "darwin", "win32"];
const DARWIN_PATH = "/Applications/Helium.app/Contents/MacOS/Helium";
function getHeliumWindows(env) {
    const tried = [];
    // Helium keeps Chromium's chrome.exe name (not helium.exe).
    const suffix = ["imput", "Helium", "Application", "chrome.exe"];
    const prefixes = [env.LOCALAPPDATA, env.PROGRAMFILES, env["PROGRAMFILES(X86)"]].filter((v) => !!v);
    for (const prefix of prefixes) {
        const heliumPath = path.win32.join(prefix, ...suffix);
        tried.push(heliumPath);
        if (existsSync(heliumPath)) {
            return { path: heliumPath, tried };
        }
    }
    return { path: null, tried };
}
function getHeliumDarwin() {
    const tried = [DARWIN_PATH];
    if (existsSync(DARWIN_PATH)) {
        return { path: DARWIN_PATH, tried };
    }
    return { path: null, tried };
}
const resolvers = {
    linux: (env) => getHeliumLinux(env),
    darwin: () => getHeliumDarwin(),
    win32: (env) => getHeliumWindows(env),
};
function isSupportedPlatform(platform) {
    return SUPPORTED_PLATFORMS.includes(platform);
}
/** Returns the Helium executable path, or throws if it isn't found. */
export function getHeliumPath() {
    const platform = process.platform;
    if (!isSupportedPlatform(platform)) {
        throwInvalidPlatformError(platform);
    }
    const { path, tried } = resolvers[platform](process.env);
    if (path) {
        return path;
    }
    throwHeliumNotFound("Helium", { platform, triedPaths: tried });
}
/** Same as getHeliumPath today; kept for parity with edge-paths and future channels. */
export function getAnyHelium() {
    return getHeliumPath();
}
// Helpers
function throwHeliumNotFound(additionalInfo, otherDetails) {
    throw {
        name: "helium-paths",
        message: `Couldn't find the Helium browser. ${additionalInfo}`,
        additionalInfo,
        otherDetails,
    };
}
function throwInvalidPlatformError(platform) {
    throwHeliumNotFound("Unsupported platform. Helium", {
        platform,
        supportedPlatforms: SUPPORTED_PLATFORMS,
    });
}
