const path = require('path');
const childProcess = require('child_process');
const ping = require('net-ping');


/**
 * Executes given command
 *
 * @param command
 * @param args
 * @param options
 * @returns {Promise.<{ stdout: string, stderr: string }>}
 */
exports.exec = (command, args, options) => new Promise((resolve, reject) => {
	options = Object.assign({
		stdio: [process.stdin, 'pipe', 'pipe']
	}, options);

	const cmd = childProcess.spawn(command, args, options);

	let stdout = '';
	cmd.stdout.on('data', (chunk) => {
		stdout += chunk;
		if (!options.NoStdIO) {
			process.stdout.write(chunk);
		}
	});

	let stderr = '';
	cmd.stderr.on('data', (chunk) => {
		stderr += chunk;
		if (!options.NoStdIO) {
			process.stderr.write(chunk);
		}
	});

	cmd.on('close', (code) => {
		if (code !== 0) {
			const error = new Error(`Failed to execute command: ${command} ${args.join(' ')}`);
			error.code = code;
			error.stdout = stdout;
			error.stderr = stderr;

			return reject(error);
		}

		resolve({ stdout, stderr });
	});
});


/**
 * Execute given command with elevated permissions
 *
 * @param command
 * @param args
 * @param options
 * @returns {Promise.<{ stdout: string, stderr: string }>}
 */
exports.sudo = async (command, args, options) => {
	if (process.platform === 'win32') {
		const cmdPathResult = await exports.exec('where', [command], { NoStdIO: true });
		const cmdPath = cmdPathResult.stdout.trim();

		// TODO: Somehow we need to redirect the command standard output. Not supported with the Verb option.
		const elevatePS = `
			$pinfo = New-Object System.Diagnostics.ProcessStartInfo;
			$pinfo.FileName = "${cmdPath}";
			$pinfo.Verb = "runAs";
			$pinfo.UseShellExecute = $true;
			$pinfo.Arguments = "${args.join(' ')}";
			$p = New-Object System.Diagnostics.Process;
			$p.StartInfo = $pinfo;
			$p.Start() | Out-Null;
			$p.WaitForExit();
			exit $p.ExitCode;
		`;
		return await exports.exec('powershell', ['-Command', elevatePS], options);
	}

	return await exports.exec('sudo', [command].concat(args), options);
};


/**
 * Configure tuntap interface bridging on the OSX host
 *
 * @returns {Promise}
 */
exports.osxConfigureTapBridge = async () => {
	const tapUpScript = path.resolve(__dirname, '../sbin/docker-tuntap-osx/sbin/docker_tap_up.sh');
	await exports.exec('bash', [tapUpScript]);
};


/**
 * Add route to routes table
 *
 * @param range
 * @param mask
 * @param gateway
 * @returns {Promise}
 */
exports.addRoute = async (range, mask, gateway) => {
	if (process.platform === 'win32') {
		await exports.sudo('route', ['ADD', range, 'MASK', mask, gateway]);
		return;
	}
	if (process.platform === 'darwin') {
		await exports.sudo('route', ['add', '-net', range, '-netmask', mask, gateway]);
		return;
	}

	// TODO: Support for linux distros
	throw new Error(`Unsupported Platform: ${process.platform}`);
};


/**
 * Remove route from routes table
 *
 * @param range
 * @returns {Promise}
 */
exports.delRoute = async (range) => {
	if (process.platform === 'win32') {
		await exports.sudo('route', ['DELETE', range]);
		return;
	}
	if (process.platform === 'darwin') {
		await exports.sudo('route', ['delete', range]);
		return;
	}

	// TODO: Support for linux distros
	throw new Error(`Unsupported Platform: ${process.platform}`);
};


/**
 * Uses ICMP ping to checks whether or not the given host is reachable
 *
 * @param host
 * @returns {Promise}
 */
exports.ping = (host) => new Promise((resolve) => {
	const pingSession = ping.createSession();
	pingSession.pingHost(host, (error) => {
		resolve(!error);
	});
});
