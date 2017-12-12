#!/usr/bin/env node

const path = require('path');
const commander = require('commander');

const pjson = require('../package.json');


// Setup command line with the environment configuration path option to start with
commander
	.version(pjson.version)
	.option(
		'-p, --path [value]',
		'Path to environment configuration',
		(value) => path.resolve(value),
		process.cwd()
	)
	.option(
		'--no-force-env-file',
		'Disables the behaviour where .env file values are forced to override set environment variables'
	);


// Initial parsing of command line to extract the path to environment configuration only
commander.parseOptions(process.argv);


// Check if environment configuration has overloaded helper class
let HelperClass;
try {
	HelperClass = require(commander.path);
} catch (error) {
	HelperClass = require('../');
}


// Change current working directory to configuration path
process.chdir(commander.path);


// Run the helper class
const helper = new HelperClass();
helper.run();
