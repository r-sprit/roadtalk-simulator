var express = require('express');
var app = express();
var path = require('path');
var mysql = require('mysql');
var bodyParser = require('body-parser');
var math = require('mathjs');
var request = require('request');
var Q = require("q");


app.set("view options", {layout: false});
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());

var connection = mysql.createConnection({
    host: 'localhost',
    user: 'shoaib',
    password: 'pakistan',
    database: 'ROAD_TALK'
});

connection.connect(function(err) {
    if (err)
        throw err;
    else {
        console.log('Connected to MySQL');
        // Start the app when connection is ready


        var server = app.listen(8450, function () {
            var host = server.address().address;
            var port = server.address().port;

            console.log("Example app listening at http://%s:%s", host, port)
        });
    }
});

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/public/index.html'));
});

app.post('/updateVehcileData', function(req, res) {

    var jsondata = req.body;

    var values = [];


    for(var i=0; i< jsondata.length; i++)
        values.push([
            jsondata[i].roead_id,
            jsondata[i].car_id,
            jsondata[i].speed,
            jsondata[i].acc,
            jsondata[i].x,
            jsondata[i].y,
            jsondata[i].current_lane,
            jsondata[i].past_lane
        ]);

    connection.query('INSERT INTO live_traffic ' +
        '(road_id, car_id, speed, acc, x, y, current_lane, past_lane) VALUES ?', [values],
        function(err,result) {
            if(err) {
                console.log(err);
                console.log("ERROR");
                res.send('Error');
            }
            else {
                res.send('Success');
            }
        });
    //console.log(jsondata);
});

app.get('/getCars', function (req, res) {
    var sql = "SELECT car_id FROM ROAD_TALK.live_traffic " +
        "WHERE time = (select max(time) from live_traffic)";

    connection.query(sql, function (err, result, fields) {
        res.send(result);
    });
});

app.get('/getCurrentRoadAverageSpeed', function (req, res) {
    sql = "select ROUND(avg(speed * 3.6), 2) avg_speed " +
        "from live_traffic group by time_recorded " +
        "order by time_recorded desc limit 1";
    connection.query(sql, function (err, result, fields) {
        res.jsonp(result[0]);
    });
});

app.get('/getAvergeSpeed', function (req, res) {
    var sql = "SELECT @rn:=@rn+1 AS row_id, t1.* FROM " +
        "(select ROUND(avg(speed * 3.6), 2) avg_speed, " +
        "ROUND(avg(acc), 2) avg_acceleration," +
        "ROUND(min(speed * 3.6), 2) + 1 min_speed, " +
        "ROUND(max(speed * 3.6), 2) max_speed, TIME(time_recorded) AS mt_time " +
        "from live_traffic group by time_recorded " +
        "order by time_recorded desc limit 50) t1, (SELECT @rn:=0) t2;";

    var avg_speed = [];
    var min_speed = [];
    var max_speed = [];
    var avg_accel = [];
    connection.query(sql, function (err, result, fields) {
        result.forEach(function(row) {
            avg_speed.push(row.avg_speed);
            min_speed.push(row.min_speed);
            max_speed.push(row.max_speed);
            avg_accel.push(row.avg_acceleration);
        });
        res.jsonp({
            "avg_speed" : math.round(math.mean(avg_speed), 2),
            "min_speed" : math.round(math.mean(min_speed), 2),
            "max_speed" : math.round(math.mean(max_speed), 2),
            "avg_accel" : math.round(math.mean(avg_accel), 2),
            "results" : result
        });
    });
});

app.get('/getVehiclesList', function (req, res) {
    var sql = "SELECT DISTINCT car_id FROM live_traffic\n" +
        "WHERE time_recorded = (SELECT MAX(time_recorded) FROM live_traffic)";
    connection.query(sql, function (err, result, fields) {
        res.jsonp(result);
    });
});

