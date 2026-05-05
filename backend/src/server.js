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
    socket.broadcast.emit("update", {
      id: socket.id,
      x: data.x,
      y: data.y,
      z: data.z,
      state: data.state,
    });
  });

});

server.listen(3000, () => {
  console.log("Server listening on port 3000");
});
