# !/bin/sh



# Install Python dependencies
pip install --no-cache-dir -r requirements-dev.txt


pytest tests/ \
  --junitxml=reports/test-results.xml \
  --cov=tests/ \
  --cov-report=xml:reports/test-coverage.xml



#docker run -it -v /var/run/docker.sock:/var/run/docker.sock devcontainer:local-test /bin/sh
#apk add --no-cache libheif-dev
#pip install --no-cache-dir -r requirements-dev.txt