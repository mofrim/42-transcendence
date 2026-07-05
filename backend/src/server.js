import http from 'http'
import { Server } from 'socket.io'

const server = http.createServer();

const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // notify others
  socket.broadcast.emit("player_connected", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    socket.broadcast.emit("player_disconnected", socket.id);
  });

  socket.on("update", (data) => {
    //console.log("Server datatype: " + data.type);
    switch (data.type) {
      case "player_update":
        socket.broadcast.emit("update", {
          type: "player_update",
          id: socket.id,
          x: data.x,
          y: data.y,
          z: data.z,
          state: data.state,
        });
        break;
      
      case "ttt_update":
        socket.broadcast.emit("update", {
          type: "ttt_update",
          id: socket.id,
          board: data.board,
        });
        break;

      case "ttt_start":
        socket.broadcast.emit("update", {
          type: "ttt_start",
          id: socket.id,
        });
        break;

      case "rps_update":
        socket.broadcast.emit("update", {
          type: "rps_update",
          id: socket.id,
          reqPlayerID: data.reqPlayerID,
        });
        break;

      case "rps_accept":
        socket.broadcast.emit("update", {
          type: "rps_accept",
          id: socket.id,
          reqPlayerID: data.reqPlayerID,
        });
        break;

      case "rps_decline":
        socket.broadcast.emit("update", {
          type: "rps_decline",
          id: socket.id,
          reqPlayerID: data.reqPlayerID,
        });
        break;

      case "rps_choice":
        socket.broadcast.emit("update", {
          type: "rps_choice", 
          id: socket.id,
          choice: data.choice,
          reqPlayerID: data.reqPlayerID,
        });
        break;

      default:
        console.log("Unknown data type:", data.type);

    }
  });
});



server.listen(3000, () => {
  console.log("Server listening on port 3000");
});
