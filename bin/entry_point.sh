#!/bin/bash

# Force UTF-8 encoding
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export RUBYOPT="-E utf-8"
export JEKYLL_ENCODING="utf-8"

CONFIG_FILE=_config.yml

# Log start of the script
echo "Starting Jekyll server setup on Debian container..."
echo "ALAINA: Starting Jekyll server setup on Debian container"

# Make sure all necessary packages are installed
if ! command -v jekyll &> /dev/null; then
  echo "Jekyll not found, installing..."
  echo "ALAINA: Installing Jekyll and dependencies"
  apt-get update && apt-get install -y ruby-full build-essential zlib1g-dev python2 python-is-python2
  gem install jekyll bundler
fi

if ! command -v inotifywait &> /dev/null; then
  echo "Installing inotify-tools..."
  echo "ALAINA: Installing inotify-tools"
  apt-get update && apt-get install -y inotify-tools
fi

# Check for ImageMagick
if ! command -v convert &> /dev/null; then
  echo "ImageMagick not found, installing..."
  echo "ALAINA: Installing ImageMagick"
  apt-get update && apt-get install -y imagemagick
fi

# Install additional dependencies that might be needed for gem building
echo "Installing additional dependencies for gem building..."
echo "ALAINA: Installing additional build dependencies"
apt-get update && apt-get install -y libgmp-dev libsqlite3-dev

# Navigate to the project directory
cd "${WORKSPACE_FOLDER:-/workspaces/visiblecollege.github.io}"
echo "Working directory: $(pwd)"
echo "ALAINA: Working directory set to $(pwd)"

# Detect architecture
ARCH=$(uname -m)
echo "Detected architecture: $ARCH"
echo "ALAINA: Detected architecture: $ARCH"

# Install necessary gems first
echo "Installing gems..."
echo "ALAINA: Installing gems with bundle install"
bundle install || {
  echo "Bundle install failed, trying alternative approach..."
  echo "ALAINA: Bundle install failed, trying with --without development test"
  
  # Try installing without development and test gems
  bundle install --without development test || {
    echo "Still failing, trying with explicit platform..."
    echo "ALAINA: Installing with platform-specific settings"
    
    # Try with specific platform setting
    bundle config set specific_platform true
    bundle install || {
      echo "Final attempt: installing bare minimum gems..."
      echo "ALAINA: Installing bare minimum gems"
      bundle install --without development test assets
    }
  }
}

# Start Jekyll server
echo "Starting Jekyll server..."
echo "ALAINA: Starting Jekyll server with livereload"
bundle exec jekyll serve --watch --port=8080 --host=0.0.0.0 --livereload --verbose --trace &

while true; do
  # Wait for changes to config file
  echo "Watching for changes to $CONFIG_FILE..."
  echo "ALAINA: Watching for changes to $CONFIG_FILE"
  inotifywait -q -e modify,move,create,delete $CONFIG_FILE 2>/dev/null || sleep 5

  if [ $? -eq 0 ]; then
    echo "Change detected to $CONFIG_FILE, restarting Jekyll"
    echo "ALAINA: Change detected to $CONFIG_FILE, restarting Jekyll"

    # Find and kill the Jekyll process
    jekyll_pid=$(pgrep -f jekyll)
    if [ ! -z "$jekyll_pid" ]; then
      echo "Killing Jekyll process $jekyll_pid"
      echo "ALAINA: Killing Jekyll process $jekyll_pid"
      kill -TERM $jekyll_pid
      sleep 2
    fi

    # Restart Jekyll
    echo "Restarting Jekyll server..."
    echo "ALAINA: Restarting Jekyll server after config change"
    bundle exec jekyll serve --watch --port=8080 --host=0.0.0.0 --livereload --verbose --trace &
  fi
done
