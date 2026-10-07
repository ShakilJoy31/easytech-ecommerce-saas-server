const http = require("http");

const app = require("./app/app");

const server = http.createServer(app);

const PORT = process.env.PORT || 2000;

server.listen(PORT, async () => {
  console.log(`server is running at ${PORT}`);
});


 