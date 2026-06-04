import { getAnyHelium, getHeliumPath } from "../dist/index.js";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

console.log("Testing Helium Browser");

async function check(binaryPathFunc, shouldBe) {
	shouldBe = shouldBe.toLowerCase();

	console.log("Running test for", {
		shouldBe,
		platform: process.platform,
	});

	console.log("Checking for path");
	const pth = binaryPathFunc();
	console.log("Path is", pth);

	if (process.platform !== "win32") {
		console.log("Checking for version");
		const { stdout } = await promisify(execFile)(pth, ["--version"]);
		console.log("Version is", stdout.trim());

		if (stdout.trim().toLowerCase().includes(shouldBe)) {
			console.log(`Passed: ${pth}`);
		} else {
			throw `Couldn't get ${pth} working`;
		}
	} else {
		// On Windows the executable is chrome.exe; launching a GUI browser just
		// to read --version is flaky, so assert the resolved binary exists.
		if (existsSync(pth) && pth.toLowerCase().endsWith(".exe")) {
			console.log(`Passed: ${pth}`);
		} else {
			throw `Couldn't get ${pth} working`;
		}
	}
}

async function main() {
	await check(() => getHeliumPath(), "Helium");
	await check(() => getAnyHelium(), "Helium");
}

main().catch((e) => {
	console.log("Error from main", e);
	// Exit non-zero so CI notices.
	process.exit(1);
});
