'use strict';

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var crypto__default = /*#__PURE__*/_interopDefault(crypto);
var fs__default = /*#__PURE__*/_interopDefault(fs);
var path__default = /*#__PURE__*/_interopDefault(path);

// src/index.ts
function isCallExpression(node) {
  return node.type === "CallExpression";
}
function isLiteral(node) {
  return node.type === "Literal";
}
function isIdentifier(node) {
  return node.type === "Identifier";
}
function isMemberExpression(node) {
  return node.type === "MemberExpression";
}
function isVariableDeclarator(node) {
  return node.type === "VariableDeclarator";
}
function isImportDeclaration(node) {
  return node.type === "ImportDeclaration";
}
function isImportDefaultSpecifier(node) {
  return node.type === "ImportDefaultSpecifier";
}
function isImportSpecifier(node) {
  return node.type === "ImportSpecifier";
}
function nativeFilePlugin(options = {}) {
  const name = "plugin-native-modules";
  const nativeFiles = /* @__PURE__ */ new Map();
  const hashedFilenameToPath = /* @__PURE__ */ new Map();
  let outputFormat = "es";
  let command = "build";
  function detectModuleType(fileId, code) {
    if (fileId.endsWith(".mjs") || fileId.endsWith(".mts")) {
      return true;
    }
    if (fileId.endsWith(".cjs") || fileId.endsWith(".cts")) {
      return false;
    }
    if (code) {
      if (code.includes("import ") || code.includes("export ") || code.includes("import.meta")) {
        return true;
      }
      if (code.includes("require(") || code.includes("module.exports") || code.includes("exports.")) {
        return false;
      }
    }
    try {
      let dir = path__default.default.dirname(fileId);
      const root = path__default.default.parse(fileId).root;
      while (dir !== root && dir !== path__default.default.dirname(dir)) {
        const packageJsonPath = path__default.default.join(dir, "package.json");
        if (fs__default.default.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(
              fs__default.default.readFileSync(packageJsonPath, "utf-8")
            );
            if (packageJson.type === "module") {
              return true;
            }
            if (packageJson.type === "commonjs") {
              return false;
            }
          } catch {
          }
        }
        dir = path__default.default.dirname(dir);
      }
    } catch {
    }
    return false;
  }
  function shouldProcessFile(filePath, currentFileId) {
    if (filePath.endsWith(".node")) return true;
    const normalizedCurrentFileId = currentFileId.replace(/\\/g, "/");
    const normalizedFilePath = filePath.replace(/\\/g, "/");
    if (options.additionalNativeFiles) {
      for (const pkgConfig of options.additionalNativeFiles) {
        const pkgPath = `node_modules/${pkgConfig.package}`;
        if (normalizedCurrentFileId.includes(pkgPath)) {
          for (const fileName of pkgConfig.fileNames) {
            if (normalizedFilePath.endsWith(fileName) || normalizedFilePath.includes(`/${fileName}`)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
  function resolveNodeGypBuild(directory) {
    const platform = process.platform;
    const arch = process.arch;
    const prebuildsDir = path__default.default.join(
      directory,
      "prebuilds",
      `${platform}-${arch}`
    );
    if (fs__default.default.existsSync(prebuildsDir)) {
      try {
        const files = fs__default.default.readdirSync(prebuildsDir);
        const nodeFiles = files.filter((f) => f.endsWith(".node"));
        if (nodeFiles.length > 0) {
          const napiFile = nodeFiles.find((f) => f.includes("napi"));
          const selectedFile = napiFile || nodeFiles[0];
          const fullPath = path__default.default.join(prebuildsDir, selectedFile);
          if (fs__default.default.existsSync(fullPath)) {
            return fullPath;
          }
        }
      } catch {
      }
    }
    const buildDir = path__default.default.join(directory, "build", "Release");
    if (fs__default.default.existsSync(buildDir)) {
      try {
        const files = fs__default.default.readdirSync(buildDir);
        const nodeFiles = files.filter((f) => f.endsWith(".node"));
        if (nodeFiles.length > 0) {
          const fullPath = path__default.default.join(buildDir, nodeFiles[0]);
          if (fs__default.default.existsSync(fullPath)) {
            return fullPath;
          }
        }
      } catch {
      }
    }
    return null;
  }
  function findPackageRoot(startDir) {
    let dir = startDir;
    let prev;
    while (true) {
      if (fs__default.default.existsSync(path__default.default.join(dir, "package.json")) || fs__default.default.existsSync(path__default.default.join(dir, "node_modules"))) {
        return dir;
      }
      prev = dir;
      dir = path__default.default.dirname(dir);
      if (dir === prev || dir === "." || dir === "/") {
        return startDir;
      }
    }
  }
  function resolveBindings(directory, moduleName) {
    const nodeFileName = moduleName.endsWith(".node") ? moduleName : `${moduleName}.node`;
    const packageRoot = findPackageRoot(directory);
    const searchPaths = [
      path__default.default.join(packageRoot, "build", "Release", nodeFileName),
      path__default.default.join(packageRoot, "build", "Debug", nodeFileName),
      path__default.default.join(packageRoot, "out", "Release", nodeFileName),
      path__default.default.join(packageRoot, "out", "Debug", nodeFileName),
      path__default.default.join(packageRoot, "build", "default", nodeFileName),
      path__default.default.join(packageRoot, "compiled", nodeFileName),
      // Also check direct path (sometimes used in development)
      path__default.default.join(packageRoot, nodeFileName)
    ];
    for (const searchPath of searchPaths) {
      if (fs__default.default.existsSync(searchPath)) {
        return searchPath;
      }
    }
    return null;
  }
  function resolveNpmPackageNodeFile(packageName, fromDir) {
    let currentDir = fromDir;
    const root = path__default.default.parse(fromDir).root;
    while (currentDir !== root && currentDir !== path__default.default.dirname(currentDir)) {
      const nodeModulesDir = path__default.default.join(currentDir, "node_modules");
      if (fs__default.default.existsSync(nodeModulesDir)) {
        const packageDir = path__default.default.join(nodeModulesDir, packageName);
        if (fs__default.default.existsSync(packageDir)) {
          const packageJsonPath = path__default.default.join(packageDir, "package.json");
          if (fs__default.default.existsSync(packageJsonPath)) {
            try {
              const packageJson = JSON.parse(
                fs__default.default.readFileSync(packageJsonPath, "utf-8")
              );
              if (packageJson.main && packageJson.main.endsWith(".node")) {
                const mainPath = path__default.default.join(packageDir, packageJson.main);
                if (fs__default.default.existsSync(mainPath)) {
                  return mainPath;
                }
              }
            } catch {
            }
          }
          const indexNodePath = path__default.default.join(packageDir, "index.node");
          if (fs__default.default.existsSync(indexNodePath)) {
            return indexNodePath;
          }
          try {
            const files = fs__default.default.readdirSync(packageDir);
            const nodeFile = files.find((f) => f.endsWith(".node"));
            if (nodeFile) {
              return path__default.default.join(packageDir, nodeFile);
            }
          } catch {
          }
        }
      }
      currentDir = path__default.default.dirname(currentDir);
    }
    return null;
  }
  function findPlatformSpecificNativePackage(scopePrefix, fromDir) {
    const platform = process.platform;
    const arch = process.arch;
    const platformPatterns = [
      `${platform}-${arch}`,
      // darwin-arm64, linux-x64
      `${platform}-${arch}-gnu`,
      // linux-x64-gnu
      `${platform}-${arch}-musl`,
      // linux-x64-musl
      `${platform}${arch === "x64" ? "64" : arch === "ia32" ? "32" : arch}`
      // darwin64, linux64
    ];
    let currentDir = fromDir;
    const root = path__default.default.parse(fromDir).root;
    while (currentDir !== root && currentDir !== path__default.default.dirname(currentDir)) {
      const nodeModulesDir = path__default.default.join(currentDir, "node_modules");
      if (fs__default.default.existsSync(nodeModulesDir)) {
        for (const platformPattern of platformPatterns) {
          const packageName = `${scopePrefix}${platformPattern}`;
          const result = resolveNpmPackageNodeFile(packageName, currentDir);
          if (result) {
            return { packageName, nodeFilePath: result };
          }
        }
        if (scopePrefix.startsWith("@")) {
          const scopeName = scopePrefix.split("/")[0];
          const scopeDir = path__default.default.join(nodeModulesDir, scopeName);
          if (fs__default.default.existsSync(scopeDir)) {
            try {
              const packages = fs__default.default.readdirSync(scopeDir);
              for (const pkg of packages) {
                const lowerPkg = pkg.toLowerCase();
                const lowerPlatform = platform.toLowerCase();
                const lowerArch = arch.toLowerCase();
                if (lowerPkg.includes(lowerPlatform) && lowerPkg.includes(lowerArch)) {
                  const packageName = `${scopeName}/${pkg}`;
                  const result = resolveNpmPackageNodeFile(
                    packageName,
                    currentDir
                  );
                  if (result) {
                    return { packageName, nodeFilePath: result };
                  }
                }
              }
            } catch {
            }
          }
        }
      }
      currentDir = path__default.default.dirname(currentDir);
    }
    return null;
  }
  function extractPackageName(filePath) {
    const nodeModulesMatch = filePath.match(
      /node_modules[/\\](@[^/\\]+[/\\][^/\\]+|[^/\\]+)/
    );
    if (nodeModulesMatch) {
      return nodeModulesMatch[1].replace(/^@/, "").replace(/[/\\]/g, "-");
    }
    return null;
  }
  function generateHashedFilename(originalFilename, hash, originalPath) {
    const lastDotIndex = originalFilename.lastIndexOf(".");
    const extension = lastDotIndex > 0 ? originalFilename.slice(lastDotIndex) : "";
    const baseName = lastDotIndex > 0 ? originalFilename.slice(0, lastDotIndex) : originalFilename;
    if (options.filenameFormat === "hash-only") {
      return `${hash.toUpperCase()}${extension}`;
    } else {
      let prefix = "";
      if (originalPath) {
        const packageName = extractPackageName(originalPath);
        if (packageName) {
          prefix = `${packageName}-`;
        }
      }
      return `${prefix}${baseName}-${hash.toUpperCase()}${extension}`;
    }
  }
  function registerNativeFile(absolutePath) {
    let info = nativeFiles.get(absolutePath);
    if (!info) {
      const content = fs__default.default.readFileSync(absolutePath);
      const hash = crypto__default.default.createHash("md5").update(content).digest("hex").slice(0, 8);
      const filename = path__default.default.basename(absolutePath);
      const hashedFilename = generateHashedFilename(filename, hash, absolutePath);
      info = {
        content,
        hashedFilename,
        originalPath: absolutePath
      };
      nativeFiles.set(absolutePath, info);
      hashedFilenameToPath.set(hashedFilename, absolutePath);
    }
    return info;
  }
  function detectModuleTypeWithContext(context, fileId, code) {
    try {
      if (typeof context.getModuleInfo === "function") {
        const moduleInfo = context.getModuleInfo(fileId);
        const format = moduleInfo?.format;
        if (format) {
          return format === "es";
        }
      }
    } catch {
    }
    return detectModuleType(fileId, code);
  }
  return {
    configResolved(config) {
      command = config.command;
      const rollupOutput = config.build?.rollupOptions?.output;
      if (rollupOutput) {
        const format = Array.isArray(rollupOutput) ? rollupOutput[0]?.format : rollupOutput.format;
        if (format === "cjs" || format === "commonjs") {
          outputFormat = "cjs";
        } else {
          outputFormat = "es";
        }
      } else if (config.build?.lib) {
        const lib = config.build.lib;
        if (typeof lib === "object" && lib.formats) {
          const formats = lib.formats;
          outputFormat = formats[0] === "cjs" ? "cjs" : "es";
        }
      }
    },
    generateBundle() {
      nativeFiles.forEach((info) => {
        this.emitFile({
          fileName: info.hashedFilename,
          source: info.content,
          type: "asset"
        });
      });
    },
    load(id) {
      if (!id.startsWith("\0native:")) return null;
      const originalPath = id.slice("\0native:".length);
      const info = nativeFiles.get(originalPath);
      if (!info) return null;
      if (outputFormat === "es") {
        return `
import { createRequire } from 'node:module';
const __require = createRequire(import.meta.url);
const nativeModule = __require('./${info.hashedFilename}');
export default nativeModule;
`;
      } else {
        return `
module.exports = require('./${info.hashedFilename}');
`;
      }
    },
    name,
    async resolveId(source, importer) {
      const enabled = options.forced ?? command === "build";
      if (!enabled) return null;
      if (!importer) return null;
      const sourceWithoutQuery = source.split("?")[0];
      const normalizedSource = sourceWithoutQuery.startsWith("./") ? sourceWithoutQuery.slice(2) : sourceWithoutQuery;
      const basename = path__default.default.basename(normalizedSource);
      if (hashedFilenameToPath.has(basename)) {
        const originalPath = hashedFilenameToPath.get(basename);
        const virtualId2 = `\0native:${originalPath}`;
        return {
          id: virtualId2,
          syntheticNamedExports: true
        };
      }
      if (!shouldProcessFile(source, importer)) return null;
      const resolved = path__default.default.resolve(path__default.default.dirname(importer), source);
      if (!fs__default.default.existsSync(resolved)) return null;
      registerNativeFile(resolved);
      const virtualId = `\0native:${resolved}`;
      return virtualId;
    },
    transform(code, id) {
      const enabled = options.forced ?? command === "build";
      if (!enabled) return null;
      const hasBindingsPackage = code.includes("require('bindings')") || code.includes('require("bindings")') || code.includes("from 'bindings'") || code.includes('from "bindings"');
      const hasTemplateLiteralNativePackage = /require\s*\(\s*`@[a-z0-9-]+\//.test(code);
      if (!code.includes(".node") && !code.includes("node-gyp-build") && !hasBindingsPackage && !hasTemplateLiteralNativePackage)
        return null;
      let modified = false;
      const replacements = [];
      try {
        let isFileURLToPathPattern2 = function(node) {
          if (!isCallExpression(node)) return false;
          const callee = node.callee;
          if (!isIdentifier(callee)) return false;
          if (!fileURLToPathVars.has(callee.name)) return false;
          if (node.arguments.length !== 1) return false;
          const arg = node.arguments[0];
          if (isMemberExpression(arg)) {
            const metaExpr = arg;
            if (metaExpr.object.type === "MetaProperty" && isIdentifier(metaExpr.property) && metaExpr.property.name === "url") {
              const metaProp = metaExpr.object;
              if (metaProp.meta.name === "import" && metaProp.property.name === "meta") {
                return true;
              }
            }
            if (isMemberExpression(metaExpr.object) && isIdentifier(metaExpr.object.object) && metaExpr.object.object.name === "import" && isIdentifier(
              metaExpr.object.property
            ) && metaExpr.object.property.name === "meta" && isIdentifier(metaExpr.property) && metaExpr.property.name === "url") {
              return true;
            }
          }
          return false;
        }, resolveDirectoryFromCall2 = function(callNode, currentFileId) {
          const callee = callNode.callee;
          if (isMemberExpression(callee)) {
            const memberExpr = callee;
            if (isIdentifier(memberExpr.object) && (pathModuleVars.has(memberExpr.object.name) || memberExpr.object.name === "path") && isIdentifier(memberExpr.property)) {
              const methodName = memberExpr.property.name;
              if (methodName === "dirname") {
                if (callNode.arguments.length === 1) {
                  const arg = callNode.arguments[0];
                  if (isFileURLToPathPattern2(arg)) {
                    return path__default.default.dirname(currentFileId);
                  }
                  if (isIdentifier(arg) && directoryVars.has(arg.name)) {
                    const baseDir = directoryVars.get(arg.name);
                    return path__default.default.dirname(baseDir);
                  }
                }
              }
              if (methodName === "resolve" || methodName === "join") {
                if (callNode.arguments.length === 0) return null;
                let baseDir = null;
                let startIndex = 0;
                const firstArg = callNode.arguments[0];
                if (isIdentifier(firstArg)) {
                  if (firstArg.name === "__dirname") {
                    baseDir = path__default.default.dirname(currentFileId);
                    startIndex = 1;
                  } else if (directoryVars.has(firstArg.name)) {
                    baseDir = directoryVars.get(firstArg.name);
                    startIndex = 1;
                  } else {
                    return null;
                  }
                } else if (isLiteral(firstArg) && typeof firstArg.value === "string") {
                  baseDir = path__default.default.dirname(currentFileId);
                  startIndex = 0;
                } else {
                  return null;
                }
                const parts = [baseDir];
                for (let i = startIndex; i < callNode.arguments.length; i++) {
                  const arg = callNode.arguments[i];
                  if (isLiteral(arg) && typeof arg.value === "string") {
                    parts.push(arg.value);
                  } else if (isIdentifier(arg) && directoryVars.has(arg.name)) {
                    parts.push(directoryVars.get(arg.name));
                  } else {
                    return null;
                  }
                }
                return path__default.default.join(...parts);
              }
            }
          }
          return null;
        }, resolveDirArgument2 = function(arg, currentFileId) {
          if (!arg) return null;
          if (isIdentifier(arg) && arg.name === "__dirname") {
            return path__default.default.dirname(currentFileId);
          }
          if (isIdentifier(arg) && directoryVars.has(arg.name)) {
            return directoryVars.get(arg.name);
          }
          if (isLiteral(arg) && typeof arg.value === "string") {
            return path__default.default.resolve(path__default.default.dirname(currentFileId), arg.value);
          }
          if (isCallExpression(arg)) {
            const callee = arg.callee;
            if (isMemberExpression(callee) && isIdentifier(callee.object) && callee.object.name === "require" && isIdentifier(callee.property) && callee.property.name === "resolve" && arg.arguments.length === 1 && isLiteral(arg.arguments[0]) && arg.arguments[0].value === "./") {
              return path__default.default.dirname(currentFileId);
            }
            if (isMemberExpression(callee) && isIdentifier(callee.object) && (pathModuleVars.has(callee.object.name) || callee.object.name === "path") && isIdentifier(callee.property)) {
              const methodName = callee.property.name;
              if (methodName === "join" || methodName === "resolve") {
                if (arg.arguments.length === 0) return null;
                let baseDir = null;
                let startIndex = 0;
                const firstArg = arg.arguments[0];
                if (isIdentifier(firstArg)) {
                  if (firstArg.name === "__dirname") {
                    baseDir = path__default.default.dirname(currentFileId);
                    startIndex = 1;
                  } else if (directoryVars.has(firstArg.name)) {
                    baseDir = directoryVars.get(firstArg.name);
                    startIndex = 1;
                  } else {
                    return null;
                  }
                } else if (isLiteral(firstArg) && typeof firstArg.value === "string") {
                  baseDir = path__default.default.dirname(currentFileId);
                  startIndex = 0;
                } else {
                  return null;
                }
                const parts = [baseDir];
                for (let i = startIndex; i < arg.arguments.length; i++) {
                  const pathArg = arg.arguments[i];
                  if (isLiteral(pathArg) && typeof pathArg.value === "string") {
                    parts.push(pathArg.value);
                  } else if (isIdentifier(pathArg) && directoryVars.has(pathArg.name)) {
                    parts.push(directoryVars.get(pathArg.name));
                  } else {
                    return null;
                  }
                }
                return path__default.default.join(...parts);
              }
            }
          }
          return null;
        }, processNodeFile2 = function(nodeFilePath, callNode) {
          const info = registerNativeFile(nodeFilePath);
          let replacementCode;
          if (isESModule) {
            const funcName = createRequireLocalName || "createRequire";
            replacementCode = `${funcName}(import.meta.url)("./${info.hashedFilename}")`;
          } else if (outputFormat === "es") {
            replacementCode = `require("./${info.hashedFilename}").default`;
          } else {
            replacementCode = `require("./${info.hashedFilename}")`;
          }
          replacements.push({
            start: callNode.start,
            end: callNode.end,
            value: replacementCode
          });
          modified = true;
          nodeGypBuildUsageCount++;
        };
        var isFileURLToPathPattern = isFileURLToPathPattern2, resolveDirectoryFromCall = resolveDirectoryFromCall2, resolveDirArgument = resolveDirArgument2, processNodeFile = processNodeFile2;
        const ast = this.parse(code);
        let createRequireLocalName = null;
        const customRequireVars = /* @__PURE__ */ new Set();
        const nodeGypBuildVars = /* @__PURE__ */ new Set();
        const nodeGypBuildImportNodes = [];
        let nodeGypBuildUsageCount = 0;
        const bindingsVars = /* @__PURE__ */ new Set();
        const bindingsImportNodes = [];
        let bindingsUsageCount = 0;
        const directoryVars = /* @__PURE__ */ new Map();
        const pathModuleVars = /* @__PURE__ */ new Set();
        const fileURLToPathVars = /* @__PURE__ */ new Set();
        let isESModule = detectModuleTypeWithContext(this, id, code);
        let hasCreateRequireImport = false;
        const walk = (node) => {
          if (isImportDeclaration(node)) {
            isESModule = true;
          } else if (node.type === "ExportDefaultDeclaration" || node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") {
            isESModule = true;
          }
          if (isImportDeclaration(node)) {
            const source = node.source.value;
            if (source === "module" || source === "node:module") {
              for (const specifier of node.specifiers) {
                if (isImportSpecifier(specifier)) {
                  if (isIdentifier(specifier.imported) && specifier.imported.name === "createRequire" && isIdentifier(specifier.local)) {
                    createRequireLocalName = specifier.local.name;
                    hasCreateRequireImport = true;
                  }
                }
              }
            }
            if (source === "path" || source === "node:path") {
              for (const specifier of node.specifiers) {
                if (isImportDefaultSpecifier(specifier) && isIdentifier(specifier.local)) {
                  pathModuleVars.add(specifier.local.name);
                }
              }
            }
            if (source === "url" || source === "node:url") {
              for (const specifier of node.specifiers) {
                if (isImportSpecifier(specifier)) {
                  if (isIdentifier(specifier.imported) && specifier.imported.name === "fileURLToPath" && isIdentifier(specifier.local)) {
                    fileURLToPathVars.add(specifier.local.name);
                  }
                }
              }
            }
            if (source === "node-gyp-build") {
              nodeGypBuildImportNodes.push(node);
              for (const specifier of node.specifiers) {
                if (isImportDefaultSpecifier(specifier) && isIdentifier(specifier.local)) {
                  nodeGypBuildVars.add(specifier.local.name);
                }
              }
            }
            if (source === "bindings") {
              bindingsImportNodes.push(node);
              for (const specifier of node.specifiers) {
                if (isImportDefaultSpecifier(specifier) && isIdentifier(specifier.local)) {
                  bindingsVars.add(specifier.local.name);
                }
              }
            }
          }
          if (isVariableDeclarator(node)) {
            if (isIdentifier(node.id) && node.init) {
              const varName = node.id.name;
              if (isIdentifier(node.init) && node.init.name === "__dirname") {
                directoryVars.set(varName, path__default.default.dirname(id));
              } else if (isIdentifier(node.init) && directoryVars.has(node.init.name)) {
                directoryVars.set(varName, directoryVars.get(node.init.name));
              } else if (isCallExpression(node.init)) {
                const resolvedDir = resolveDirectoryFromCall2(node.init, id);
                if (resolvedDir) {
                  directoryVars.set(varName, resolvedDir);
                }
                const calleeNode = node.init.callee;
                if (isIdentifier(calleeNode) && createRequireLocalName && calleeNode.name === createRequireLocalName) {
                  customRequireVars.add(varName);
                } else if (isIdentifier(calleeNode) && (calleeNode.name === "require" || customRequireVars.has(calleeNode.name)) && node.init.arguments.length === 1 && isLiteral(node.init.arguments[0]) && node.init.arguments[0].value === "node-gyp-build") {
                  nodeGypBuildImportNodes.push(node);
                  nodeGypBuildVars.add(varName);
                } else if (isIdentifier(calleeNode) && (calleeNode.name === "require" || customRequireVars.has(calleeNode.name)) && node.init.arguments.length === 1 && isLiteral(node.init.arguments[0]) && node.init.arguments[0].value === "bindings") {
                  bindingsImportNodes.push(node);
                  bindingsVars.add(varName);
                }
              }
            }
          }
          if (isCallExpression(node)) {
            const calleeNode = node.callee;
            if (isCallExpression(calleeNode) && isIdentifier(calleeNode.callee) && (calleeNode.callee.name === "require" || customRequireVars.has(calleeNode.callee.name)) && calleeNode.arguments.length === 1 && isLiteral(calleeNode.arguments[0]) && calleeNode.arguments[0].value === "node-gyp-build") {
              const dirArg = node.arguments[0];
              const directory = resolveDirArgument2(dirArg, id);
              if (directory) {
                const nodeFilePath = resolveNodeGypBuild(directory);
                if (nodeFilePath) {
                  processNodeFile2(nodeFilePath, node);
                }
              }
            } else if (isIdentifier(calleeNode) && nodeGypBuildVars.has(calleeNode.name)) {
              const dirArg = node.arguments[0];
              const directory = resolveDirArgument2(dirArg, id);
              if (directory) {
                const nodeFilePath = resolveNodeGypBuild(directory);
                if (nodeFilePath) {
                  processNodeFile2(nodeFilePath, node);
                }
              }
            } else if (isCallExpression(calleeNode) && isIdentifier(calleeNode.callee) && (calleeNode.callee.name === "require" || customRequireVars.has(calleeNode.callee.name)) && calleeNode.arguments.length === 1 && isLiteral(calleeNode.arguments[0]) && calleeNode.arguments[0].value === "bindings" && node.arguments.length === 1) {
              const arg = node.arguments[0];
              let moduleName = null;
              if (isLiteral(arg) && typeof arg.value === "string") {
                moduleName = arg.value;
              } else if (arg.type === "ObjectExpression" && "properties" in arg) {
                const properties = arg.properties;
                const bindingsProp = properties.find(
                  (prop) => prop.type === "Property" && prop.key?.name === "bindings" && isLiteral(prop.value)
                );
                if (bindingsProp && isLiteral(bindingsProp.value)) {
                  moduleName = bindingsProp.value.value;
                }
              }
              if (moduleName) {
                const directory = path__default.default.dirname(id);
                const nodeFilePath = resolveBindings(directory, moduleName);
                if (nodeFilePath) {
                  processNodeFile2(nodeFilePath, node);
                  bindingsUsageCount++;
                }
              }
            } else if (isIdentifier(calleeNode) && bindingsVars.has(calleeNode.name) && node.arguments.length === 1) {
              const arg = node.arguments[0];
              let moduleName = null;
              if (isLiteral(arg) && typeof arg.value === "string") {
                moduleName = arg.value;
              } else if (arg.type === "ObjectExpression" && "properties" in arg) {
                const properties = arg.properties;
                const bindingsProp = properties.find(
                  (prop) => prop.type === "Property" && prop.key?.name === "bindings" && isLiteral(prop.value)
                );
                if (bindingsProp && isLiteral(bindingsProp.value)) {
                  moduleName = bindingsProp.value.value;
                }
              }
              if (moduleName) {
                const directory = path__default.default.dirname(id);
                const nodeFilePath = resolveBindings(directory, moduleName);
                if (nodeFilePath) {
                  processNodeFile2(nodeFilePath, node);
                  bindingsUsageCount++;
                }
              }
            } else if (node.arguments.length === 1 && isLiteral(node.arguments[0]) && typeof node.arguments[0].value === "string") {
              const literalNode = node.arguments[0];
              const relativePath = literalNode.value;
              if (shouldProcessFile(relativePath, id)) {
                const absolutePath = path__default.default.resolve(path__default.default.dirname(id), relativePath);
                if (fs__default.default.existsSync(absolutePath)) {
                  const info = registerNativeFile(absolutePath);
                  replacements.push({
                    start: literalNode.start,
                    end: literalNode.end,
                    value: `"./${info.hashedFilename}"`
                  });
                  modified = true;
                }
              }
            }
            const isPathJoinCall = isMemberExpression(calleeNode) && isIdentifier(calleeNode.object) && (pathModuleVars.has(calleeNode.object.name) || calleeNode.object.name === "path") && isIdentifier(calleeNode.property) && (calleeNode.property.name === "join" || calleeNode.property.name === "resolve") || isIdentifier(calleeNode) && calleeNode.name === "join";
            if (isPathJoinCall && node.arguments.length >= 2) {
              const firstArg = node.arguments[0];
              let baseDir = null;
              if (isIdentifier(firstArg) && firstArg.name === "__dirname") {
                baseDir = path__default.default.dirname(id);
              } else if (isIdentifier(firstArg) && directoryVars.has(firstArg.name)) {
                baseDir = directoryVars.get(firstArg.name);
              }
              if (baseDir) {
                const lastArg = node.arguments[node.arguments.length - 1];
                if (isLiteral(lastArg) && typeof lastArg.value === "string" && lastArg.value.endsWith(".node")) {
                  const parts = [baseDir];
                  for (let i = 1; i < node.arguments.length; i++) {
                    const arg = node.arguments[i];
                    if (isLiteral(arg) && typeof arg.value === "string") {
                      parts.push(arg.value);
                    }
                  }
                  const absolutePath = path__default.default.join(...parts);
                  if (fs__default.default.existsSync(absolutePath)) {
                    const info = registerNativeFile(absolutePath);
                    replacements.push({
                      start: lastArg.start,
                      end: lastArg.end,
                      value: `'${info.hashedFilename}'`
                    });
                    modified = true;
                  }
                }
              }
            }
            if (isIdentifier(calleeNode) && (calleeNode.name === "require" || customRequireVars.has(calleeNode.name)) && node.arguments.length === 1 && isLiteral(node.arguments[0]) && typeof node.arguments[0].value === "string") {
              const packageName = node.arguments[0].value;
              if (!packageName.startsWith(".") && !packageName.startsWith("/") && !packageName.startsWith("node:")) {
                const nodeFilePath = resolveNpmPackageNodeFile(
                  packageName,
                  path__default.default.dirname(id)
                );
                if (nodeFilePath) {
                  const info = registerNativeFile(nodeFilePath);
                  const literalNode = node.arguments[0];
                  replacements.push({
                    start: literalNode.start,
                    end: literalNode.end,
                    value: `"./${info.hashedFilename}"`
                  });
                  modified = true;
                }
              }
            }
            if (isIdentifier(calleeNode) && (calleeNode.name === "require" || customRequireVars.has(calleeNode.name)) && node.arguments.length === 1 && node.arguments[0].type === "TemplateLiteral") {
              const templateLiteral = node.arguments[0];
              if (templateLiteral.quasis.length >= 1 && templateLiteral.expressions.length >= 1) {
                const prefix = templateLiteral.quasis[0].value.cooked;
                if (prefix && prefix.startsWith("@") && prefix.includes("/")) {
                  const result = findPlatformSpecificNativePackage(
                    prefix,
                    path__default.default.dirname(id)
                  );
                  if (result) {
                    const { nodeFilePath } = result;
                    const info = registerNativeFile(nodeFilePath);
                    const templateNode = node.arguments[0];
                    if (templateNode.start !== void 0 && templateNode.end !== void 0) {
                      replacements.push({
                        start: templateNode.start,
                        end: templateNode.end,
                        value: `"./${info.hashedFilename}"`
                      });
                      modified = true;
                    }
                  }
                }
              }
            }
          }
          for (const key in node) {
            if (key === "type" || key === "start" || key === "end") continue;
            const child = node[key];
            if (child && typeof child === "object") {
              if (Array.isArray(child)) {
                child.forEach((c) => {
                  if (c && typeof c === "object" && "type" in c) {
                    walk(c);
                  }
                });
              } else if ("type" in child) {
                walk(child);
              }
            }
          }
        };
        walk(ast);
        if (nodeGypBuildUsageCount > 0 && nodeGypBuildImportNodes.length > 0) {
          for (const importNode of nodeGypBuildImportNodes) {
            if (importNode.start !== void 0 && importNode.end !== void 0) {
              if (importNode.type === "ImportDeclaration") {
                replacements.push({
                  start: importNode.start,
                  end: importNode.end,
                  value: ""
                });
                modified = true;
              } else if (importNode.type === "VariableDeclarator") {
                replacements.push({
                  start: importNode.start,
                  end: importNode.end,
                  value: ""
                });
                modified = true;
              }
            }
          }
        }
        if (bindingsUsageCount > 0 && bindingsImportNodes.length > 0) {
          for (const importNode of bindingsImportNodes) {
            if (importNode.start !== void 0 && importNode.end !== void 0) {
              if (importNode.type === "ImportDeclaration") {
                replacements.push({
                  start: importNode.start,
                  end: importNode.end,
                  value: ""
                });
                modified = true;
              } else if (importNode.type === "VariableDeclarator") {
                replacements.push({
                  start: importNode.start,
                  end: importNode.end,
                  value: ""
                });
                modified = true;
              }
            }
          }
        }
        if (modified) {
          let newCode = code;
          let createRequireInjection = "";
          if (isESModule && modified && !hasCreateRequireImport) {
            createRequireInjection = "import { createRequire } from 'module';\n";
            createRequireLocalName = "createRequire";
          }
          let codePrefix = "";
          if (createRequireInjection) {
            codePrefix += createRequireInjection;
          }
          replacements.sort((a, b) => b.start - a.start).forEach((replacement) => {
            newCode = newCode.slice(0, replacement.start) + replacement.value + newCode.slice(replacement.end);
          });
          if (codePrefix) {
            const importRegex = /^import\s+.*?;?\s*$/gm;
            let lastImportMatch;
            let match;
            while ((match = importRegex.exec(newCode)) !== null) {
              lastImportMatch = match;
            }
            if (lastImportMatch) {
              const insertPos = lastImportMatch.index + lastImportMatch[0].length;
              newCode = newCode.slice(0, insertPos) + "\n" + codePrefix + newCode.slice(insertPos);
            } else {
              newCode = codePrefix + "\n" + newCode;
            }
          }
          return { code: newCode, map: null };
        }
      } catch (error) {
        console.warn(
          `Failed to parse ${id} for native module transformation:`,
          error
        );
        return null;
      }
      return null;
    }
  };
}

module.exports = nativeFilePlugin;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map