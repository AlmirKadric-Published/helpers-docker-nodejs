#!/usr/bin/env node

const commander = require('commander');
const globalDirs = require('global-dirs');
const path = require('path');


// Add global paths to module resolution, this allows inheritting helpers to get easy
// access without needing the global-dirs library or this logic
module.paths.push(globalDirs.npm.packages);
module.paths.push(globalDirs.yarn.packages);


// Setup command line with the environment configuration path option as an entry point for overloading
commander
	.version(require('../package.json').version)
	.option(
		'-p, --path [value]',
		'path to environment configuration',
		(value) => path.resolve(value),
		process.cwd()
	)
	.option(
		'--no-force-env-file',
		'disables the behaviour where .env file values are forced to override set environment variables'
	)
	.option(
		'-v, --verbose',
		'print debug logs'
	);


// Initial parsing of command line to extract the path to environment configuration only
commander.parseOptions(process.argv);


// Check if environment configuration has overloaded helper class
let HelperClass;
try {
	HelperClass = require(commander.path);
} catch (error) {
	if (commander.verbose) {
		console.error(error);
	}
}

if (!HelperClass || !HelperClass.prototype || !HelperClass.prototype.run) {
	console.log('No overload found within, using base class');
	console.log('');
	HelperClass = require(path.resolve(__dirname, '../'));
}


// Change current working directory to configuration path
process.chdir(commander.path);


// Run the helper class
const helper = new HelperClass();
helper.run();
