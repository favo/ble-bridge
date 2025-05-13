#!/usr/bin/env bash

# 1. Overwrite /home/pi/.system-upgrade.sh with a safe no-op
cat <<'EOF' > /home/pi/.system-upgrade.sh
#!/bin/bash
sleep 10
sudo reboot
exit 0
EOF

chmod +x /home/pi/.system-upgrade.sh
sudo chown pi:pi /home/pi/.system-upgrade.sh

# 2. Change Restart=on-failure to Restart=always
SERVICE_FILE="/etc/systemd/user/pintomind-player.service"
if [ -f "$SERVICE_FILE" ]; then
  sudo sed -i 's/^Restart=on-failure$/Restart=always/' "$SERVICE_FILE"
else
  echo "Warning: $SERVICE_FILE not found"
fi

SERVICE_FILE="/etc/xdg/systemd/user/pintomind-player.service"
if [ -f "$SERVICE_FILE" ]; then
  sudo sed -i 's/^Restart=on-failure$/Restart=always/' "$SERVICE_FILE"
else
  echo "Warning: $SERVICE_FILE not found"
fi

# 3. Append +patched to BUILD_VERSION if not already present
BUILD_FILE="/home/pi/BUILD_VERSION"
if [ -f "$BUILD_FILE" ]; then
  if ! grep -q "+patched" "$BUILD_FILE"; then
    sed -i 's/$/+patched/' "$BUILD_FILE"
  fi
else
  echo "Warning: $BUILD_FILE not found"
fi

# 4. Fikse cache katalog
sudo chown pi:pi -R /home/pi/.cache
