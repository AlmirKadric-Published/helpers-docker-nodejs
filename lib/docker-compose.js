const system = require('./system');


/**
 * Executes given docker-compose cli action
 *
 * @param servicesComposeFiles
 * @param action
 * @param args
 * @param options
 * @returns {Promise.<{ stdout: string, stderr: string }>}
 */
exports.cli = async function (servicesComposeFiles, action, args, options) {
	if (!Array.isArray(servicesComposeFiles)) {
		servicesComposeFiles = [servicesComposeFiles];
	}


	const passArgs = [];

	servicesComposeFiles.forEach(function (servicesComposeFile) {
		passArgs.push('-f');
		passArgs.push(servicesComposeFile);
	});

	passArgs.push(action);

	args = args || [];
	passArgs.push(...args);


	return system.exec('docker-compose', passArgs, options);
};
