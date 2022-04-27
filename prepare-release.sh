#!/bin/bash

echo "Release version: $1"

mvn versions:set -DnewVersion=$1