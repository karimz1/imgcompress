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

    parser.add_argument(
        "--self-test",
        action="store_true",
        help="Run internal link-rewrite assertions and exit",
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


def fix_image_links(markdown_content: str, base_url: str) -> str:
    """
    Replaces relative links with absolute links based on base_url in:
      - Markdown images: ![alt](path)
      - Markdown links:  [text](path)
      - HTML images:     <img src="path" ...>
      - HTML anchors:    <a href="path" ...>
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
        return f"{prefix}{fix_relative_url(url, base_url)}{suffix}"
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
        return f"{prefix}{fix_relative_url(url, base_url)}{suffix}"
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

def run_self_tests() -> None:
    base_url = "https://raw.githubusercontent.com/karimz1/imgcompress/release_0.3.0"

    # Case: HTML <a href="relative"><img src="absolute">
    input_md = (
        '| **1** | <a href="images/ui-example/1.jpg">'
        '<img src="./images/ui-example/1.jpg" width="240"/>'
        "</a> | text |\n"
    )

    expected = (
        '| **1** | <a href="https://raw.githubusercontent.com/karimz1/imgcompress/release_0.3.0/images/ui-example/1.jpg">'
        '<img src="https://raw.githubusercontent.com/karimz1/imgcompress/release_0.3.0/images/ui-example/1.jpg" width="240"/>'
        "</a> | text |\n"
    )

    got = fix_image_links(input_md, base_url)
    assert got == expected, f"anchor href rewrite failed.\nGOT:\n{got}\n\nEXPECTED:\n{expected}"

    # Case: HTML <img src="relative">
    input_md2 = '<img src="images/x.png" width="10"/>'
    expected2 = '<img src="https://raw.githubusercontent.com/karimz1/imgcompress/release_0.3.0/images/x.png" width="10"/>'
    got2 = fix_image_links(input_md2, base_url)
    assert got2 == expected2, f"img src rewrite failed.\nGOT:\n{got2}\n\nEXPECTED:\n{expected2}"

    # Case: Markdown image ![]()
    input_md3 = "![alt](images/x.png)"
    expected3 = "![alt](https://raw.githubusercontent.com/karimz1/imgcompress/release_0.3.0/images/x.png)"
    got3 = fix_image_links(input_md3, base_url)
    assert got3 == expected3, f"markdown image rewrite failed.\nGOT:\n{got3}\n\nEXPECTED:\n{expected3}"

    # Case: Must NOT change absolute
    input_md4 = '[link](https://example.com/a.png)'
    expected4 = input_md4
    got4 = fix_image_links(input_md4, base_url)
    assert got4 == expected4, f"should not rewrite absolute urls.\nGOT:\n{got4}\n\nEXPECTED:\n{expected4}"

    # Case 5: Must NOT change mailto links
    input_md5 = '[email](mailto:mails.karimzouine@gmail.com)' #yep I'm the author...
    expected5 = input_md5
    got5 = fix_image_links(input_md5, base_url)
    assert got5 == expected5, (
        "should not rewrite mailto links.\n"
        f"GOT:\n{got5}\n\nEXPECTED:\n{expected5}"
    )

    print("Self-tests passed ✅")


def main():
    args = parse_args()

    if args.self_test:
        run_self_tests()
        return
    
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
