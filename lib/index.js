const fs = require('fs');
const path = require('path');
const findRoot = require('find-root');
const commander = require('commander');
const dotenv = require('dotenv');

const docker = require('./docker');
const dockerCompose = require('./docker-compose');
const system = require('./system');


/**
 * Base helper class with default behaviour and actions
 */
class DockerHelper {
	constructor(options) {
		let {
			NODE_ENV,
			PROJECT_NAME,
			PROJECT_VERSION,
			COMPOSE_PROJECT_NAME,
			COMPOSE_FILES,
			IMAGE_NAME,
			IMAGE_REGISTRY,
			DOCKER_CLIENT_TIMEOUT,
			IP_RANGE
		} = options || {};


		// Load `.env` file if it exists
		if (fs.existsSync('.env')) {
			const envConfig = dotenv.config({ path: '.env' }).parsed;

			// Forcefully overrides any set env variables
			if (commander.forceEnvFile) {
				for (const key of Object.keys(envConfig)) {
					process.env[key] = envConfig[key];
				}
			}
		}


		// Attempt to get application packge.json file
		// NOTE: we ignore errors since we don't really care if it fails. It's
		// only used to fill in some default values and not a a hard requirement
		let rootPath = '';
		let packageJson = {};
		try {
			rootPath = findRoot(process.cwd());
			packageJson = require(path.join(rootPath, 'package.json'));
		} catch (error) {
			// DO NOTHING
		}


		// Initialize required variables and setup class get/set
		// properties to update closure variables on property updates
		NODE_ENV = NODE_ENV || process.env.NODE_ENV;
		Object.defineProperty(this, 'NODE_ENV', {
			get: () => NODE_ENV,
			set: (newValue) => NODE_ENV = newValue
		});

		PROJECT_NAME = PROJECT_NAME || process.env.PROJECT_NAME || packageJson.name;
		Object.defineProperty(this, 'PROJECT_NAME', {
			get: () => PROJECT_NAME,
			set: (newValue) => PROJECT_NAME = newValue
		});

		PROJECT_VERSION = PROJECT_VERSION || process.env.PROJECT_VERSION || packageJson.version;
		Object.defineProperty(this, 'PROJECT_VERSION', {
			get: () => PROJECT_VERSION,
			set: (newValue) => PROJECT_VERSION = newValue
		});

		COMPOSE_PROJECT_NAME = COMPOSE_PROJECT_NAME || process.env.COMPOSE_PROJECT_NAME || `${PROJECT_NAME}-${NODE_ENV}`;
		Object.defineProperty(this, 'COMPOSE_PROJECT_NAME', {
			get: () => COMPOSE_PROJECT_NAME,
			set: (newValue) => COMPOSE_PROJECT_NAME = newValue
		});

		COMPOSE_FILES = COMPOSE_FILES || (
			fs.existsSync('docker-compose.services.yml') &&
			fs.existsSync('docker-compose.app.yml')
		) ? ['docker-compose.services.yml', 'docker-compose.app.yml'] : ['docker-compose.yml'];
		Object.defineProperty(this, 'COMPOSE_FILES', {
			get: () => COMPOSE_FILES,
			set: (newValue) => COMPOSE_FILES = newValue
		});

		IMAGE_NAME = IMAGE_NAME || process.env.IMAGE_NAME || `${COMPOSE_PROJECT_NAME}:${PROJECT_VERSION}`;
		Object.defineProperty(this, 'IMAGE_NAME', {
			get: () => IMAGE_NAME,
			set: (newValue) => IMAGE_NAME = newValue
		});

		IMAGE_REGISTRY = IMAGE_REGISTRY || process.env.IMAGE_REGISTRY;
		Object.defineProperty(this, 'IMAGE_REGISTRY', {
			get: () => IMAGE_REGISTRY,
			set: (newValue) => IMAGE_REGISTRY = newValue
		});

		DOCKER_CLIENT_TIMEOUT = DOCKER_CLIENT_TIMEOUT || process.env.DOCKER_CLIENT_TIMEOUT || '5000';
		Object.defineProperty(this, 'DOCKER_CLIENT_TIMEOUT', {
			get: () => DOCKER_CLIENT_TIMEOUT,
			set: (newValue) => DOCKER_CLIENT_TIMEOUT = newValue
		});

		IP_RANGE = IP_RANGE || process.env.IP_RANGE;
		Object.defineProperty(this, 'IP_RANGE', {
			get: () => IP_RANGE,
			set: (newValue) => IP_RANGE = newValue
		});


		// All default actions provided by this helper
		const actions = this.actions = {};

		actions['image-build'] = {
			help: 'Build application container image',
			action: async () => {
				console.log('# Building docker image');
				await docker.cli('build', [
					'-t', `${IMAGE_NAME}`,
					'--build-arg', `NODE_ENV=${NODE_ENV}`,
					rootPath
				]);
			}
		};

		actions['image-tag'] = {
			help: 'Tag the latest built image',
			action: async () => {
				if (!IMAGE_REGISTRY) {
					throw new Error('"IMAGE_REGISTRY" not configured');
				}


				console.log('# Get ID of latest built image');
				const imageNew = await docker.getImageId(`${IMAGE_NAME}`);


				console.log('# Un-tag existing images');
				const imageCurrent = await docker.getImageId(`${IMAGE_NAME}`)
					.catch(() => { /* DO NOTHING ON ERROR */ });

				if (imageCurrent) {
					await docker.cli('rmi', ['--no-prune', '-f', `${IMAGE_REGISTRY}/${IMAGE_NAME}`]);
				}


				console.log(`# Tag latest built image ${imageNew}`);
				await docker.cli('tag', [imageNew, `${IMAGE_REGISTRY}/${IMAGE_NAME}`]);
			}
		};

		actions['image-push'] = {
			help: 'Push the latest built image to the registry',
			action: async () => {
				if (!IMAGE_REGISTRY) {
					throw new Error('"IMAGE_REGISTRY" not configured');
				}

				console.log('# Push latest built image to registry');
				await docker.cli('push', [`${IMAGE_REGISTRY}/${IMAGE_NAME}`]);
			}
		};

		actions['image-clean'] = {
			help: 'Delete the latest built image',
			action: async () => {
				console.log('# Delete built images');
				await docker.cli('rmi', [`${IMAGE_NAME}`]);
			}
		};

		actions.up = {
			help: 'Starts up all services',
			action: async () => {
				await actions['up-services'].action();
				await actions['up-app'].action();
				console.log('# All Done!');
			}
		};


		//
		actions['up-services'] = {
			help: 'Starts up service containers',
			action: async () => {
				console.log('# Start up all configured containers');
				await dockerCompose.cli(COMPOSE_FILES[0], 'up', ['-d', '--no-recreate']);
			}
		};

		actions['up-app'] = {
			help: 'Starts up application container',
			action: async () => {
				console.log('# Stop application');
				await dockerCompose.cli(COMPOSE_FILES, 'stop', ['app']);

				console.log('# Delete app old container');
				await dockerCompose.cli(COMPOSE_FILES, 'rm', ['-f', 'app']);

				console.log('# Fetch new app container and migrate');
				await dockerCompose.cli(COMPOSE_FILES, 'run', ['-T', '--rm', 'app', 'npm', 'run', 'all']);

				console.log('# Start up app container');
				await dockerCompose.cli(COMPOSE_FILES, 'up', ['-d', 'app']);
			}
		};

		actions['add-routes'] = {
			help: 'Create local system routes to connect directly to containers',
			action: async () => {
				if (!IP_RANGE) {
					throw new Error('"IP_RANGE" not configured');
				}

				if (process.platform === 'darwin') {
					console.log('# Configuring docker tap interface bridge');
					await system.osxConfigureTapBridge();
				}

				console.log('# Getting docker machine IP');
				const { inet, gateway } = await docker.getGateway();

				console.log(`# Creating/updating route to containers (over ${gateway})`);
				await system.delRoute(`${IP_RANGE}.0`);
				await system.addRoute(`${IP_RANGE}.0`, '255.255.255.0', gateway);

				console.log('# Setting docker iptables default forwarding policy');
				await docker.enableIPTablesForwarding(inet);
			}
		};

		actions.ps = {
			help: 'Shows the status of all configured containers',
			action: async () => {
				await dockerCompose.cli(COMPOSE_FILES, 'ps');
			}
		};

		actions.kill = {
			help: 'Kills all configured containers',
			action: async () => {
				console.log('# Kill all configured containers');
				await dockerCompose.cli(COMPOSE_FILES, 'kill');
			}
		};

		actions.rm = {
			help: 'Removes all configured containers',
			action: async () => {
				console.log('# Remove all configured containers');
				await dockerCompose.cli(COMPOSE_FILES, 'rm', ['-f']);
			}
		};
	}


