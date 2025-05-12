const fs = require('fs');
const path = require('path');

// 1. Overwrite /home/pi/.system-upgrade.sh with a safe no-op script
const upgradeScriptPath = '/home/pi/.system-upgrade.sh';
const upgradeScriptContent = `#!/bin/bash
# This script is intentionally harmless
exit 0
`;

try {
  fs.writeFileSync(upgradeScriptPath, upgradeScriptContent, { mode: 0o755 });
  console.log(`Created ${upgradeScriptPath}`);
} catch (err) {
  console.error(`Failed to write ${upgradeScriptPath}: ${err.message}`);
  process.exit(1);
}

// 2. Modify systemd service to use Restart=always
const serviceFile = '/home/pi/.config/systemd/user/default.target.wants/pintomind-player.service';
try {
  if (fs.existsSync(serviceFile)) {
    const original = fs.readFileSync(serviceFile, 'utf8');
    const modified = original.replace(/^Restart=on-failure$/m, 'Restart=always');
    if (original !== modified) {
      fs.writeFileSync(serviceFile, modified);
      console.log(`Patched Restart policy in ${serviceFile}`);
    } else {
      console.log(`No change needed in ${serviceFile}`);
    }
  } else {
    console.warn(`Service file not found: ${serviceFile}`);
  }
} catch (err) {
  console.error(`Failed to patch service file: ${err.message}`);
  process.exit(1);
}

// 3. Add "+patched" to BUILD_VERSION if not already present
const buildFile = '/home/pi/BUILD_VERSION';
try {
  if (fs.existsSync(buildFile)) {
    let contents = fs.readFileSync(buildFile, 'utf8');
    if (!contents.includes('+patched')) {
      contents = contents.trim() + '+patched';
      fs.writeFileSync(buildFile, contents);
      console.log(`Appended +patched to ${buildFile}`);
    } else {
      console.log(`${buildFile} already marked as patched`);
    }
  } else {
    console.warn(`BUILD_VERSION file not found: ${buildFile}`);
  }
} catch (err) {
  console.error(`Failed to update ${buildFile}: ${err.message}`);
  process.exit(1);
}