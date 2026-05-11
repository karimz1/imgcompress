#!/bin/bash

set -e

exec python -m backend.image_converter.bootstraper "$@"
