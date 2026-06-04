import { existsSync } from "node:fs";
import path from "node:path";
import { getHeliumLinux, type Resolved } from "./linux.js";

export interface HeliumPathError {
	name: "helium-paths";
	message: string;
	additionalInfo?: string;
	otherDetails?: unknown;
}

type Resolver = (env: NodeJS.ProcessEnv) => Resolved;
const SUPPORTED_PLATFORMS = ["linux", "darwin", "win32"] as const;
type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];
const DARWIN_PATH = "/Applications/Helium.app/Contents/MacOS/Helium";

function getHeliumWindows(env: NodeJS.ProcessEnv): Resolved {
	const tried: string[] = [];

	// Helium keeps Chromium's chrome.exe name (not helium.exe).
	const suffix = ["imput", "Helium", "Application", "chrome.exe"];
	const prefixes = [env.LOCALAPPDATA, env.PROGRAMFILES, env["PROGRAMFILES(X86)"]].filter(
		(v): v is string => !!v,
	);

	for (const prefix of prefixes) {
		const heliumPath = path.win32.join(prefix, ...suffix);
		tried.push(heliumPath);
		if (existsSync(heliumPath)) {
			return { path: heliumPath, tried };
		}
	}

	return { path: null, tried };
}

function getHeliumDarwin(): Resolved {
	const tried = [DARWIN_PATH];
	if (existsSync(DARWIN_PATH)) {
		return { path: DARWIN_PATH, tried };
	}
	return { path: null, tried };
}

const resolvers: Record<SupportedPlatform, Resolver> = {
	linux: (env) => getHeliumLinux(env),
	darwin: () => getHeliumDarwin(),
	win32: (env) => getHeliumWindows(env),
};

function isSupportedPlatform(platform: NodeJS.Platform): platform is SupportedPlatform {
	return (SUPPORTED_PLATFORMS as readonly string[]).includes(platform);
}

/** Returns the Helium executable path, or throws if it isn't found. */
export function getHeliumPath(): string {
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
export function getAnyHelium(): string {
	return getHeliumPath();
}

// Helpers

function throwHeliumNotFound(additionalInfo: string, otherDetails?: unknown): never {
	throw {
		name: "helium-paths",
		message: `Couldn't find the Helium browser. ${additionalInfo}`,
		additionalInfo,
		otherDetails,
	} as HeliumPathError;
}

function throwInvalidPlatformError(platform: NodeJS.Platform): never {
	throwHeliumNotFound("Unsupported platform. Helium", {
		platform,
		supportedPlatforms: SUPPORTED_PLATFORMS,
	});
}
