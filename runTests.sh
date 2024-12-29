# !/bin/sh

# Install Python packages
python3 -m venv /venv
. /venv/bin/activate
pip install -r requirements-dev.txt

pytest tests/ \
  --junitxml=reports/test-results.xml \
  --cov=tests/ \
  --cov-report=xml:reports/test-coverage.xml

deactivate

#docker run -it -v /var/run/docker.sock:/var/run/docker.sock devcontainer:local-test /bin/bash
#apk add --no-cache libheif-dev
#pip install --no-cache-dir -r requirements-dev.txt