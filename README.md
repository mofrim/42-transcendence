_This project was created as part of the 42 curriculum by
alice, bob, freddy, jeff, and mandy._

> **Note**: I did remove any personal info regarding my team-mates in order to keep
> their data as private as possible. Thx to `git-filter-repo` ;) <br>
> In this repo i will try to advance the project every now and then up to a
> point where it can be released to the school's public for further community
> based (if this will ever happen)

# ft_transcendence...

_This_ **ft_transcendence** is a browser-based multiplayer 3D game set in a virtual
42 campus. Players can explore the environment, interact with NPCs and objects,
complete quests, communicate with other players, and challenge them to
mini-games.

The project combines a React and Three.js frontend with four TypeScript/Express
backend services. Real-time communication is provided by Socket.IO, while
authentication, user state, friendships, event logs, and game results are
handled by backend services backed by PostgreSQL.

Microservices are a central architectural part of this project. Instead of
using one monolithic backend, the application separates backend responsibilities
into focused services:
