/*
    Gets pricepoints for securities that are saved in portfolios
*/

var Nightmare = require('nightmare');
var nightmare = Nightmare({ show: false })
var deferred = require('deferred')
var cheerio = require('cheerio')
var mysql      = require('mysql');

var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'gunnitheman',
  database : 'dn_portfolio',
  multipleStatements: true
});

var removeRowDataPacket = function(rows){
    var str = JSON.stringify(rows)
    return JSON.parse(str)
}

var getPriceofSecurity = function(security){

    var d = deferred();

    // baeta vid ef um adra markadi er ad raeda...
    security.market_id = 15;

    var url = (security.classid === undefined) ? "https://www.nordnet.no/mux/web/marknaden/aktiehemsidan/index.html?identifier="+security.identifier+"&marketid="+security.market_id : "https://secust.msse.se/se/nordnetny/funds/overview.aspx?cid="+security.classid

    nightmare
    .on('console', (log, msg) => {
        console.log(msg)
    })
    .goto(url)
    .wait(5000)
    .evaluate(function(){
        var arr = [];
        document.querySelectorAll("tr.first td").forEach(function(elem){
            arr.push(elem.innerText)
        })
        return arr;
    })
    .then(function(results){

        if(security.classid === undefined){
                console.log("it doesnt have a classid!!")
                var price = parseFloat(results[3].replace(",","."))
        } else {
            // if the security has classid
            var arr_new = [];

            results.forEach(function(elem){            
                if(elem.indexOf("NOK") > - 1){
                    arr_new.push(elem);
                }
            })

            var price = parseFloat(arr_new[arr_new.length-2].split(" ")[0])
        }

        security.price = price;

        d.resolve(security)

    })
    return d.promise;
}

var savePricePoint = function(row){
    var d = deferred()
    security = {};

    // if identifier = NULL
    if(!row.identifier){
        security.identifier = undefined;
        security.classid = row.classid
    } else {
        security.identifier = row.identifier;
        security.classid = undefined
    }

    getPricePoint(security).then(function(results){

        connection.query("INSERT INTO nn_price_points (classid, identifier, price) VALUES (?,?,?)", [results.classid, results.identifier, results.price], function(err, rows, fields){
            if(err) throw err;
            else {
                console.log("inserted row into nn price points!")
                d.resolve()
            };
        });
    })

    return d.promise;
}

var getPricePoints = function(){
    var d = deferred()
    connection.query("SELECT DISTINCT(classid), identifier FROM securities_overview", function(err, rows, fields){
        if(err) throw err;
        else {

            var rows = removeRowDataPacket(rows)

            savePricePoint(rows.shift()).then(function next(results){

                if(rows.length){
                    savePricePoint(rows.shift()).then(next)
                } else {
                    console.log("done fetching price points")
                    d.resolve("done")
                }
            })
        };
    });
    return d.promise;
}()

var getPricePoint = function(security){
    var d = deferred()

    getPriceofSecurity(security).then(function(results){
        console.log("get price of security done")
        d.resolve(results)
    })

    return d.promise;
}

module.exports = {
    getPricePoint: getPricePoint
}
