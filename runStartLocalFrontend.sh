#!/bin/bash
set -euo pipefail

cd frontend/

RUN npm i pnpm -g

pnpm install
pnpm dev