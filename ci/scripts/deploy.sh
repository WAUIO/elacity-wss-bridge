#!/bin/bash

set -e

export BRANCH_NAME=${1:-main}

# get root dir from script location
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." >/dev/null 2>&1 && pwd )"

cd $ROOT_DIR

source ~/.bashrc

if [ -e ./.profile ]
then 
  source ./.profile;
fi

/usr/bin/npm ci
/usr/bin/pm2 reload ecosystem.config.js --update-env --env ${BRANCH_NAME}