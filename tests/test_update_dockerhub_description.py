
import pytest
from update_dockerhub_description import rewrite_relative_links

@pytest.fixture(params=["main"])
def base_url(request):
    """
    Fixture for image base URL.
    Example: raw.githubusercontent.com for raw images.
    """
    branch_name = request.param
    return f"https://raw.githubusercontent.com/karimz1/imgcompress/{branch_name}"

@pytest.fixture
def repo_url(base_url):
    """
    Fixture for repo base URL, derived from base_url base but different path 
    to verify separation logic.
    Example: github.com/user/repo/blob/main for file links.
    """
    # Just replacing 'raw.githubusercontent.com' with 'github.com' and adding 'blob' for illustration
    # or just appending '/repo_root' to distinguish it in the string.
    return base_url.replace("raw.githubusercontent.com", "github.com").replace("karimz1/imgcompress", "karimz1/imgcompress/blob")


def test_When_HtmlAnchorContainsRelativeLink_Expect_AbsoluteRepoUrl(base_url, repo_url):
    # Anchor hrefs should use repo_url
    input_md = (
        '| **1** | <a href="images/ui-example/1.jpg">'
        '<img src="./images/ui-example/1.jpg" width="240"/>'
        "</a> | text |\n"
    )

    expected = (
        f'| **1** | <a href="{repo_url}/images/ui-example/1.jpg">'  # Uses repo_url
        f'<img src="{base_url}/images/ui-example/1.jpg" width="240"/>' # Uses base_url
        "</a> | text |\n"
    )

    got = rewrite_relative_links(input_md, base_url, repo_url)
    assert got == expected

def test_When_HtmlImgContainsRelativeLink_Expect_AbsoluteBaseUrl(base_url, repo_url):
    # Images should use base_url
    input_md = '<img src="images/logo_transparent.png" width="10"/>'
    expected = f'<img src="{base_url}/images/logo_transparent.png" width="10"/>'
    
    got = rewrite_relative_links(input_md, base_url, repo_url)
    assert got == expected

def test_When_MarkdownImageContainsRelativeLink_Expect_AbsoluteBaseUrl(base_url, repo_url):
    # Markdown images should use base_url
    input_md = "![alt](images/logo_transparent.png)"
    expected = f"![alt]({base_url}/images/logo_transparent.png)"
    
    got = rewrite_relative_links(input_md, base_url, repo_url)
    assert got == expected

def test_When_LinkIsAbsolute_Expect_NoChange(base_url, repo_url):
    input_md = '[link](https://example.com/a.png)'
    expected = input_md
    
    got = rewrite_relative_links(input_md, base_url, repo_url)
    assert got == expected

def test_When_LinkIsMailto_Expect_NoChange(base_url, repo_url):
    input_md = '[email](mailto:mails.karimzouine@gmail.com)'
    expected = input_md
    
    got = rewrite_relative_links(input_md, base_url, repo_url)
    assert got == expected

def test_When_MarkdownLinkContainsRelativeLink_Expect_AbsoluteRepoUrl(base_url, repo_url):
    """
    This test verifies that standard markdown links (non-images) use repo_url.
    """
    input_md = '👉 **[View the Configuration File (docker-compose-no-internet.yml)](docker-compose-no-internet.yml)**'
    expected = f'👉 **[View the Configuration File (docker-compose-no-internet.yml)]({repo_url}/docker-compose-no-internet.yml)**'
    
    got = rewrite_relative_links(input_md, base_url, repo_url)
    assert got == expected
