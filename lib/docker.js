const Docker = require('dockerode');

const dockerMachine = require('./docker-machine');
const system = require('./system');


/**
 * Runs the given command inside a new docker container created using given image
 *
 * @param image
 * @param command
 * @param options
 * @returns {Promise.<string>}
 */
exports.run = (image, command, options) => new Promise((resolve, reject) => {
	if (!Array.isArray(command)) {
		command = [command];
	}

	options = Object.assign({
		Image: image,
		Cmd: command,
		Tty: true,
		AttachStdin: true,
		AttachStdout: true,
		AttachStderr: true,
		OpenStdin: true
	}, options);

	const docker = new Docker();
	docker.createContainer(options, (error, container) => {
		if (error) {
			return reject(error);
		}
		container.attach({ stream: true, stdout: true, stderr: true }, (error, stream) => {
			if (error) {
				return reject(error);
			}

			let stdio = '';
			stream.on('data', (chunk) => {
				stdio += chunk;
				if (!options.NoStdIO) {
					process.stdout.write(chunk);
				}
			});

			container.start((error) => {
				if (error) {
					return reject(error);
				}
				container.wait((error, data) => {
					if (error) {
						return reject(error);
					}

					const code = data.StatusCode;
					if (code !== 0) {
						const error = new Error(`Failed to run command [${image}]: ${command}`);
						error.code = code;
						error.stdio = stdio;

						return reject(error);
					}

					resolve({ stdio });
				});
			});
		});
	});
});


/**
 * Runs the given command within the existing given docker container
 *
 * @param name
 * @param command
 * @param options
 * @returns {Promise.<string>}
 */
exports.exec = (name, command, options) => new Promise((resolve, reject) => {
	if (!Array.isArray(command)) {
		command = [command];
	}

	options = Object.assign({
		Cmd: command,
		Tty: true,
		AttachStdin: true,
		AttachStdout: true,
		AttachStderr: true,
		OpenStdin: true
	}, options);

	const docker = new Docker();
	docker.getContainer(name).exec(options, (error, exec) => {
		if (error) {
			return reject(error);
		}
		exec.start((error, stream) => {
			if (error) {
				return reject(error);
			}

			let stdio = '';
			stream.on('data', (chunk) => {
				stdio += chunk;
				if (!options.NoStdIO) {
					process.stdout.write(chunk);
				}
			});

			stream.on('end', () => exec.inspect((error, data) => {
				if (error) {
					return reject(error);
				}

				const code = data.ExitCode;
				if (code !== 0) {
					const error = new Error(`Failed to exec command [${name}]: ${command}`);
					error.code = code;
					error.stdio = stdio;

					return reject(error);
				}

				resolve({ stdio });
			}));
		});
	});
});


/**
 * Executes given docker cli action
 *
 * @param action
 * @param args
 * @param options
 * @returns {Promise.<{ stdout: string, stderr: string }>}
 */
exports.cli = async (action, args, options) => {
	args = args || [];

	const passArgs = [action, ...args];
	return await system.exec('docker', passArgs, options);
};


/**
 * Get's the image id for the given image name
 *
 * @param imageName
 * @returns {Promise.<string>}
 */
exports.getImageId = async (imageName) => {
	const result = await exports.cli('images', ['-q', imageName], { NoStdIO: true });
	const imageId = result.stdout.trim();
	if (!imageId) {
		throw new Error(`Image does not exist: "${imageName}"`);
	}

	return imageId;
};


/**
 * Returns the docker host VM gateway ip address
 *
 * @returns {Promise.<string>}
 */
exports.getGateway = async () => {
	// See the docker host VM was created by docker-machine
	// If so, use docker-machine command to get IP
	if (process.env.DOCKER_MACHINE_NAME) {
		const result = await dockerMachine.cli('ip', null, { NoStdIO: true });
		return result.stdout.trim();
	}

	// Otherwise extract IP address for each potential interface using
	// ifconfig inside docker host and check if we can connect to them
	for (const inet of ['hvint0', 'eth1', 'eth0']) {
		const result = await exports.run('alpine', ['ifconfig', inet], {
			HostConfig: { AutoRemove: true, Privileged: true, PidMode: 'host', NetworkMode: 'host' },
			NoStdIO: true, Tty: false
		}).catch(() => { /* DO NOTHING ON ERROR */ });

		if (!result) {
			continue;
		}

		const match = result.stdio.match(/[\s\S]+inet[\s]+addr:([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)[\s\S]+/);
		if (!match) {
			continue;
		}

		const gateway = match[1];
		if (await system.ping(gateway)) {
			return { inet, gateway };
		}
	}

	throw new Error('Failed to extract docker machine IP');
};


/**
 * Enables ip forwarding for the given network interface within the docker host VM
 *
 * @param inet
 * @returns {Promise}
 */
exports.enableIPTablesForwarding = async (inet) => {
	await exports.run('debian', [
		'nsenter', '-t', '1', '-m', '-u', '-n', '-i',
		'iptables', '-A', 'FORWARD', '-i', inet, '-j', 'ACCEPT'
	], {
		HostConfig: { AutoRemove: true, Privileged: true, PidMode: 'host' },
		Tty: false
	});
};
