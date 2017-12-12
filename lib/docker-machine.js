const system = require('./system');


/**
 * Executes given docker-machine cli action
 *
 * @param action
 * @param args
 * @param options
 * @returns {Promise.<{ stdout: string, stderr: string }>}
 */
exports.cli = async function (action, args, options) {
	args = args || [];

	const passArgs = [action, ...args];
	return await system.exec('docker-machine', passArgs, options);
};
