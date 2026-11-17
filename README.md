# Fabric of Space

The solar system in 3D, with every planet on its real orbit and the Sun's gravity field drawn as a sheet you can look around. Open `fabric-of-space.html` in a browser; there is nothing to install.

**Try it live:** [butterflyfx.us/demos/fabric-of-space/](https://butterflyfx.us/demos/fabric-of-space/)

## What it shows

- **Real orbits.** Each planet moves on its real orbit, at its real speed: Mercury from 38.9 to 59.0 km/s, Earth from 29.3 to 30.3, Neptune about 5.4.
- **The field.** The sheet is the Sun's gravity field from Newton's law, summed over the real masses. The planets' own small dips can be enlarged so you can see them.
- **Seasons from the physics.** The dates of the equinoxes and solstices are never entered. They come out of the orbit and Earth's tilted axis.
- **Time as a path.** Seen against the galaxy, each planet leaves a coil behind it as the Sun travels, like a wake.
- **Your view.** Drag to look around, follow Earth, speed time up or slow it to one day in six seconds, and switch between the plain sheet and a spiral drawn flat on it.

## How it is checked

`check.mjs` opens the page in a real browser and checks it against facts it was not given. All 64 checks pass:

- The equinoxes and solstices land on March 20, June 21, September 22 and December 21 (year 2000), and Earth is closest to the Sun on January 4.
- Every planet's position matches NASA JPL Horizons within 0.25 degrees and 0.5%, on six dates (the JPL data is in `jpl/`).
- Every year matches distance to the 1.5 power (Kepler's third law) within 0.2%.
- The field is round to within 0.01% at Earth's distance, as Newton's law says it must be.
- The page works at phone width, with no page errors.

```
npm install
npm run check          (set CHROME_PATH if Chrome is not in its usual place)
```

## What it does not claim

The shapes drawn on the sheet, such as the spiral and the funnel's depth, are depictions to make the field visible. They change no orbit and no number, and the page says so. This began as a test of my own idea that the field around the Sun might be shaped like a snail shell. Measured against the real planets, that shape did not hold: the field is round, as Newton's law says. The page shows the real physics, and the spiral stays as a labeled drawing.

## Credit

Concept and direction: Kenneth W. Bingham. Built with the help of Claude AI under a standing directive to be skeptical, to insist on proof, and to allow no claim that is not demonstrated in tested code. The ideas are the author's; the AI implemented and verified them, it did not originate them.
