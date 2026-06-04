import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getAnyHelium, getHeliumPath } from "../dist/index.js";
import { getHeliumLinux } from "../dist/linux.js";

// Deterministic unit tests. Unlike the integration test (tests/index.js), these
// do not require Helium to be installed.

const REAL_PLATFORM = process.platform;

function withPlatform(platform, fn) {
	Object.defineProperty(process, "platform", {
		value: platform,
		configurable: true,
	});
	try {
		return fn();
	} finally {
		Object.defineProperty(process, "platform", {
			value: REAL_PLATFORM,
			configurable: true,
		});
	}
}

function captureError(fn) {
	try {
		fn();
	} catch (e) {
		return e;
	}
	throw new Error("expected the function to throw, but it returned");
}

function setEnv(key, value) {
	if (value === undefined) {
		delete process.env[key];
	} else {
		process.env[key] = value;
	}
}

test("win32 builds imput\\Helium\\Application\\chrome.exe candidates", () => {
	const saved = {
		LOCALAPPDATA: process.env.LOCALAPPDATA,
		PROGRAMFILES: process.env.PROGRAMFILES,
		PFX86: process.env["PROGRAMFILES(X86)"],
	};
	setEnv("LOCALAPPDATA", "C:\\Users\\tester\\AppData\\Local");
	setEnv("PROGRAMFILES", "C:\\Program Files");
	setEnv("PROGRAMFILES(X86)", "C:\\Program Files (x86)");

	try {
		const err = withPlatform("win32", () => captureError(getHeliumPath));
		assert.equal(err.name, "helium-paths");

		const tried = err.otherDetails.triedPaths;
		// Helium keeps Chromium's chrome.exe name under the imput\Helium vendor dir.
		assert.ok(
			tried.some((p) => p.includes("imput\\Helium\\Application\\chrome.exe")),
			`expected a chrome.exe candidate, got ${JSON.stringify(tried)}`,
		);
		assert.ok(tried.some((p) => p.includes("AppData\\Local")));
		assert.ok(tried.some((p) => p.includes("Program Files")));
	} finally {
		setEnv("LOCALAPPDATA", saved.LOCALAPPDATA);
		setEnv("PROGRAMFILES", saved.PROGRAMFILES);
		setEnv("PROGRAMFILES(X86)", saved.PFX86);
	}
});

// Sets up a temp XDG data dir containing one .desktop file, neutralises PATH so
// the PATH lookup deterministically misses (forcing .desktop parsing to run),
// then invokes `fn` with platform faked to linux. Cleans everything up after.
function withLinuxDesktop({ fileName, exec, makeBinary, putBinaryOnPath }, fn) {
	const base = mkdtempSync(path.join(os.tmpdir(), "helium-paths-"));
	const appsDir = path.join(base, "applications");
	mkdirSync(appsDir, { recursive: true });

	let binaryPath;
	let execLine = exec;
	const markerPath = path.join(base, "shell-marker");
	if (makeBinary) {
		binaryPath = path.join(base, makeBinary);
		writeFileSync(binaryPath, "#!/bin/sh\necho 'Helium 0.0.0'\n", { mode: 0o755 });
	}
	execLine = execLine
		.replaceAll("__BIN__", binaryPath || "")
		.replaceAll("__BIN_ESCAPED__", (binaryPath || "").replaceAll(" ", "\\ "))
		.replaceAll("__MARKER__", markerPath);
	writeFileSync(
		path.join(appsDir, fileName),
		`[Desktop Entry]\nType=Application\nName=Helium\nExec=${execLine} %U\n`,
	);

	const saved = {
		PATH: process.env.PATH,
		XDG_DATA_HOME: process.env.XDG_DATA_HOME,
		XDG_DATA_DIRS: process.env.XDG_DATA_DIRS,
	};
	setEnv("PATH", putBinaryOnPath && binaryPath ? path.dirname(binaryPath) : "");
	setEnv("XDG_DATA_HOME", base);
	setEnv("XDG_DATA_DIRS", base);

	try {
		return withPlatform("linux", () => fn({ base, binaryPath, appsDir, markerPath }));
	} finally {
		setEnv("PATH", saved.PATH);
		setEnv("XDG_DATA_HOME", saved.XDG_DATA_HOME);
		setEnv("XDG_DATA_DIRS", saved.XDG_DATA_DIRS);
		rmSync(base, { recursive: true, force: true });
	}
}

test("linux: resolves an absolute Exec= path from a helium.desktop entry", () => {
	withLinuxDesktop(
		{ fileName: "helium.desktop", exec: "__BIN__", makeBinary: "helium-shim" },
		({ binaryPath }) => {
			assert.equal(getHeliumPath(), binaryPath);
			assert.equal(getAnyHelium(), binaryPath);
		},
	);
});

test("linux: parses a quoted Exec= path with spaces and extra field codes", () => {
	withLinuxDesktop(
		{
			fileName: "net.imput.helium.desktop",
			exec: '"__BIN__" %F %i',
			makeBinary: "My Helium.AppImage",
		},
		({ binaryPath }) => {
			assert.equal(getHeliumPath(), binaryPath);
		},
	);
});

test("linux: parses an escaped absolute Exec= path with spaces", () => {
	withLinuxDesktop(
		{
			fileName: "helium.desktop",
			exec: "__BIN_ESCAPED__",
			makeBinary: "My Helium.AppImage",
		},
		({ binaryPath }) => {
			assert.equal(getHeliumPath(), binaryPath);
		},
	);
});

test("linux: resolves a desktop Exec= binary name through PATH", () => {
	withLinuxDesktop(
		{
			fileName: "helium.desktop",
			exec: "helium-appimage",
			makeBinary: "helium-appimage",
			putBinaryOnPath: true,
		},
		({ binaryPath }) => {
			assert.equal(getHeliumPath(), binaryPath);
		},
	);
});

test("linux: treats desktop Exec= content as data, not shell code", () => {
	withLinuxDesktop(
		{
			fileName: "helium.desktop",
			exec: "helium$(touch${IFS}__MARKER__)",
		},
		({ markerPath }) => {
			const result = getHeliumLinux(process.env, []);
			assert.equal(result.path, null);
			assert.equal(existsSync(markerPath), false);
		},
	);
});

test("linux: ignores desktop Exec= option tokens that mention helium", () => {
	withLinuxDesktop(
		{
			fileName: "helium.desktop",
			exec: "/usr/bin/env --profile=helium",
		},
		() => {
			const result = getHeliumLinux(process.env, []);
			assert.equal(result.path, null);
			assert.equal(result.tried.includes("$PATH:--profile=helium"), false);
		},
	);
});

test("linux: skips a flatpak wrapper and resolves the Helium command", () => {
	withLinuxDesktop(
		{
			fileName: "net.imput.helium.desktop",
			exec: "/usr/bin/flatpak run helium-appimage @@u",
			makeBinary: "helium-appimage",
			putBinaryOnPath: true,
		},
		({ binaryPath }) => {
			assert.equal(getHeliumPath(), binaryPath);
		},
	);
});

test("unsupported platforms throw a helium-paths error", () => {
	const err = withPlatform("aix", () => captureError(getHeliumPath));
	assert.equal(err.name, "helium-paths");
	assert.match(err.message, /unsupported platform/i);
});
