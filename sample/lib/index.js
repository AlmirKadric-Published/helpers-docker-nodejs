const DockerHelper = require('helpers-docker');
const docker = require('helpers-docker/lib/docker');


/**
 * Overloaded Docker helper to provide service warmup & configuration
 */
class LocalHelper extends DockerHelper {
	constructor() {
		super();

		// Overload `up-services` action handler to
		// inject service warmup and configuration
		const upServicesAction = this.actions['up-services'].action;
		this.actions['up-services'].action = async () => {
			await upServicesAction();

			await this.mysqlWarmup(
				`${process.env.COMPOSE_PROJECT_NAME}-percona`,
				process.env.MYSQL_ROOT_PASSWORD,
				process.env.MYSQL_START_TIMEOUT
			);

			await this.mysqlExposeRoot(
				`${process.env.COMPOSE_PROJECT_NAME}-percona`,
				process.env.MYSQL_ROOT_PASSWORD
			);
		};
	}


	/**
	 * Sleeps for n seconds before continuing
	 *
	 * @param seconds
	 * @returns {Promise}
	 */
	sleep(seconds) {
		return new Promise((resolve) => {
			setTimeout(() => resolve(), seconds * 1000);
		});
	}


	/**
	 * Waits for MySQL server to be responsive to queries
	 *
	 * @param container
	 * @param rootPassword
	 * @param timeout
	 * @returns {Promise}
	 */
	async mysqlWarmup(container, rootPassword, timeout) {
		console.log('# Wait for MySQL to be available');
		for (let count = 0; count < timeout; count += 1) {
			// Attempt to list databases within existing container
			const result = await docker.exec(container, [
				'mysql', '-uroot', `-p${rootPassword}`, '-e', 'SHOW DATABASES'
			], { NoStdIO: true, Tty: false }).catch(() => { /* DO NOTHING ON ERROR */
			});

			// Check if this was a successful run
			if (result && result.stdio) {
				return;
			}

			// Otherwise wait a second and repeat
			await this.sleep(1);
		}

		throw new Error('MySQL did not start');
	}


	/**
	 * Enables access to root user from any remote
	 *
	 * @param container
	 * @param rootPassword
	 * @returns {Promise}
	 */
	async mysqlExposeRoot(container, rootPassword) {
		console.log('# Enable remote access to MySQL root user');
		const grantQuery = `GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY '${rootPassword}'`;
		await docker.exec(container, [
			'mysql', '-uroot', `-p${rootPassword}`, '-e', grantQuery
		], { Tty: false });
	}
}


// Export LocalHelper class
module.exports = LocalHelper;
