# Bundled fonts

Self-hosted so a build never depends on Google Fonts being reachable (the
build-time download from Google intermittently failed, and failed the deploy).

Latin subset, variable fonts, SIL Open Font License 1.1:

- `Inter-latin-var.woff2` — Inter (v20), weights 100–900
- `SpaceGrotesk-latin-var.woff2` — Space Grotesk (v22), weights 300–700

Source: fonts.googleapis.com (css2, Chrome user agent) -> fonts.gstatic.com.
