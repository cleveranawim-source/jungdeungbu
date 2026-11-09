#!/usr/bin/env bash
# Firestore 에뮬레이터용 Java 확보: PATH에 없으면 Homebrew openjdk를 앞에 붙인다.
if ! java -version >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    PATH="$(brew --prefix openjdk)/bin:$PATH"
    export PATH
  fi
fi
if ! java -version >/dev/null 2>&1; then
  echo "Java가 없어요. \`brew install openjdk\` 후 다시 실행해 주세요"
  exit 1
fi
exec "$@"
