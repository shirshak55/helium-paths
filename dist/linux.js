import { accessSync, constants, readFileSync } from "node:fs";
import path from "node:path";
const DESKTOP_FILE_NAMES = ["helium.desktop", "net.imput.helium.desktop"];
const HELIUM_BINARY_NAME = "helium";
const KNOWN_INSTALL_LOCATIONS = [
    "/opt/helium/helium-wrapper",
    "/opt/helium/helium",
    "/usr/bin/helium",
    "/usr/lib/helium/helium",
    "/snap/bin/helium",
];
function xdgApplicationDirs(env) {
    const home = env.HOME || "";
    const dataHome = env.XDG_DATA_HOME || (home ? path.join(home, ".local", "share") : "");
    const dataDirs = (env.XDG_DATA_DIRS || "/usr/local/share:/usr/share").split(":").filter(Boolean);
    // Flatpak/Snap keep their entries outside XDG_DATA_DIRS.
    const integrationDirs = [
        "/var/lib/flatpak/exports/share",
        home ? path.join(home, ".local", "share", "flatpak", "exports", "share") : "",
        "/var/lib/snapd/desktop",
    ].filter(Boolean);
    return [...new Set([dataHome, ...dataDirs, ...integrationDirs].filter(Boolean))].map((base) => path.join(base, "applications"));
}
// First Exec= value inside the [Desktop Entry] group.
function parseExecLine(contents) {
    let inEntry = false;
    for (const raw of contents.split(/\r?\n/)) {
        const line = raw.trim();
        if (line.startsWith("[") && line.endsWith("]")) {
            inEntry = line === "[Desktop Entry]";
            continue;
        }
        if (inEntry && line.startsWith("Exec=")) {
            return line.slice("Exec=".length);
        }
    }
    return null;
}
function splitExec(exec) {
    return Array.from(exec.matchAll(/"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|((?:\\.|[^\s\\])+)/g), (match) => (match[1] ?? match[2] ?? match[3] ?? "").replaceAll(/\\(.)/g, "$1"));
}
function isExecutable(filePath) {
    try {
        accessSync(filePath, constants.X_OK);
        return true;
    }
    catch {
        return false;
    }
}
function resolveOnPath(binaryName, env) {
    if (!binaryName || binaryName.includes("/") || binaryName.includes("\\")) {
        return null;
    }
    for (const dir of (env.PATH || "").split(path.delimiter).filter(Boolean)) {
        const candidate = path.join(dir, binaryName);
        if (isExecutable(candidate)) {
            return candidate;
        }
    }
    return null;
}
function looksLikeHeliumProgram(token) {
    if (!token || token.startsWith("%"))
        return false;
    if (token.startsWith("-"))
        return false;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token))
        return false;
    return path.basename(token).toLowerCase().includes("helium");
}
function resolveProgram(program, env, tried) {
    if (path.isAbsolute(program)) {
        tried.push(program);
        return isExecutable(program) ? program : null;
    }
    tried.push(`$PATH:${program}`);
    return resolveOnPath(program, env);
}
// Resolve Helium on Linux: PATH, then a .desktop Exec= target, then known dirs.
export function getHeliumLinux(env, knownInstallLocations = KNOWN_INSTALL_LOCATIONS) {
    const tried = [];
    // PATH (deb/rpm install a /usr/bin/helium symlink).
    tried.push(`$PATH:${HELIUM_BINARY_NAME}`);
    const onPath = resolveOnPath(HELIUM_BINARY_NAME, env);
    if (onPath) {
        return { path: onPath, tried };
    }
    // .desktop Exec= target — catches AppImage and other non-PATH installs.
    for (const dir of xdgApplicationDirs(env)) {
        for (const name of DESKTOP_FILE_NAMES) {
            const desktopPath = path.join(dir, name);
            tried.push(desktopPath);
            let exec = null;
            try {
                exec = parseExecLine(readFileSync(desktopPath, "utf8"));
            }
            catch { }
            if (!exec)
                continue;
            for (const program of splitExec(exec).filter(looksLikeHeliumProgram)) {
                const resolved = resolveProgram(program, env, tried);
                if (resolved) {
                    return { path: resolved, tried };
                }
            }
        }
    }
    // Known install locations.
    for (const candidate of knownInstallLocations) {
        tried.push(candidate);
        if (isExecutable(candidate)) {
            return { path: candidate, tried };
        }
    }
    return { path: null, tried };
}
