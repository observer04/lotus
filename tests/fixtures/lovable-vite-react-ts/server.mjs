import http from "node:http"; const port=Number(process.env.PORT||5173); http.createServer((_q,r)=>{r.end("ok")}).listen(port,"127.0.0.1");
