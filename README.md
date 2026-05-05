# ft_transcendence

## Current build / dev instruction

In order to run the frontend in dev mode (local, no container):

- install `nodejs` (at best >=v22) on you system
- `cd frontend/`
- in a fresh clone run `npm i`
- `npm run dev`

For multiplayer we need the socket.io-server from `backend/src/server.js`.
To run this this in dev mode (local, no container):

- install `nodejs` (at best >=v22) on you system
- `cd backend/`
- in a fresh clone run `npm i`
- `npm run dev`

To run both backend & frontend from the docker-compose file in repo root:

- `docker compose up --build` ( the `--build` is only necessary the first time)
- optionally add `-d` to run the whole thing in background
- Then open `localhost:1111` in a browser

I created most additional files in the `frontend`-dir via `npm create
vite@latest` with *Typescript* and *React* selected in the dialog. I left the
`frontend/README.MD` has also been generated with the template. Maybe there's
information in there we might need later on....

Added `.editorconfig, .prettierrc, ...` files in order to make code formatting
consistent across all our editors.