	/**
	 * Run by the `docker-helper` binary to kick off cli actions
	 *
	 * @returns {Promise}
	 */
	async run() {
		// Re-expose required environment variables in case they have been overridden
		process.env.NODE_ENV = this.NODE_ENV;
		process.env.PROJECT_NAME = this.PROJECT_NAME;
		process.env.PROJECT_VERSION = this.PROJECT_VERSION;
		process.env.COMPOSE_PROJECT_NAME = this.COMPOSE_PROJECT_NAME;
		process.env.IMAGE_NAME = this.IMAGE_NAME;
		process.env.IMAGE_REGISTRY = this.IMAGE_REGISTRY;
		process.env.DOCKER_CLIENT_TIMEOUT = this.DOCKER_CLIENT_TIMEOUT;
		process.env.IP_RANGE = this.IP_RANGE;

		// Inject all action options
		for (const key of Object.keys(this.actions)) {
			const action = this.actions[key];
			commander
				.command(action.command || key)
				.description(action.help)
				.action(async () => {
					await action.action().catch(this.error);
				});
		}

		// Parse arguments and execute action
		commander.parse(process.argv);

		// Make sure a valid command was used
		if (commander.args.length) {
			/* eslint-disable no-underscore-dangle */
			let commandName = commander.args[0];
			if (commandName && commandName._name) {
				commandName = commandName._name;
			}

			if (!commander.commands.map((cmd) => cmd._name).includes(commandName)) {
				console.error(`Error: Invalid action "${commandName}"`);
				commander.outputHelp();
				process.exit(1); // eslint-disable-line no-process-exit
			}
			/* eslint-enable no-underscore-dangle */
		} else {
			commander.outputHelp();
		}
	}


	/**
	 * Called by the helper to render errors and exit with an error status code
	 *
	 * @param error
	 */
	error(error) {
		console.error(error);
		process.exit(error.code || 1); // eslint-disable-line no-process-exit
	}
}


// Export DockerHelper class
module.exports = DockerHelper;
