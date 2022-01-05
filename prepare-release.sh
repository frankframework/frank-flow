#!/bin/bash

echo "Version = $1"
SNAPSHOT_VERSION="${$1}-SNAPSHOT"
echo "Snapshot version = $JAR_VERSION"

mvn versions:set -DnewVersion=$JAR_VERSION

printenv