app.get('/getVehicleData/:car_id', function (req, res) {

    var sql = "SELECT @rn:=@rn+1 AS row_id, t1.* FROM " +
        "(select ROUND(speed * 3.6, 2) avg_speed, " +
        "ROUND(acc, 2) avg_acceleration," +
        "ROUND(speed * 3.6, 2) + 1 min_speed, " +
        "ROUND(speed * 3.6, 2) max_speed, TIME(time_recorded) AS time " +
        "from live_traffic where car_id = " + req.params.car_id + " " +
        "order by time_recorded desc limit 50) t1, " +
        "(SELECT @rn:=0) t2;";
    //res.send(sql);
    var avg_speed = [];
    var min_speed = [];
    var max_speed = [];
    var avg_accel = [];
    connection.query(sql, function (err, result, fields) {
        result.forEach(function(row) {
            avg_speed.push(row.avg_speed);
            min_speed.push(row.min_speed);
            max_speed.push(row.max_speed);
            avg_accel.push(row.avg_acceleration);
        });
        res.jsonp({
            "avg_speed" : math.round(math.mean(avg_speed), 2),
            "min_speed" : math.round(math.mean(min_speed), 2),
            "max_speed" : math.round(math.mean(max_speed), 2),
            "avg_accel" : math.round(math.mean(avg_accel), 2),
            "results" : result
        });
    });
});



app.get("/getConjunctionIndexWithFreeFlow/:free_flow", function(req, res) {
    var base_speed = req.params.free_flow;

    var sql = "select *, " +
        "UNIX_TIMESTAMP(time_recorded) AS time_recorded_u " +
        "from live_traffic " +
        "order by time_recorded desc limit 1";
    var x, y, x1, y1, speed, time_recoded, output_var;

    //output_var = {"status" : "ERROR"};
    connection.query(sql, function (err, result, fields) {

        if (result.length == 0) {
            res.jsonp({"Status": "OK", "tindex" : -1});
            return;
        }
        x = result[0].x / 360;
        y = result[0].y / 180;
        time_recoded = result[0].time_recorded_u;


        sql = "select * from live_traffic " +
            "where unix_timestamp(time_recorded) = " + time_recoded ;

        var distance = [];

        var index = 0;
        connection.query(sql, function (err, result, fields) {

            var over_speed = 0;
            var under_speed = 0;
            result.forEach(function(row) {
                x1 = row.x;
                y1 = row.y;
                speed = row.speed * 3.6;

                if (speed <= base_speed) {
                    under_speed = under_speed + 1;
                } else {
                    over_speed = over_speed + 1;
                }
            });
            index = (under_speed - over_speed) / (over_speed + under_speed);
            if (index < 0) {
                index = 0;
            }
            output_var = {"Status": "OK", "tindex" : index};
            res.jsonp(output_var);
        });
    });

});

app.get("/getConjunctionIndex/:car_id", function(req, res) {
    var car_id = req.params.car_id;

    var sql = "select *, " +
        "UNIX_TIMESTAMP(time_recorded) AS time_recorded_u " +
        "from live_traffic " +
        "where car_id = " + car_id + " " +
        "order by time_recorded limit 1";
    var x, y, x1, y1, time_recoded, output_var;

    //output_var = {"status" : "ERROR"};
    connection.query(sql, function (err, result, fields) {

        if (result.length == 0) {
            res.jsonp({"Status": "OK", "tindex" : -1});
            return;
        }
        x = result[0].x / 90;
        y = result[0].y / 90;
        time_recoded = result[0].time_recorded_u;


        sql = "select * from live_traffic " +
            "where unix_timestamp(time_recorded) = " + time_recoded ;

        var distance = [];

        var index = 0;
        connection.query(sql, function (err, result, fields) {

            result.forEach(function(row) {
                x1 = row.x / 90;
                y1 = row.y / 90;

                var _distance = Math.sqrt( Math.pow(x - x1, 2) + Math.pow(y - y1, 2));
                distance.push(_distance);
                index = index + _distance;
            });


            index = math.median(distance)
            var conjustion_level = "Low";
            if ( index <= 3.0) {
                conjustion_level = "Extreme"
            }else if ( index < 3.2 && index >= 3.0) {
                conjustion_level = "High"
            } else if ( index < 3.4 && index >= 3.2) {
                conjustion_level = "Moderate"
            } else if ( index < 4 && index >= 3.4) {
                conjustion_level = "Normal"
            }
            index = Math.round(1 - (1 / index), 4);
            output_var = {"Status": "OK", "tindex" : conjustion_level};
            res.jsonp(output_var);
        });
    });

});

