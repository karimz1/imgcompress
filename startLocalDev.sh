#!/bin/sh
# Start the Flask backend in a subshell with the virtual environment activated
(
  . /venv/bin/activate
  echo "Starting Flask backend on port 5000..."
  exec python -m flask --app ./backend/image_converter/web_app/app.py run --host=0.0.0.0 --port=5000
) &

# Start the Node.js frontend in its own subshell
(
  cd frontend || exit 1
  echo "Installing frontend dependencies..."
  npm install --legacy-peer-deps

  echo "Starting Node.js frontend (dev mode)..."
  exec npm run dev
) &

# Wait for both background processes to finish
wait
