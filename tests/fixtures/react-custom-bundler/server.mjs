import http from "node:http";
const port=Number(process.env.PORT||3000);
http.createServer((_request,response)=>response.end("ok")).listen(port,"127.0.0.1");
