#!/usr/bin/env python3
import os
import re
import argparse
import requests
from datetime import datetime
import requests
from urllib.parse import urljoin

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
        "--repo-url",
        type=str,
        default="",
        help="Base URL for converting relative non-image links to absolute URLs.",
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


def fix_relative_url(url: str, base_url: str) -> str:
    """
    Convert a relative URL to absolute using base_url, normalizing ./ and ../
    via urljoin.
    """
    if not url:
        return url

    url = url.strip()

    # Keep absolute URLs / special schemes / fragments as-is
    if url.startswith(("http://", "https://", "data:", "mailto:", "#", "//")):
        return url

    # urljoin needs base_url to end with '/' to behave like "directory"
    base = base_url.rstrip("/") + "/"
    return urljoin(base, url)


def rewrite_relative_links(markdown_content: str, base_url: str, repo_url: str) -> str:
    """
    Rewrites relative links in Markdown and HTML content to absolute URLs.
    
    This function handles both image sources (e.g., <img src="...">, ![...](...))
    and standard hyperlinks (e.g., <a href="...">, [...](...)).
    
    Args:
        markdown_content (str): The raw markdown/HTML content to process.
        base_url (str): The base URL to use for relative image sources.
        repo_url (str): The base URL to use for relative navigation links.
        
    Returns:
        str: The processed content with all relative paths converted to absolute URLs.
    """

    # 1) Markdown images: ![alt](url)
    md_img_pattern = r'(!\[[^\]]*\]\()([^)]+)(\))'
    def md_img_replacer(m):
        prefix, url, suffix = m.groups()
        return f"{prefix}{fix_relative_url(url, base_url)}{suffix}"
    out = re.sub(md_img_pattern, md_img_replacer, markdown_content)

    # 2) Markdown links (but NOT images): [text](url)
    md_link_pattern = r'(?<!!)(\[[^\]]*\]\()([^)]+)(\))'
    def md_link_replacer(m):
        prefix, url, suffix = m.groups()
        return f"{prefix}{fix_relative_url(url, repo_url)}{suffix}"
    out = re.sub(md_link_pattern, md_link_replacer, out)

    # 3) HTML <img src="...">
    html_img_pattern = r'(<img\s[^>]*?\bsrc\s*=\s*["\'])([^"\']+)(["\'])'
    def html_img_replacer(m):
        prefix, url, suffix = m.groups()
        return f"{prefix}{fix_relative_url(url, base_url)}{suffix}"
    out = re.sub(html_img_pattern, html_img_replacer, out)

    # 4) HTML <a href="...">
    html_a_pattern = r'(<a\s[^>]*?\bhref\s*=\s*["\'])([^"\']+)(["\'])'
    def html_a_replacer(m):
        prefix, url, suffix = m.groups()
        return f"{prefix}{fix_relative_url(url, repo_url)}{suffix}"
    out = re.sub(html_a_pattern, html_a_replacer, out)

    return out

    
    
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

    if args.mock:
        args.base_url = "https://raw.githubusercontent.com/karimz1/imgcompress/"
        args.repo_url = "https://github.com/karimz1/imgcompress/blob/main/"

    if args.base_url and args.repo_url:
        readme_content = rewrite_relative_links(readme_content, args.base_url, args.repo_url)
    else:
        print("No base URL or repo URL provided; skipping link update.")

    if args.mock:
        generated_readme_path = 'readme-generated.md'
        with open(generated_readme_path, 'w', encoding='utf-8') as f:
            f.write(readme_content)
        print(f"Wrote generated README to {generated_readme_path}")
        return
    
    token = get_access_token(dockerhub_username, dockerhub_password)

    print("Obtained token (partially shown):", token[:4] + "...")

    update_dockerhub_description(readme_content, dockerhub_username, token, dockerhub_repo)

if __name__ == "__main__":
    main()
