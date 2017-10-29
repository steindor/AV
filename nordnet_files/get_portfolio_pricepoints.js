/*
    Gets pricepoints for securities that are saved in portfolios
*/

var Nightmare = require('nightmare');
var nightmare = Nightmare({ show: false })
var deferred = require('deferred')
var Xvfb = require('xvfb')
var cheerio = require('cheerio')
var mysql      = require('mysql');

var xvfb = new Xvfb();

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

    });

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

    getPriceofSecurity(security).then(function(results){

        var price = results.price
        , no_of_units = Math.floor(row.value/price)
        , real_value = (no_of_units*price).toFixed(2);

        d.resolve()
        connection.query("UPDATE nn_portfolios SET price = ?, value = ?, no_of_units = ? WHERE id = ?", [price, real_value, no_of_units, row.id], function(err, rows, fields){
            if(err) throw err;
            else {
                console.log("updated row in nn_portfolios!")
                d.resolve()
            };
        });
    })

    return d.promise;
}

var getInsertedPortfolio = function(){

    connection.query("SELECT id, classid, identifier, market_id, holding_ratio, value FROM nn_portfolios WHERE price IS NULL AND no_of_units IS NULL", function(err, rows, fields){
        if(err) throw err;
        else {

            var portfolio = removeRowDataPacket(rows)
            console.log(portfolio)
            
            if(rows.length){

                savePricePoint(portfolio.shift()).then(function next(){
                    if(portfolio.length){
                        savePricePoint(portfolio.shift()).then(next)
                    } else {
                        console.log("portfolio updated!")
                    }
                })
            } else {
                console.log("there are no portfolios to update!")
            }
        };
    });
}()
