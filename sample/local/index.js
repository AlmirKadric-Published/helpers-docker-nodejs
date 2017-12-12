const DockerHelper = require('../lib');


class LocalHelper extends DockerHelper {
	constructor() {
		super();

		// Remove unneeded actions
		delete this.actions['image-tag'];
		delete this.actions['image-push'];
		delete this.actions['up-app'];

		// Overload `up` to only bring up services and
		// add development routing into containers.
		this.actions.up.action = async () => {
			await this.actions['up-services'].action();
			await this.actions['add-routes'].action();
			console.log('# All Done!');
		};
	}
}


module.exports = LocalHelper;
