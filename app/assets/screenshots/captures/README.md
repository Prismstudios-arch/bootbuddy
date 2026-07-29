# Drop real device screenshots here

Take them on your phone, drop the files in this folder, then run:

```sh
npm run resize-shots
```

Each one is written out at both sizes App Store Connect accepts —
1290×2796 and 1284×2778 — into the `iphone-6.7/` and `iphone-6.5/` folders
alongside this one.

**Name them distinctly** (e.g. `10-real-paywall.png`) or they'll overwrite
the generated screenshots that share a name.

A capture straight off an iPhone 15/16 Pro is 1179×2556, which matches none
of Apple's upload slots — hence this script.
