# Bundled editor fonts

Used by `domain/text_overlay.py` (export) and, as identical copies in
`frontend/public/fonts/`, by the browser preview. All four families are
under the SIL Open Font License 1.1 (licence in each folder as `OFL.txt`);
none declares a Reserved Font Name, so the subset files below may keep their names.

| Font id | Family | Upstream release | Faces |
|---|---|---|---|
| `inter` | Inter 4.1 | https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip (`extras/ttf/`) | Regular, Bold, Italic, BoldItalic |
| `noto-serif` | Noto Serif 2.015 | https://github.com/notofonts/latin-greek-cyrillic/releases/download/NotoSerif-v2.015/NotoSerif-v2.015.zip (`NotoSerif/unhinted/ttf/`) | Regular, Bold, Italic, BoldItalic |
| `jetbrains-mono` | JetBrains Mono 2.304 | https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip (`fonts/ttf/`) | Regular, Bold, Italic, BoldItalic |
| `caveat` | Caveat (google/fonts) | https://github.com/google/fonts/blob/5571d84c0d8c70ec1af4f64072d8c5cf1e4e9643/ofl/caveat/Caveat%5Bwght%5D.ttf | Regular (wght 400), Bold (wght 700); no italics upstream, italic falls back to upright |

## How the files were made

1. Downloaded the files above and checked the sha256 listed below.
2. Caveat only ships as a variable font: static instances at wght=400 and 700
   with `fontTools.varLib.instancer` (fontTools 4.67.0).
3. Every face subset with `pyftsubset` to Latin, Latin Extended, Greek and
   Cyrillic, all OpenType layout features kept, hinting dropped:

   ```
   pyftsubset IN.ttf --unicodes="U+0000-024F,U+0259,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0300-036F,U+0370-03FF,U+0400-052F,U+1C80-1C88,U+1E00-1FFF,U+2000-206F,U+2070-209F,U+20A0-20CF,U+2100-214F,U+2190-2199,U+2212,U+2215,U+2C60-2C7F,U+2DE0-2DFF,U+A640-A69F,U+A720-A7FF,U+FEFF,U+FFFD" --layout-features='*' --no-hinting --name-IDs='*' --name-languages='*' --output-file=OUT.ttf
   ```

## Upstream downloads (sha256)

```
9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e  Inter-4.1.zip
0e9a43c8a4b94ac76f55069ed1d7385bbcaf6b99527a94deb5619e032b7e76c1  NotoSerif-v2.015.zip
6f6376c6ed2960ea8a963cd7387ec9d76e3f629125bc33d1fdcd7eb7012f7bbf  JetBrainsMono-2.304.zip
0bdb6b660482d31531b3945849fba5916b3ef8695da7024a9e6b9ee3c4157988  Caveat[wght].ttf
1f9d81d094273d82f3898a1ee8b598a717d050ecbf5ff7bede105b704880157b  Caveat-OFL.txt
40d692fce188e4471e2b3cba937be967878f631ad3ebbbdcd587687c7ebe0c82  Inter-4.1/extras/ttf/Inter-Regular.ttf
288316099b1e0a47a4716d159098005eef7c0066921f34e3200393dbdb01947f  Inter-4.1/extras/ttf/Inter-Bold.ttf
bbc051dd204b5019a1aa0bc0ae2aa8a05ab13e7a3f979fa357631dc7feb6833a  Inter-4.1/extras/ttf/Inter-Italic.ttf
948405a16cdc62701da5f4005ed068ca5f4d27061d98f7974ccfc37831d9581d  Inter-4.1/extras/ttf/Inter-BoldItalic.ttf
a15cfbbc1539d707115111d672d590a3d70d4f74b4c0a315956da20ae19a14e1  NotoSerif-v2.015/NotoSerif/unhinted/ttf/NotoSerif-Regular.ttf
24ad531e6b05ddad8c3d89572d2c93eb86a6b74e652ce7ee3c3e171de68e84c3  NotoSerif-v2.015/NotoSerif/unhinted/ttf/NotoSerif-Bold.ttf
c4b3c971741ecdb40f5a443bce754e8fe91efe761b6ea10c92be7c3597cdadc4  NotoSerif-v2.015/NotoSerif/unhinted/ttf/NotoSerif-Italic.ttf
1bc4f86502eaa368718f6192bee022ea9a703d5af1c18b7d291212657b63074a  NotoSerif-v2.015/NotoSerif/unhinted/ttf/NotoSerif-BoldItalic.ttf
a0bf60ef0f83c5ed4d7a75d45838548b1f6873372dfac88f71804491898d138f  JetBrainsMono-2.304/fonts/ttf/JetBrainsMono-Regular.ttf
5590990c82e097397517f275f430af4546e1c45cff408bde4255dad142479dcb  JetBrainsMono-2.304/fonts/ttf/JetBrainsMono-Bold.ttf
9d0a1f7a708e6af183f1193b7e81d40da294f5c67682c085d8401c60aac8ded4  JetBrainsMono-2.304/fonts/ttf/JetBrainsMono-Italic.ttf
4039d5ce0ed225bf9c8b2c8c6436290ae2f356b7e90d70fa666227238324aa3b  JetBrainsMono-2.304/fonts/ttf/JetBrainsMono-BoldItalic.ttf
```

