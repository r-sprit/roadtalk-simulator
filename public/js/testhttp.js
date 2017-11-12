var request = require('request');


var client_id = 'AXLAcPtOiAt93zowYrTF';
var client_secret = 'raJUusE2dv';
var api_url = "https://openapi.naver.com/v1/search/news.json";
request.post({
        url: api_url,
        body: "query=Hello&display=50&start=1&sort=date",
        headers: {
            'X-Naver-Client-Id': client_id,
            'X-Naver-Client-Secret': client_secret,
            'Content-Type': 'application/json'
        }
    },
    function (error, response, body) {
        console.log(response.statusCode);
        console.log(body);
    });