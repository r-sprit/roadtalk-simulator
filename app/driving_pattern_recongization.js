var path = require('path');
var mysql = require('mysql');
var bodyParser = require('body-parser');
var math = require('mathjs');
var request = require('request');

var connection = mysql.createConnection({
    host: '14.63.195.20',
    user: 'shoaib',
    password: 'pakistan',
    database: 'ROAD_TALK'
});

connection.connect(function(err) {
    if (err) {
        throw err;

    } else {
        console.log('Connected to MySQL');
        var sql = "SELECT *, unix_timestamp(time_recorded) AS time_recorded_u " +
            "FROM live_traffic WHERE car_id = 28537 " +
            "ORDER BY time_recorded DESC LIMIT 10 ";

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

            console.log(speed);
            console.log(acc);
            console.log(total_lane_changes);


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
                console.log(delta_speed_value);

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

                var total_score = acc_score + lane_cange_score + speed_score;

                console.log(total_score);

            });

        });
    }

    //process.exit(1);

});