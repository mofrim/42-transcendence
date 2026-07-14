_This project has been created as part of the 42 curriculum by alice, bob, freddy, jeff, mandy._

# ft_transcendence - A School 3D game

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

---
⬇️⬇️⬇️ **MANDATORY README STARTS HERE** ⬇️⬇️⬇️

## Description

> **Description** section that clearly presents the project, including its goal and a
brief overview.

## Instructions

> **Instructions** section containing any relevant information about compilation,
installation, and/or execution.

## Resources

> **Resources** section listing classic references related to the topic (documen-
tation, articles, tutorials, etc.), as well as a description of how AI was used —
specifying for which tasks and which parts of the project.

- A very nice & concise refresher about JS - <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Language_overview>

- The Three.JS manual - <https://threejs.org/manual/#en/installation>

- The Three.JS Reference - <https://threejs.org/docs/>

- A brand new article describing exactly our backend tech-stack - <https://www.xjavascript.com/blog/socket-io-typescript-express/>

## Team Information

    For each team member mentioned at the top of the README.md, you must provide:
    - Assigned role(s): PO, PM, Tech Lead, Developers, etc.
    - Brief description of their responsibilities.
    - **5 people** : Roles can be more specialized, with dedicated PO,
        PM, Tech Lead, and 2 Developers.

    All roles must be clearly documented in your README.md.

## Project Management

    - How the team organized the work (task distribution, meetings, etc.).
    - Tools used for project management (GitHub Issues, Trello, etc.).
    - Communication channels used (Discord, Slack, etc.).

## Technical Stack

    - Frontend technologies and frameworks used.
    - Backend technologies and frameworks used.
    - Database system and why it was chosen.
    - Any other significant technologies or libraries.
    - Justification for major technical choices.

## Database Schema

    - Visual representation or description of the database structure.
    - Tables/collections and their relationships.
    - Key fields and data types.

## Features List
    - Complete list of implemented features.
    - Which team member(s) worked on each feature.
    - Brief description of each feature’s functionality.
## Modules
    - List of all chosen modules (Major and Minor).
    - Point calculation (Major = 2pts, Minor = 1pt).
    - **Justification for each module choice** , especially for custom "Modules of
       choice".
    - How each module was implemented.
    - Which team member(s) worked on each module.

## Individual Contributions

    - Detailed breakdown of what each team member contributed.
    - Specific features, modules, or components implemented by each person.
    - Any challenges faced and how they were overcome.
    Any other useful or relevant information is welcome (usage documentation, known
    limitations, license, credits, etc.).

