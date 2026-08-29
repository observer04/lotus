import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root=process.cwd(); const port=Number(process.env.PORT||4173);
const types={".html":"text/html",".js":"text/javascript"};
http.createServer((req,res)=>{const p=req.url==="/"?"index.html":req.url.slice(1);const abs=path.join(root,p);if(!abs.startsWith(root)||!fs.existsSync(abs)){res.statusCode=404;return res.end("not found");}res.setHeader("content-type",types[path.extname(abs)]||"text/plain");res.end(fs.readFileSync(abs));}).listen(port,"127.0.0.1");
