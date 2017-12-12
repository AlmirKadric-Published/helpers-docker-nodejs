const docker = require('helpers-docker/lib/docker');
const dockerCompose = require('helpers-docker/lib/docker-compose');

const DockerHelper = require('../lib');


// When in CI, we should assign a random TEST_ID to prevent
// conflicts between multiple running instances.
let TEST_ID = process.env.TEST_ID;
if (!TEST_ID) {
	console.warn('\u001b[33mWARNING\u001b[0m:', 'The TEST_ID variable has not been set. Defaulting to "main"');
	TEST_ID = process.env.TEST_ID = 'main';
}


class LocalHelper extends DockerHelper {
	constructor() {
		super();

		// Inject TEST_ID into COMPOSE_PROJECT_NAME
		this.COMPOSE_PROJECT_NAME = `${this.PROJECT_NAME}-${this.NODE_ENV}-${TEST_ID}`;

		// Remove unneeded actions
		delete this.actions['image-tag'];
		delete this.actions['image-push'];
		delete this.actions['image-clean'];
		delete this.actions.up;
		delete this.actions['up-app'];
		delete this.actions['add-routes'];

		// Create test action which brings up services, runs application
		// tests, tears down services and returns tests results.
		// NOTE: you need to run `image-build` before running this action
		this.actions.test = {
			help: 'Starts up services and application tests',
			action: async () => {
				//
				await this.actions['up-services'].action();

				//
				let testError;
				try {
					await this.actions['test-run'].action();
				} catch (error) {
					testError = error;
				}

				//
				await this.actions.kill.action();

				//
				if (testError) {
					throw testError;
				}

				console.log('# Tests Passed!');
			}
		};

		// Create action which runs application tests within the application container
		this.actions['test-run'] = {
			help: 'Execute make test inside built container',
			action: async () => {
				process.env.IMAGE_ID = await docker.getImageId(this.IMAGE_NAME);

				console.log('# Run tests inside app container');
				await dockerCompose.cli(this.COMPOSE_FILES, 'run', ['--no-deps', '--rm', 'app', 'npm', 'run', 'test']);
			}
		};
	}
}


module.exports = LocalHelper;
