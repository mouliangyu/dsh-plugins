#!/usr/bin/env node
import { connect } from "node:net";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { boot, installFailLoud, loadEnv, resolveConfigPath } from "@deepseek-ai/dsh-app-boot";
//#region lib/types/runner.js
/** Process lifecycle for the persistent remote host. @module dsh-remote/runner */
const NAME = "dsh-remote-host";
/**
* Boot the explicitly selected remote-host configuration and dispose it on a signal.
* @param bareModuleBaseUrl - installed-runtime base for resolving bare Cordis plugins.
* @returns after process lifecycle handlers are installed.
*/
async function runRemoteProjectHost(bareModuleBaseUrl = import.meta.url) {
	installFailLoud(NAME);
	loadEnv(NAME);
	const fromEnv = process.env["DSH_CORDIS_CONFIG"];
	const fromArgv = process.argv[2];
	const requested = fromEnv !== void 0 && fromEnv !== "" ? fromEnv : fromArgv !== void 0 && fromArgv !== "" ? fromArgv : void 0;
	const configPath = requested === void 0 ? void 0 : resolveConfigPath(requested, void 0);
	if (configPath === void 0 || !existsSync(configPath)) {
		process.stderr.write(`usage: ${NAME} <path/to/cordis.yml> (or set DSH_CORDIS_CONFIG)\n`);
		process.exit(1);
	}
	const ctx = await boot(NAME, configPath, void 0, void 0, bareModuleBaseUrl);
	let disposing;
	const disposeAndExit = (code) => {
		disposing ??= ctx.fiber.dispose().finally(() => {
			process.exit(code);
		});
	};
	process.once("SIGTERM", () => {
		disposeAndExit(0);
	});
	process.once("SIGINT", () => {
		disposeAndExit(130);
	});
}
//#endregion
//#region lib/types/bin.js
/** Remote-project daemon and SSH bridge executable. @module dsh-remote/bin */
if (process.argv[2] === "connect") {
	const socketPath = process.argv[3];
	if (socketPath === void 0 || socketPath === "") {
		process.stderr.write("usage: dsh-remote-host connect <absolute-socket-path>\n");
		process.exit(1);
	}
	const socket = connect(resolve(socketPath));
	socket.once("error", (error) => {
		process.stderr.write(`dsh-remote-host connect: ${error.message}\n`);
		process.exit(1);
	});
	socket.pipe(process.stdout);
	process.stdin.pipe(socket);
	socket.once("close", () => {
		process.exit(0);
	});
} else await runRemoteProjectHost();
//#endregion
export {};
