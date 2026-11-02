#!/bin/sh
set -e
cd "$(dirname "$0")/.."
JAR=tools/tla2tools.jar
JAVA=java
[ -x /opt/homebrew/opt/openjdk/bin/java ] && JAVA=/opt/homebrew/opt/openjdk/bin/java
if [ ! -f "$JAR" ]; then
  mkdir -p tools
  curl -sSL https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar -o "$JAR"
fi
cd formal
for spec in GamePhase CutsceneFlow; do
  "$JAVA" -XX:+UseParallelGC -cp "../$JAR" tlc2.TLC -workers auto -metadir "../tools/states" -config "$spec.cfg" "$spec.tla"
done
