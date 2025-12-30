from setuptools import setup, find_packages

setup(
    name='image_converter',
    version='1.0.0',
    description='A tool to convert images to JPEG with optional resizing.',
    author='Karim Zouine',
    author_email='mails.karimzouine@gmail.com',
    license='GPL-3.0-or-later',
    packages=find_packages(),
    install_requires=[
        'Pillow>=9.0.0',
        'pyheif>=0.6.0',
        'pypdfium2>=4.30.0',
    ],
    entry_points={
        'console_scripts': [
            'image-converter=backend.image_converter.bootstraper:main',
        ],
    },
    classifiers=[
        'Programming Language :: Python :: 3',
        'Operating System :: OS Independent',
        'License :: OSI Approved :: GNU General Public License v3 (GPLv3)',
    ],
    python_requires='>=3.6',
)
