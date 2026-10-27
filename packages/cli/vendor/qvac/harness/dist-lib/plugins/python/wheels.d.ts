import { z } from 'zod';
declare const ManifestSchema: z.ZodObject<{
    pyodide: z.ZodString;
    packages: z.ZodRecord<z.ZodString, z.ZodObject<{
        version: z.ZodOptional<z.ZodString>;
        imports: z.ZodOptional<z.ZodArray<z.ZodString>>;
        pypi: z.ZodArray<z.ZodString>;
        pyodide: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    files: z.ZodRecord<z.ZodString, z.ZodObject<{
        url: z.ZodString;
        sha256: z.ZodString;
        channel: z.ZodEnum<{
            pyodide: "pyodide";
            pypi: "pypi";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type WheelManifest = z.infer<typeof ManifestSchema>;
export interface VendoredInstall {
    readonly wheels: readonly string[];
    readonly packages: readonly string[];
}
interface WheelFs {
    mkdirTree(path: string): void;
    writeFile(path: string, data: Uint8Array): void;
    analyzePath(path: string): {
        exists: boolean;
    };
}
export declare function wheelsDir(): string;
export declare function vendoredManifest(dir?: string): WheelManifest | null;
export declare function normalizeDistribution(name: string): string;
export interface VendoredOptions {
    readonly dir?: string | undefined;
    readonly manifest?: WheelManifest | null;
}
export declare function vendoredSpec(distribution: string, opts?: VendoredOptions): string | null;
export declare function planVendoredInstall(specs: readonly string[], opts?: VendoredOptions): VendoredInstall | null;
export declare function stageVendoredWheels(target: WheelFs, install: VendoredInstall): string[];
export declare function seedPackageCache(cacheDir: string, dir?: string): void;
export {};
