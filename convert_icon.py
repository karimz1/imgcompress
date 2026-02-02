from PIL import Image
import sys

def convert_ico_to_png(ico_path, png_path):
    try:
        img = Image.open(ico_path)
        
        img.save(png_path, format='PNG')
        print(f"Successfully converted {ico_path} to {png_path}")
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    convert_ico_to_png("docs/images/favicon.ico", "docs/images/apple-touch-icon.png")
    convert_ico_to_png("docs/images/favicon.ico", "docs/images/favicon.png")
