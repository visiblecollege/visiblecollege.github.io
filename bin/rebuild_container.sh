#!/bin/bash

# Script to forcibly rebuild the devcontainer from scratch

echo "Starting devcontainer rebuild process..."
echo "ALAINA: Starting complete devcontainer rebuild"

# Stop any running devcontainers
echo "Stopping any running dev containers..."
running_containers=$(docker ps -q --filter "name=vsc-visiblecollege")
if [ ! -z "$running_containers" ]; then
  docker stop $running_containers
  echo "Stopped running containers: $running_containers"
fi

# Remove any existing devcontainers with this name
echo "Removing any existing dev containers..."
existing_containers=$(docker ps -a -q --filter "name=vsc-visiblecollege")
if [ ! -z "$existing_containers" ]; then
  docker rm $existing_containers
  echo "Removed containers: $existing_containers"
fi

# Pull the latest image explicitly
echo "Pulling the latest image..."
docker pull mcr.microsoft.com/devcontainers/base:bullseye

# Clean any VS Code devcontainer cache
echo "Cleaning VS Code / Cursor cache directories..."
rm -rf ~/.vscode-server/bin/* 2>/dev/null
rm -rf ~/.vscode-server/extensions/* 2>/dev/null
rm -rf ~/.cursor/cursor-server/bin/* 2>/dev/null
rm -rf ~/.cursor/extensions/* 2>/dev/null

# Clean Docker build cache to force a rebuild of the devcontainer
echo "Cleaning Docker build cache..."
docker builder prune -f

# More aggressive Docker cleanup
echo "Performing a more thorough Docker cleanup..."
# Remove unused containers
docker container prune -f
# Remove all unused volumes
docker volume prune -f
# Remove all unused networks
docker network prune -f
# Remove unused images
docker image prune -f

echo "Rebuild preparation complete!"
echo "ALAINA: Devcontainer rebuild preparation complete"
echo "Now close VS Code/Cursor completely and reopen it, then select 'Reopen in Container'" 