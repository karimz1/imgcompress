from setuptools import setup, find_packages

setup(
    name='image_converter',
    version='1.0.0',
    description='A tool to convert images to JPEG with optional resizing.',
    author='Karim Zouine',
    author_email='mails.karimzouine@gmail.com',
    packages=find_packages(),
    install_requires=[
        'Pillow>=9.0.0',
        'pyheif>=0.6.0',
    ],
    entry_points={
        'console_scripts': [
            'backend/image-converter=image_converter.bootstraper:main',
        ],
    },
    classifiers=[
        'Programming Language :: Python :: 3',
        'Operating System :: OS Independent',
    ],
    python_requires='>=3.6',
)
