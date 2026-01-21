import re
import json
import os

def generate_version_json():
    input_path = 'frontend/public/release-notes.md'
    output_dir = 'docs/api'
    
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Error: {input_path} not found. Check your file path!")
        return

    # Regex to find the first version block (e.g., ## v0.3.9 — 2026-01-04)
    pattern = r"## (v[\d\.]+)\s*—\s*([\d-]+)\n([\s\S]*?)(?=\n##|$)"
    match = re.search(pattern, content)

    if match:
        version = match.group(1)
        date = match.group(2)
        
        # Clean up the bullet points into a list
        raw_notes = match.group(3).strip().split('\n')
        notes = [line.strip('- ').strip() for line in raw_notes if line.strip()]

        data = {
            "version": version,
            "release_date": date,
            "changelog": notes,
            "url": f"https://github.com/karimz1/imgcompress/releases/tag/{version}"
        }

        os.makedirs(output_dir, exist_ok=True)
        
        output_file = os.path.join(output_dir, 'latest-version.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)
            
        print(f"Success! Generated JSON for {version} at {output_file}")
    else:
        print("Could not find version pattern in release-notes.md")

if __name__ == "__main__":
    generate_version_json()