## Bundled files (sha256, size in bytes)

```
b0c8ab911a422652a2762b0c3f66e2213ac5b7f6a9459d9eaf017d25c7a5a689  caveat/Caveat-Bold.ttf  246192
856277f9c2890d039039a60c0a308279b4e733ec35a7210934434c19595e9196  caveat/Caveat-Regular.ttf  245856
e4d829be20bc36be6cc21b674f4e8dceba4a67a1e9a1c60b9c78122817cddb83  inter/Inter-Bold.ttf  225880
0f5a4120bed409b4bc0145e1a63537ea85322b9f14097b503ca63fa03ae8a270  inter/Inter-BoldItalic.ttf  228688
2fa230849497728d4ff77d245c1455eda3cab0afceb76eeed3bf16ba32d59693  inter/Inter-Italic.ttf  223808
83149338059b1fb09507aa6020b7c0b8d21bbca199b0d2e842690d4ef1d9394c  inter/Inter-Regular.ttf  221488
ac38d6e173f3afa629b227a5fad481676bdf96b71bb816d6431ee5b3e4123d4e  jetbrains-mono/JetBrainsMono-Bold.ttf  106980
2a510d275782b0384b3ff59f79161daf85aab2f0396a28e5708b08cbfcc1ef59  jetbrains-mono/JetBrainsMono-BoldItalic.ttf  108084
de9b8dcd30b2ea472ef7839a8d2e3d91a11850317be9a3c373f485fb1ed07fd7  jetbrains-mono/JetBrainsMono-Italic.ttf  108068
d6238553aa6313b7ecc96a2f1b0061bb1e9bfe545de40780046934d3b1e456bf  jetbrains-mono/JetBrainsMono-Regular.ttf  106904
21075a3c8cdcfcd71da77ebb7fa15a801c99ed32424662418e98855a6cf48cb5  noto-serif/NotoSerif-Bold.ttf  316420
c710335a22d7dda06266ceb5215b42a771a57508ffd90b85174ac374ba1459a1  noto-serif/NotoSerif-BoldItalic.ttf  344868
e46d0ebc730c0635139b2ba6b30541eb5a69eafc6a26591ae602b38aac691f7d  noto-serif/NotoSerif-Italic.ttf  344932
9d2738f212b58a62826c618bd3e07182441b37f4d00eb6a7b7746631f2612820  noto-serif/NotoSerif-Regular.ttf  320188
```

Total: 3165916 bytes (~3.1 MB) per copy.
