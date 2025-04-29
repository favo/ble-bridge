FROM arm64v8/node:20-slim

RUN apt-get update && apt-get install -y dpkg-dev xz-utils python3

WORKDIR /workspace