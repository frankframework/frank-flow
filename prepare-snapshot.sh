#!/bin/bash

CURRENT_VERSION=$(git describe --tags --abbrev=0 | cut -d "v" -f 2)
#CURRENT_VERSION=$1

echo "Current version: $CURRENT_VERSION"

MAJOR=$(echo $CURRENT_VERSION | cut -d "." -f 1)
MINOR=$(echo $CURRENT_VERSION | cut -d "." -f 2)
PATCH=$(echo $CURRENT_VERSION | cut -d "." -f 3)

PATCH=$((PATCH + 1))

SNAPSHOT_VERSION="$MAJOR.$MINOR.$PATCH-SNAPSHOT"
echo "New snapshot version: $SNAPSHOT_VERSION"

mvn versions:set -DnewVersion=$SNAPSHOT_VERSION
