#!/bin/sh
set -e  # Exit on any error

echo "=== Building Next.js UI ==="
cd frontend

echo "Installing dependencies..."
npm install

echo "Running Next.js build..."
npm run build

echo "Exporting static site..."
npm run export  # This puts the static site in ./out by default

echo "=== Copying exported UI to backend/static_site ==="
cd ..

mkdir -p backend/image_converter/web_app/static_site/

cp -R frontend/out/* backend/image_converter/web_app/static_site/

echo "Done. The static site is now in backend/static_site/"
