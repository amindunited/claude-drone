# Claude Drone

A web based drone synth created using the Claude AI model.

## Creation

This project was created by [A Mind United](https://amindunited.com) as a demonstration of the capabilities of the Claude AI model in a web audio based synth.

It was created with the prompt: `Using typescript and the web audio api create a drone synth with adjustable filters, LFOs and effects`


[Demo](https://amindunited.github.io/claude-drone/)

## Local dev

- `npm run dev` serves the root pages at http://localhost:5173/claude-drone/
- `npm run dev:strata` serves the STRATA drone synth (the `drone-synth/` workspace) at http://localhost:5174/claude-drone/drone-synth.html. The STRATA link on the root index redirects there while this server is running.