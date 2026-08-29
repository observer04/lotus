import http from "node:http";
const port=Number(process.env.PORT||process.env.HARNESS_PORT||0);
const server=http.createServer((_req,res)=>{res.statusCode=200;res.setHeader("content-type","text/html");res.end("<!doctype html><title>fixture</title>");});
server.listen(port,"127.0.0.1");
