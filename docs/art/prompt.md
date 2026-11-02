# Cover art prompt

Sent to `gemini-3.1-flash-lite-image` at 1K and 1:1, with `style-reference.png` as the reference image. `{{subject}}` comes from
the small text model. Post-process with: greyscale, `-level 10%,85%`, trim, fit to 98% width and 78% height, seat at the
bottom of a white square, WebP quality 60.

```
Draw one small ink illustration for a printed book catalog.

Subject: {{subject}}

It must be instantly recognisable at the size of a postage stamp: one bold, simple shape with a strong silhouette, and few details.

Composition: the top quarter of the square is completely empty bare white paper, because a title gets printed there. The subject is large: it fills the lower three-quarters, nearly the full width of the square, and is grounded at the bottom edge. Ground, water or grass may run off the bottom and sides of the picture. There is no frame, border, box, rectangle, corner mark or panel of any kind, and no straight line around the picture. The drawing's edges thin out into a few loose hatch strokes and then bare paper, so you can't see where the picture ends. There is no sky drawn at all, only bare paper. There is nothing behind the subject.

Style: match the attached reference sheet exactly, in technique and composition but not subject. Pure black ink on pure white paper, like a fine old steel engraving in a Victorian book, not a linocut. Rich solid black shadows, with form modelled by many fine curved engraved lines. Mid-tones only from visible black hatch lines. Absolutely no grey wash, no shading gradient, and no fine overall texture. Lots of bare white paper.

No text, letters, numbers, titles or signatures. No colour.
```
