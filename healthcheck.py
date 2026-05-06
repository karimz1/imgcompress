import urllib.request
import sys

def check_health():
    url = 'http://localhost:5000/api/health/backend'
    try:
        response = urllib.request.urlopen(url, timeout=5)
        if response.status == 200:
            print("Healthcheck passed.")
            sys.exit(0)
        else:
            print(f"Healthcheck failed with status {response.status}.")
            sys.exit(1)
    except Exception as e:
        print(f"Healthcheck failed with exception: {e}")
        sys.exit(1)

if __name__ == '__main__':
    check_health()
