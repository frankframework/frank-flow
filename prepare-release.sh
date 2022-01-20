#!/bin/bash

echo "Version = $1"
SNAPSHOT_VERSION="${1}-SNAPSHOT"
echo "Snapshot version = $SNAPSHOT_VERSION"

mvn versions:set -DnewVersion=$SNAPSHOT_VERSION

printenv