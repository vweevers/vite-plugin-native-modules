import { Plugin } from 'vite';

interface PackageConfig {
    /** Package name to target (e.g., 'native-package-123') */
    package: string;
    /** Additional file names to copy (e.g., ['native-file.node-macos', 'addon.node-linux']) */
    fileNames: string[];
}
interface NativeFilePluginOptions {
    /** Enable the plugin. Defaults to true in build mode, false in dev mode */
    forced?: boolean;
    /** Additional native file configurations for packages with non-standard file extensions */
    additionalNativeFiles?: PackageConfig[];
    /** Format for generated native file names. 'preserve' keeps original name with hash suffix, 'hash-only' uses only the hash. Defaults to 'preserve' */
    filenameFormat?: "preserve" | "hash-only";
}
declare function nativeFilePlugin(options?: NativeFilePluginOptions): Plugin;

export { type NativeFilePluginOptions, nativeFilePlugin as default };
