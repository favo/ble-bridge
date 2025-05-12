#!/usr/bin/env node

const path = require('path');
const { exec } = require('child_process');

const scriptPath = path.join(__dirname, '..', 'prepare-upgrade.sh');

exec(`bash "${scriptPath}"`, (error, stdout, stderr) => {
    if (error) {
        console.error(`Upgrade script failed: ${error.message}`);
        process.exit(1);
    }
    if (stderr) {
        console.error(`stderr: ${stderr}`);
    }
    console.log(`stdout: ${stdout}`);
});

require("../app.js")