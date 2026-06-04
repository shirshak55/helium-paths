import fs from "node:fs";

const REPOS = {
	darwin: "imputnet/helium-macos",
	win32: "imputnet/helium-windows",
	linux: "imputnet/helium-linux",
};

// Preferred asset file extensions per platform, best first.
const EXTENSIONS = {
	darwin: [".dmg"],
	win32: [".exe", ".zip"],
	linux: [".AppImage", ".tar.xz", ".deb"],
};

// Map Node's process.arch to substrings that commonly appear in asset names.
const ARCH_HINTS = {
	arm64: ["arm64", "aarch64"],
	x64: ["x86_64", "x64", "amd64"],
};

function pickAsset(assets, platform) {
	const exts = EXTENSIONS[platform];
	const archHints = ARCH_HINTS[process.arch] ?? [];

	const matchesExt = (name) => exts.some((ext) => name.toLowerCase().endsWith(ext.toLowerCase()));

	const candidates = assets.filter((a) => matchesExt(a.name));
	if (candidates.length === 0) return null;

	// Prefer an asset that also matches the current CPU arch, then fall back.
	const archMatch = candidates.find((a) =>
		archHints.some((hint) => a.name.toLowerCase().includes(hint)),
	);
	return archMatch ?? candidates[0];
}

async function downloadFile(url, filename) {
	const resp = await fetch(url);
	if (!resp.ok) {
		throw new Error(`Failed to download ${url}: ${resp.status} ${resp.statusText}`);
	}
	const buffer = Buffer.from(await resp.arrayBuffer());
	fs.writeFileSync(filename, buffer);
	console.log(`Saved ${filename} (${(buffer.byteLength / (1024 * 1024)).toFixed(1)} MB)`);
}

async function main() {
	const platform = process.platform;
	const repo = REPOS[platform];
	if (!repo) {
		throw new Error(`Unsupported platform: ${platform}`);
	}

	const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
	console.log(`Looking up latest Helium release: ${apiUrl}`);
	const resp = await fetch(apiUrl);
	if (!resp.ok) {
		throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);
	}
	const release = await resp.json();
	console.log(`Latest ${repo} release: ${release.tag_name}`);

	const asset = pickAsset(release.assets ?? [], platform);
	if (!asset) {
		throw new Error(
			`No suitable asset found for ${platform}/${process.arch} in ${release.tag_name}. ` +
				`Assets: ${(release.assets ?? []).map((a) => a.name).join(", ")}`,
		);
	}

	console.log(`Downloading ${asset.name}`);
	await downloadFile(asset.browser_download_url, asset.name);
	console.log("Done. Install the downloaded artifact, then run `npm run test:e2e`.");
}

main().catch((e) => {
	console.error("Error downloading Helium:", e);
	process.exit(1);
});
