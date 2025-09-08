const http = require('http');
const server = http.createServer(function(req, res){
    res.write('project for fyp');
    res.end();
});

server.listen(3000);