app.get("/getCurrentCarDrivingSkills/:car_id", function(req, res) {
    var car_id = req.params.car_id;
    var output_data = {};


    var sql = "select *, " +
        "UNIX_TIMESTAMP(time_recorded) AS time_recorded_u " +
        "from live_traffic " +
        "where car_id = " + car_id + " " +
        "order by time_recorded limit 1";
    var x, y, x1, y1, time_recoded, output_var;

    output_var = {"status" : "ERROR"};
    connection.query(sql, function (err, result, fields) {

        if (result.length == 0) {
            res.jsonp({"Status": "ERROR"});
            return;
        }
        x = result[0].x / 90;
        y = result[0].y / 90;
        time_recoded = result[0].time_recorded_u;


        sql = "select * from live_traffic " +
            "where unix_timestamp(time_recorded) = " + time_recoded;

        var distance = [];

        var index = 0;
        connection.query(sql, function (err, result, fields) {
            result.forEach(function (row) {
                x1 = row.x / 90;
                y1 = row.y / 90;

                var _distance = Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1, 2));
                distance.push(_distance);
                index = index + _distance;
            });


            index = math.median(distance);
            var conjustion_level = "Good Driving";
            if (index <= 3.0) {
                conjustion_level = "Careful & Attentive"
            } else if (index < 3.2 && index >= 3.0) {
                conjustion_level = "Be Attentive"
            } else if (index < 3.4 && index >= 3.2) {
                conjustion_level = "Be Careful"
            } else if (index < 4 && index >= 3.4) {
                conjustion_level = "Good Driving"
            }
            index = Math.round(1 - (1 / index), 4);
            output_var = {"Status": "OK", "tindex": conjustion_level};

            output_data["driving_skills"] = output_var;
            res.jsonp(output_data);
        });
    });
});

app.get("/getCurrentCarDrivingStyle/:car_id", function(req, res) {
    var car_id = req.params.car_id;
    var output_data = {};
    var sql = "SELECT *, unix_timestamp(time_recorded) AS time_recorded_u " +
        "FROM live_traffic WHERE car_id = 28537 " +
        "ORDER BY time_recorded DESC LIMIT 10 ";

    var total_score;

    connection.query(sql, function (err, result, fields) {

        var speed = [];
        var acc = [];
        var total_lane_changes = 0;
        var speed_score = 0;
        var lane_cange_score = 0;
        var acc_score = 0;


        for(var i = 0; i<result.length; i++) {
            speed.push(result[i].speed);
            acc.push(result[i].acc);
            if (result[i].current_lane - result.past_lane > 2) {
                total_lane_changes += 1;
            }
        }

        var acc_average = math.median(acc);

        sql = "select avg(speed) avg_speed, " +
            " TIME(time_recorded) AS time " +
            "from live_traffic group by time_recorded " +
            "order by time_recorded desc limit 10";

        connection.query(sql, function (err, result, fields) {

            var neighbor_avg_speed = [];
            result.forEach(function(row) {
                neighbor_avg_speed.push(row.avg_speed);
            });
            for (var i = 0; i<10; i++) {
                var margin_speed = speed[i] * 0.2;
                var delta_speed_value = math.abs(speed[i] - neighbor_avg_speed[i]);
                if (delta_speed_value / speed[i] > 0.6) {
                    speed_score += 0;
                } else if (delta_speed_value / speed[i] > 0.5) {
                    speed_score += 15;
                } else if (delta_speed_value / speed[i] < 0.35) {
                    speed_score += 30;
                } else if (delta_speed_value / speed[i] < 0.25) {
                    speed_score += 40;
                }
            }
            speed_score = speed_score / 10;

            if ( total_lane_changes < 3) {
                lane_cange_score  = 30;
            } else if ( total_lane_changes < 5) {
                lane_cange_score  = 15;
            }

            var avg_acc = math.mean(acc);
            var std_acc = math.std(acc);

            if (std_acc  < 1) {
                acc_score = 25;
            } if (std_acc > 1 && atd_acc < 5) {
                acc_score = 15;
            }

            total_score = acc_score + lane_cange_score + speed_score;
            if (total_score < 50) {
                output_data["my_driving_style"] = "Aggressive Driver"
            }
            else if (total_score >= 50 && total_score < 65) {
                output_data["my_driving_style"] = "Normal Driver"
            }
            else if (total_score >= 65) {
                output_data["my_driving_style"] = "Safe Driver"
            }
            res.jsonp(output_data);

        });

    });
});

