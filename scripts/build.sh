#!/bin/bash

set -e

echo "🛠️  Starting Debian package build process..."

# Read package.json fields
if [ ! -f package.json ]; then
  echo "❌ package.json not found!"
  exit 1
fi

PACKAGE=$(grep '"name":' package.json | sed 's/.*"name": *"\(.*\)",*/\1/')
VERSION=$(grep '"version":' package.json | sed 's/.*"version": *"\(.*\)",*/\1/')
MAINTAINER=$(grep '"author":' package.json | sed 's/.*"author": *"\(.*\)",*/\1/')

if [ -z "$PACKAGE" ] || [ -z "$VERSION" ]; then
  echo "❌ Could not extract package name or version from package.json!"
  exit 1
fi

# Fallback if maintainer is missing
if [ -z "$MAINTAINER" ]; then
  MAINTAINER="Unknown Maintainer <unknown@example.com>"
fi

echo "📄 Building package: $PACKAGE"
echo "📄 Version: $VERSION"
echo "👤 Maintainer: $MAINTAINER"

# Clean node_modules and rebuild properly
echo "🧹 Cleaning old node_modules..."
rm -rf node_modules/*

# Install production Node.js dependencies
echo "📦 Installing production Node.js dependencies..."
npm install --omit=dev --force --arch=arm64 --platform=linux

# Setup clean /package directory (inside temp mount)
echo "📁 Setting up package filesystem layout in /package ..."
rm -rf /package/* || true
mkdir -p /package/usr/local/bin
mkdir -p /package/opt/pintomind/ble-bridge
mkdir -p /package/DEBIAN

# Copy project files into /package
cp app.js package.json /package/opt/pintomind/ble-bridge
cp -r bin /package/opt/pintomind/ble-bridge
cp -r node_modules /package/opt/pintomind/ble-bridge

# Prepare /package/DEBIAN/control
if [ ! -f debian/control ]; then
  echo "❌ debian/control template not found!"
  exit 1
fi

echo "📝 Preparing /package/DEBIAN/control file..."
sed -e "s/@PACKAGE@/$PACKAGE/g" \
    -e "s/@VERSION@/$VERSION/g" \
    -e "s/@MAINTAINER@/$MAINTAINER/g" \
    debian/control > /package/DEBIAN/control

# Build the .deb package
OUTPUT_DEB="${PACKAGE}_${VERSION}_arm64.deb"
mkdir -p dist
echo "📦 Building the .deb package: dist/$OUTPUT_DEB ..."
dpkg-deb --build /package "dist/$OUTPUT_DEB"

echo "✅ Build finished! Your .deb package is ready: dist/$OUTPUT_DEB"