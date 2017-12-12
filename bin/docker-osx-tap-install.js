#!/usr/bin/env node

const path = require('path');
const childProcess = require('child_process');


const scriptPath = path.resolve(__dirname, '../sbin/docker-tuntap-osx/sbin/docker_tap_install.sh');
const args = process.argv.slice(2);

childProcess.execFileSync(scriptPath, args, { stdio: 'inherit' });