app.get("/getnavernews", function(req, res) {

    var client_id = 'dvK_oJU8XFF4kyG1bVCJ';
    var client_secret = 'pACS2Bxrrj';

    var api_url = 'https://openapi.naver.com/v1/search/news.json';
    var propertiesObject = {'query' : "강남구", "display" : 5};

    var reuqest_object = {
        url: api_url,
        qs: propertiesObject,
        json: true,
        headers: {
            "content-type": "application/json",
            'X-Naver-Client-Id':client_id,
            'X-Naver-Client-Secret': client_secret
        }
    };
    request.get(reuqest_object, function (error, response, body) {
        //console.log(response);
        res.jsonp(body);
    });

});

app.get("/getHighwayNames", function(req, res) {
    var sql = "SELECT distinct highway_name FROM all_acc_data";
    connection.query(sql, function (err, result, fields) {
        //console.log(result);
        res.jsonp(result);
    });
});

app.get("/getroadindexes/:road_id", function (req, res) {
    var output_data = {};
    function getallroadmatrix() {
        var defered = Q.defer();
        var sql = "SELECT count(highway_name) total_acidients, " +
            "sum(number_of_killed) number_of_killed, " +
            "sum(number_of_severely_injured) as number_of_severely_injured, " +
            "sum(number_of_lightly_injured) as number_of_lightly_injured " +
            "FROM ROAD_TALK.all_acc_data " +
            "WHERE highway_name = '" + req.params.road_id + "'";
        console.log(sql);
        connection.query(sql, defered.makeNodeResolver());
        return defered.promise;
    }

    function getRoadMatrixByMonth() {
        var defered = Q.defer();
        sql = "SELECT month(date) as recoded_date, " +
            "count(highway_name) total_acidients, " +
            "sum(number_of_killed) number_of_killed, " +
            "sum(number_of_severely_injured) as number_of_severely_injured, " +
            "sum(number_of_lightly_injured) as number_of_lightly_injured " +
            "FROM ROAD_TALK.all_acc_data " +
            "WHERE highway_name = '" + req.params.road_id + "' GROUP BY month(date)";
        //console.log(sql);
        connection.query(sql, defered.makeNodeResolver());
        return defered.promise;
    }

    function getRoadMatrixByDay() {
        var defered = Q.defer();
        sql = "SELECT day_of_a_week, " +
            "count(highway_name) total_acidients, " +
            "sum(number_of_killed) number_of_killed, " +
            "sum(number_of_severely_injured) as number_of_severely_injured, " +
            "sum(number_of_lightly_injured) as number_of_lightly_injured " +
            "FROM ROAD_TALK.all_acc_data " +
            "WHERE highway_name = '" + req.params.road_id + "' GROUP BY day_of_a_week";
        //console.log(sql);
        connection.query(sql, defered.makeNodeResolver() );
        return defered.promise;
    }

    function getRoadMatrixHour() {
        var defered = Q.defer();
        sql = "SELECT hour AS hour_of_day, " +
            "count(highway_name) total_acidients, " +
            "sum(number_of_killed) number_of_killed, " +
            "sum(number_of_severely_injured) as number_of_severely_injured, " +
            "sum(number_of_lightly_injured) as number_of_lightly_injured " +
            "FROM ROAD_TALK.all_acc_data " +
            "WHERE highway_name = '" + req.params.road_id + "' GROUP BY hour";
        //console.log(sql);
        connection.query(sql, defered.makeNodeResolver() );
        return defered.promise;
    }

    Q.all([getallroadmatrix(),
        getRoadMatrixByDay(),
        getRoadMatrixByMonth(),
        getRoadMatrixHour()]).then(function(results){
        output_data["all"] = results[0][0];
        output_data["weekly"] = results[1][0];
        output_data["montly"] = results[2][0];
        output_data["hourly"] = results[3][0];
        res.jsonp(output_data);
    });

});

