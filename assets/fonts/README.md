# GOAT Universe typography

Manrope is used for headings, navigation and the numbered competition identities.
Inter is used for body copy, controls and supporting labels. Both are freely
licensed under the SIL Open Font License 1.1; the complete licenses are included.

These variable WOFF files are served from the same origin as the homepage. There
are no font-service requests or paid font dependencies. `font-display: swap` keeps
the page readable while the fonts load.

Sources downloaded on 2026-10-15:

- https://github.com/google/fonts/tree/main/ofl/manrope (`Manrope[wght].ttf`)
- https://github.com/google/fonts/tree/main/ofl/inter (`Inter[opsz,wght].ttf`)

The source fonts were subset with FontTools to Latin, punctuation, currency,
arrows and the infinity symbol used by this English-language site, then encoded
as WOFF. Both font families retain their variable weight axes; Inter also retains
its optical-size axis. Future translations should extend the subsets as needed.
