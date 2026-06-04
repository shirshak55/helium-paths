export interface HeliumPathError {
    name: "helium-paths";
    message: string;
    additionalInfo?: string;
    otherDetails?: unknown;
}
/** Returns the Helium executable path, or throws if it isn't found. */
export declare function getHeliumPath(): string;
/** Same as getHeliumPath today; kept for parity with edge-paths and future channels. */
export declare function getAnyHelium(): string;
//# sourceMappingURL=index.d.ts.map