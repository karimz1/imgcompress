import os

REDIRECT_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url={target}">
<link rel="canonical" href="{target}">
<script>window.location.replace("{target}");</script>
</head>
<body>Redirecting to <a href="{target}">{target}</a>...</body>
</html>
"""

def on_post_build(config, **kwargs):
    site_dir = config['site_dir']
    
    for root, _, files in os.walk(site_dir):
        if _should_skip_directory(root, files, site_dir):
            continue
            
        _create_redirect(root)

def _should_skip_directory(root, files, site_dir):
    is_root_dir = root == site_dir
    has_index = 'index.html' in files
    is_404_page = os.path.basename(root) == "404"
    
    return is_root_dir or not has_index or is_404_page

def _create_redirect(root):
    page_name = os.path.basename(root)
    redirect_file_path = os.path.join(os.path.dirname(root), f"{page_name}.html")
    
    if os.path.exists(redirect_file_path):
        return

    target_url = f"./{page_name}/"
    with open(redirect_file_path, 'w') as f:
        f.write(REDIRECT_TEMPLATE.format(target=target_url))
