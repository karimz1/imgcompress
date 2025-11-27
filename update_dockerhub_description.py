import os
import re
import argparse
import requests
from datetime import datetime
import requests

# leave for debugging using .env file
# from dotenv import load_dotenv
# load_dotenv()


def parse_args():
    """
    Parse command-line arguments.
    """
    parser = argparse.ArgumentParser(
        description="Update Docker Hub repository description from a README file."
    )
    parser.add_argument(
        "--readme",
        type=str,
        default="README.md",
        help="Path to the README file (default: README.md)",
    )
    parser.add_argument(
        "--base-url",
        type=str,
        default="",
        help="Base URL for converting relative image links to absolute URLs.",
    )
    parser.add_argument(
        "--branch",
        type=str,
        default="",
        help="The branch that triggered the update (e.g., refs/heads/main).",
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Do not perform Docker Hub update"
    )

    return parser.parse_args()

def read_file(file_path: str) -> str:
    """
    Reads and returns the content of the specified file.
    """
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            return file.read()
    except Exception as e:
        raise RuntimeError(f"Error reading {file_path}: {e}")


def fix_image_links(markdown_content: str, base_url: str) -> str:
    """
    Replaces all relative image links in the markdown with absolute links
    based on the provided base_url. Also handles HTML <img src="…"> attributes.
    
    Markdown image syntax: ![alt text](image_path)
    HTML image syntax:     <img src="image_path" ...>

    Tip for later:
        To convert the raw content into a neatly formatted Markdown file, first save the value of the 'replaced_markdown_content' variable to a file—e.g., replaced-content.txt.
        Then run the following command in a Unix-like shell:

    ``printf '%b\n' "$(cat replaced-content.txt)" > clean.md``  (Unix-like shells).
    """
    # — markdown replacement —
    md_pattern = r'(!\[[^\]]*\]\()([^)]+)(\))'
    def md_replacer(match):
        prefix, url, suffix = match.groups()
        if url.startswith(("http://", "https://")):
            return match.group(0)
        return f"{prefix}{base_url.rstrip('/')}/{url.lstrip('/')}{suffix}"

    replaced_markdown_content = re.sub(md_pattern, md_replacer, markdown_content)

    # — HTML <img> replacement —
    html_pattern = r'(<img\s[^>]*?\bsrc\s*=\s*["\'])([^"\']+)(["\'])'
    def html_replacer(match):
        prefix, url, suffix = match.groups()
        if url.startswith(("http://", "https://")):
            return match.group(0)
        return f"{prefix}{base_url.rstrip('/')}/{url.lstrip('/')}{suffix}"

    replaced_markdown_content = re.sub(html_pattern, html_replacer, replaced_markdown_content)
    return replaced_markdown_content
    
    
def get_access_token(username: str, password: str) -> str:
    """
    # use doc: https://docs.docker.com/reference/api/hub/latest/#tag/authentication-api/operation/AuthCreateAccessToken
    
    Creates and returns a short-lived access token in JWT format for use as a bearer when calling Docker APIs.
    
    Returns:
        token (str): JWT token string.
    """
    
    login_url = "https://hub.docker.com/v2/auth/token"

    payload = {"identifier": username, "secret": password}
    
    response = requests.post(login_url, json=payload)

    if response.status_code != 200:
        raise RuntimeError(
            f"Login failed: HTTP {response.status_code}\n{response.text}"
        )
    
    token = response.json().get("access_token")
    if not token:
        raise RuntimeError("Login succeeded but no token was found in the response.")
    
    return token



def update_dockerhub_description(readme_content: str, username: str, token: str, repo: str) -> None:
    """
    Updates the Docker Hub repository's description using the Docker Hub API,
    always with a JWT token for write access.
    Appends a timestamp to indicate the last auto-update time.
    """
    # Append a timestamped note to the bottom of the README content
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    final_content = (
        readme_content
        + f"\n\n---\n_Auto-updated at {timestamp}._"
    )
    
    payload = {"full_description": final_content}
    url = f"https://hub.docker.com/v2/repositories/{username}/{repo}/"
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"JWT {token}"
    }
    
    print("Using JWT token for authentication.")
    print("PATCH URL:", url)
    print("Payload:", payload)
    
    response = requests.patch(url, json=payload, headers=headers)
    
    print("Response status code:", response.status_code)
    print("Response text:", response.text)
    
    if response.status_code == 200:
        print("Successfully updated Docker Hub repository description!")
    else:
        raise RuntimeError(
            f"Failed to update description: HTTP {response.status_code}\n{response.text}"
        )

def main():
    args = parse_args()

    if args.mock == False:
        try:
            dockerhub_username = os.environ["DOCKERHUB_USERNAME"]
            dockerhub_password = os.environ["DOCKERHUB_PASSWORD"]
            dockerhub_repo = os.environ["DOCKERHUB_REPO"]
        except KeyError as e:
            raise RuntimeError(f"Missing required environment variable: {e}")

    readme_content = read_file(args.readme)

    if args.base_url:
        readme_content = fix_image_links(readme_content, args.base_url)
    else:
        print("No base URL provided; skipping image link update.")

    if args.mock:
        return
    
    token = get_access_token(dockerhub_username, dockerhub_password)

    print("Obtained token (partially shown):", token[:4] + "...")

    update_dockerhub_description(readme_content, dockerhub_username, token, dockerhub_repo)

if __name__ == "__main__":
    main()
