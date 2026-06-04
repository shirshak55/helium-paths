// Run with: npx tsx examples/example.ts  (or compile alongside your project)
import {
	getAnyHelium,
	getHeliumPath,
	type HeliumPathError,
} from "helium-paths";

function isHeliumPathError(err: unknown): err is HeliumPathError {
	return (
		typeof err === "object" &&
		err !== null &&
		(err as HeliumPathError).name === "helium-paths"
	);
}

try {
	const heliumPath: string = getHeliumPath();
	console.log("Helium path:", heliumPath);
	console.log("Any Helium :", getAnyHelium());
} catch (err) {
	if (isHeliumPathError(err)) {
		console.error("Could not find Helium:", err.message);
		process.exit(1);
	}
	throw err;
}
