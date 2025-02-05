#!/bin/sh
# Define a cleanup function to kill all background processes
cleanup() {
  echo "Terminating background processes..."
  # Kill all jobs started by this script
  kill $(jobs -p)
}

# Trap EXIT, INT (Ctrl+C), and TERM signals, calling the cleanup function.
trap cleanup EXIT INT TERM

# Start the Flask backend in a subshell with the virtual environment activated
(
  . /venv/bin/activate
  echo "Starting Flask backend using bootstraper"
  exec python ./backend/image_converter/bootstraper.py web
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
