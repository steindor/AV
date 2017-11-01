var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var Xvfb = require('xvfb')
var cheerio = require('cheerio')
var request = require('request')
var deferred = require('deferred')
var http = require('http')

var _ = require('underscore')
var crontab = require('node-crontab');
var Nightmare = require('nightmare');
var fs = require('fs')
var dexec = require( 'deferred-exec' );
var nordnet = require('./nordnet_files/get_mon_status_from_account.js')
var url = require('url')
var session = require('client-sessions');
var moment = require('moment')
var readline = require('readline')
var pdfUtil = require('pdf-to-text');
var nightmare = Nightmare({ show: true })
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

/*
    TODO NOW : setja upp git repository med tveimur greinum:
        1. Minni version med minum stillingum
        2. Version med theim features sem tharf til ad gera WealthFront / Betterment function
*/

/*
    1. BUY: When monthly price > 10 month SMA
    2. SELL: When monthly price < 10 month SMA  

subrules:
    1. All entry and exit prices are on the day of the signal at the close. The model is only updated once a month on the last day of the month. Price fluctuations during the rest of the month are ignored.
    2. All data series are total return series including dividends, updated monthly.
    3. Cash returns are estimated with 90-day Treasury bills, and margin rates (for leveraged models to be discussed later) are estimated with the broker call rate.
    4. Taxes, commissions, and slippage are excluded (see the Practical Considerations section later in the paper).
*/


(function() {
    var childProcess = require("child_process");
    var oldSpawn = childProcess.spawn;
    function mySpawn() {
        console.log('spawn called');
        console.log(arguments);
        var result = oldSpawn.apply(this, arguments);
        return result;
    }
    childProcess.spawn = mySpawn;
})();

// base model
var timing_portfolio_base = [{
    holdings: [{
        name: "US LARGE CAP",
        holding_ratio:0.2
    },{
        name: "FOREIGN DEVELOPED",
        holding_ratio:0.2
    },{
        name: "US 10 YEAR GOV BONDS",
        holding_ratio:0.2
    },{
        name: "COMMODITIES",
        holding_ratio:0.2
    },{
        name: "REITS",
        holding_ratio:0.2
    }]
}]

// extended model
var timing_portfolio_base = [{
    holdings: [{
        name: "US LARGE CAP VALUE",
        holding_ratio:0.05
    },{
        name: "US LARGE CAP MOMENTUM",
        holding_ratio:0.05
    },{
        name: "US SMALL CAP VALUE",
        holding_ratio:0.05
    },{
        name: "US SMALL CAP MOMENTUM",
        holding_ratio:0.05
        // Aksjenorge indeks II - 20%
    },{
        name: "FOREIGN DEVELOPED",
        holding_ratio:0.1
        // KLP AksjeGlobal Indeks V
    },{
        name: "FOREIGN EMERGING",
        holding_ratio:0.1
        // KLP AKSJE Fremvoksende Markeder Indeks II
    },{
        name: "US 10 YEAR GOV BONDS",
        holding_ratio:0.05
        // 10 ara norsk bonds
    },{
        name: "FOREIGN 10 YEAR GOV BONDS",
        holding_ratio:0.05
        // erlend bonds
    },{
        name: "US CORP CONDS",
        holding_ratio:0.05
        // Landkreditt Extra
    },{
        name: "US 30 YEAR GOV BONDS",
        holding_ratio:0.05
    },{
        name: "COMMODITIES",
        holding_ratio:0.1
    },{
        name: "GOLD",
        holding_ratio:0.1
    },{
        name: "REITS",
        holding_ratio:0.1
    }]
}]

var extended_model_nor = [{
    u_hash: "68fe782e5651504aa6c017a8b40d7af5",
    value: 1000000,
    portfolio_name: "EXTENDED_10_MO_SMA_UNLEVERAGED_WITH_MONTHLY_REBALANCE_(RSI_INDEX_TOP_6)",
    holdings: [{
        long_name: "KLP Aksjenorge Indeks II",
        classid: "F000002489",
        holding_ratio:0.1
    },{
        long_name: "KLP AksjeEuropa Indeks IV",
        classid: "F00000WEGG",
        holding_ratio:0.1
    },{
        long_name: "KLP Aksje Fremvoksende Markeder Indeks II",
        holding_ratio:0.1,
        classid: "F00000MKDH"
    },{
        long_name: "Parvest Equity Nordic Small Cap Classic H NOK-Capitalisation",
        classid: "F00000YCUS",
        holding_ratio: 0.1
    },{
        long_name: "KLP Statsobligasjon",
        classid: "F000002T8X",
        holding_ratio:0.05
    },{
        long_name: "KLP Obligasjon Global II",
        classid: "F000002KH8",
        holding_ratio:0.05
    },{
        long_name: "FONDSFINANS KREDITT",
        holding_ratio: 0.05,
        classid: "F00000PWB1"
    },{
        long_name: "KLP Obligasjon 5 år",
        classid: "CL00013797",
        holding_ratio:0.05,
    },{
        long_name: "Handelsbanken Råvarefond",
        classid:"0P0000PV9R",
        holding_ratio:0.1
    },{
        long_name: "LONG GULL ND",
        identifier: "2064206",
        holding_ratio:0.1
    },{
        long_name: "Alfred Berg Nordisk Eiendom C",
        classid: "F00000WA0O",
        holding_ratio:0.2
    }],
}]

/*
    GTAA Aggressive
    1. Byrjar med extended model og velur svo top 6 av 13 eignum eins og medaltol 1,3,6,12 manada total returns gefur
    2. Eignir eru bara keyptar ef thaer eru yfir 200
    3. Leverage - haegt ad leverage t.d. bara bond funds?

    Setja upp thrja fonds - 
    1. Venjulegur
    2. Leveraged bonds x 2
    4. Leveraged allur x 2 - hvad med kredit og kaupkostnad?
*/

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(function(req,res,next){
    res.locals.session = req.session;
    next();
});

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(ignoreFavicon)
app.use(require('stylus').middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// sessions settings
app.use(session({
  cookieName: 'session',
  secret: 'kYfUmo4BTU57giWCAdiU',
  duration: 30 * 60 * 1000,
  activeDuration: 5 * 60 * 1000,
}));

var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'gunnitheman',
  database : 'dn_portfolio',
  multipleStatements: true
});

var NN_user_info = {
    user: "steoell@gmail.com",
    password: "6HFBt>Vm"
}

connection.connect();

function checkIfLoggedIn(req, res, next){
    if(!req.session.email || !req.session.u_hash){
        res.redirect("/login");
    } else {
        next();
    };
}

// Extend the default Number object with a formatMoney() method:
// usage: someVar.formatMoney(decimalPlaces, symbol, thousandsSeparator, decimalSeparator)
// defaults: (2, "$", ",", ".")
Number.prototype.formatMoney = function(places, symbol, thousand, decimal) {
    places = !isNaN(places = Math.abs(places)) ? places : 2;
    symbol = symbol !== undefined ? symbol : "$";
    thousand = thousand || ",";
    decimal = decimal || ".";
    var number = this, 
        negative = number < 0 ? "-" : "",
        i = parseInt(number = Math.abs(+number || 0).toFixed(places), 10) + "",
        j = (j = i.length) > 3 ? j % 3 : 0;
    return symbol + negative + (j ? i.substr(0, j) + thousand : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thousand) + (places ? decimal + Math.abs(number - i).toFixed(places).slice(2) : "");
};

// ignore the favicon request

function ignoreFavicon(req, res, next) {
  if (req.originalUrl === '/favicon.ico') {
    res.status(204).json({nope: true});
  } else {
    next();
  }
}

var checkUrlExists = function (url, callback) {

    request(url, function(error, response, html){
        if(!error){
            var $ = cheerio.load(html)

            // check the html for this string(if pdf doesnt exist, this will return an array, otherwise null when the pdf exists)
            var redirect = html.match("redirect_tekniskfeil");

            if(redirect === null){
                callback({ document_exists: true })
            } else {
                callback({ document_exists: false })
            }
        }
    });

}

var download_file_curl = function(file_url, DOWNLOAD_DIR) {
    var spawn = require('child_process').spawn

    var d = deferred()
    // extract the file name
    var file_name = url.parse(file_url).pathname.split('/').pop();
    // create an instance of writable stream
    var file = fs.createWriteStream(DOWNLOAD_DIR + file_name);
    // execute curl using child_process' spawn function
    var curl = spawn('curl', [file_url]);
    // add a 'data' event listener for the spawn instance
    curl.stdout.on('data', function(data) { file.write(data); });
    // add an 'end' event listener to close the writeable stream
    curl.stdout.on('end', function(data) {
        file.end();
        console.log(file_name + ' downloaded to ' + DOWNLOAD_DIR);
        d.resolve(200)
    });

    // when the spawn child process exits, check if there were any errors and close the writeable stream
    curl.on('exit', function(code) {
        if (code != 0) {
            console.log('Failed: ' + code);
            d.resolve(code)
        }
    });
    return d.promise;
};

 // var exec = require("child_process").exec

    // console.log("This works");
    // var watcher = exec("DEBUG=nightmare xvfb-run -a node nordnet_files/get_pricepoint.js "+holding.classid)
    // .on('error', function(error) {
    //     throw error
    // })
    // // .stdout.on('data', function(data) {
    // //     // console.log("results: "+data)
    // //     var results = process.stdout.write(data.toString());
    // //     cb(results)
    // // })
    // .on('exit', function(data) {
    //     var results = process.stdout.write(data.toString());
    //     cb(results)
    // })

    // dexec.spawn("xvfb-run -a node /home/ubuntu/forritun/nodejs/e24-stocks/nordnet_files/get_pricepoint.js", [holding.classid], { stdio: "" })
    //   .progress( function( stdout, stderr, command ) {
    //         if(stderr){
    //             throw stderr
    //         } else {
    //             console.log(stdout)
    //         }
    //      this function will get called with every piece of 
    //        data from the returne result 
    //    })
    //    .done( function( stdout, stderr, command ) {
    //         if(stderr){
    //             throw stderr
    //         } else {
    //             console.log(stdout)
    //         }
    //      /* all done! total value's available of course */
    //    });
// }

// testScript({ classid: "F00000YCUS" }).then(function(results){
//     console.log("results: ")
//     console.log(results)
// })

// testScript({ classid: "F00000YCUS" }, function(results){
//     console.log("results: ")
//     console.log(results)
// })

var finishInsertingPortfolio = function(){

    var exec = require("child_process").exec

    console.log("running..")

    var watcher = exec("DEBUG=nightmare xvfb-run -a node nordnet_files/get_portfolio_pricepoints.js")
    .on('error', function(error) {
        throw error
    })
    .on('data', function(data) {
        console.log("results: "+data)
        var results = process.stdout.write(data.toString());
    })
    .on('exit', function(data) {
        var results = process.stdout.write(data.toString());
        console.log(results)
        console.log("done")
    })

}

// var getNNAccountStatus = function(){
//     var exec = require("child_process").exec

//     console.log("running..")

//     var watcher = exec("DEBUG=nightmare xvfb-run -a node nordnet_files/get_mon_status_from_account.js")
//     .on('error', function(error) {
//         throw error
//     })
//     .on('data', function(data) {
//         console.log("results: "+data)
//         var results = process.stdout.write(data.toString());
//     })
//     .on('exit', function(data) {
//         var results = process.stdout.write(data.toString());
//         console.log(results)
//         console.log("done")
//     })
// }

var insertHolding = function(holding, portfolio){
    var d = deferred();

    var q = connection.query("INSERT INTO nn_portfolios (u_hash, portfolio_name, classid, identifier, market_id, long_name, holding_ratio, value) VALUES (?,?,?,?,?,?,?,?)", [portfolio.u_hash, portfolio.portfolio_name, holding.classid, holding.identifier, holding.market_id, holding.long_name, holding.holding_ratio, (holding.holding_ratio*portfolio.value)], function(err, rows, fields){
        console.log(q.sql)
        if(err) throw err;
        else {
            d.resolve()
        };
    });

    return d.promise;
}

var savePortfolio = function(portfolio){

    insertHolding(portfolio.holdings.shift(), portfolio).then(function next(){
        if(portfolio.holdings.length){
            insertHolding(portfolio.holdings.shift(), portfolio).then(next)
        } else {
            finishInsertingPortfolio()
            console.log("inserted portfolio!")
        }
    })
}

var savePricePoint = function(ticker, price, callback){

    var d = deferred();

    connection.query("INSERT INTO price_points (ticker, price) VALUES (?, ?)", [ticker, price], function (error, rows, fields) {
        if (error) throw error;
        else{

            console.log("pricepoint saved: " +ticker);
            d.resolve({ pricepoint_saved: true })
        }
    });
    return d.promise;
}

app.get('/check_quote/:ticker', function(req, res){
    
    fetchQuote(req.params.ticker).then(function(results){
        res.json(results)
    })
});

var getPricePointsForAllOBX = function(){

    connection.query("SELECT ticker FROM e24_stock_info_complete", function(err, rows, fields){
        if(err) throw err;
        else {
            var stockTickers = removeRowDataPacket(rows)

            for (var i = 0; i < stockTickers.length; i++) {
                
                fetchQuote(stockTickers[i].ticker).then(function(results){
                    var price = (results[0].LAST !== null ? results[0].LAST : results[0].CLOSENZ_CA),
                    ticker = results[0].ITEM_SECTOR

                    savePricePoint(ticker, price).then(function(results){
                        if(results.pricepoint_saved){
                            return;
                        }
                    })
                })
            }
        };
    });
}


var fetchQuote = function(ticker){
    var d = deferred()

    url = "https://www.dn.no/finans/servlets/newt/json/quotes?ticker="+ticker

    request(url, function(error, response, html){
        if(!error){
            var $ = cheerio.load(html)

            json = JSON.parse(html)
        }
        d.resolve(json)
    });
    return d.promise
}

// TODOLIST
// 1. automatic rebalancing quarterly / yearly? 
// 2. prosenta - syna drift fra upphaflegri allocation
// 3. Saekja 1,3,5 ara returns fyrir alla funds og reikna ut sidustu 5 ar
// 4. Nota annual return per ar fyrir thad til ad spa fyrir um framtidina
// 5. Vantar SMA stjornud kaup fyrir portfolios

// 5. price sold thegar selt er til ad fylgjast med avoxtun - hvernig reiknar madur avoxtun thegar dot er selt?
// 6. greining a dnb brefum - hvad skedur daginn sem thau fa anbefaling med verd 
    // greina prispunktana a 10 min fresti a kaupdegi


var pdf2Text = function(date, cb){
    var sys  = require('util'),
        exec = require('child_process').exec,
        child;

        console.log("pdfText: "+date)

    child = exec('sh pdftotext.sh '+date, function (error, stdout, stderr) 
    {
        if (error) // There was an error executing our script
        {
            cb({message: error, error: error})
            throw error
        }

        if(stdout.trim() === "txt file generated"){
            cb({message: stdout, error: null})
        }
    });
}

var getTicker = function(stock_arr, all_stocks_w_ticker){

    for (var i = stock_arr.length - 1; i >= 0; i--) {
        var stock = stock_arr[i]                                                        
        // see if it matches a company to find the ticker
        for (var a = 0; a < all_stocks_w_ticker.length; a++) {

            var split_arr = stock.split(" ");
            // console.log("--")
            // console.log(all_stocks_w_ticker[a].company_name+ " -- "+stock)

            if(all_stocks_w_ticker[a].company_name.match(stock)){
                console.log("found a match, pushing ticker: "+stock)
                stock_arr[i] = all_stocks_w_ticker[a].ticker;
            }

            // gamli, profum nyjan
             // if(all_stocks_w_ticker[a].company_name === stock){
             //    console.log("found a match, pushing ticker: "+stock)
             //    stock_arr[i] = all_stocks_w_ticker[a].ticker;
             // }
        }
    }

    return stock_arr;
}

/*
    keeps a hold of the DNB holdings, a table that has all the stocks which where in the
    folder last week for comparison for next week.
*/

var updateDNBPortfolio = function(type_of_transaction, comp_names_arr){

    if(type_of_transaction === "sell"){

        for (var i = 0; i < comp_names_arr.length; i++) {
            
            connection.query("UPDATE dnb_ukeportfolje_holdings_overview SET active = '0' WHERE company_name = ?", [comp_names_arr[i]], function(err, rows, fields){
                if(err) throw err;
                else {
                    console.log("dnb ukeportfolje table holdings updated, sold a holding")
                    return;
                };
            });
        }
    } 

    if(type_of_transaction === "buy"){

        for (var i = 0; i < comp_names_arr.length; i++) {
            
            connection.query("INSERT INTO dnb_ukeportfolje_holdings_overview (company_name) VALUES (?)", [comp_names_arr[i]], function(err, rows, fields){
                if(err) throw err;
                else {
                    console.log("dnb ukeportfolje table holdings updated, bought a holding")
                    return;
                };
            });
        }
    }
}

/*
    Inserts stocks for price watch the following days to record stock data after recommendation, both buy and sell
*/

var insertForPriceWatch = function(recommendation, tickerArr){

    for (var i = 0; i < tickerArr.length; i++) {

        fetchQuote(tickerArr[i]).then(function(results){

            connection.query("INSERT INTO price_watch_dnb_buys_and_sells (ticker, recommendation, price_at_rec) VALUES (?,?,?)", [results[0].ITEM_SECTOR, recommendation, results[0].BID], function(err, rows, fields){
                if(err) throw err;
                else {
                    console.log("inserted stock for price watch: "+results[0].ITEM_SECTOR)
                    return;            
                };
            });
        })
    }
}

var startPriceWatch = function(minutes_between_checks, duration_of_check_hours){
    var ms_between_checks = 1000*60*minutes_between_checks
    , duration = 1000*3600*duration_of_check_hours;


    var time = moment().subtract(duration_of_check_hours, "hours");

    var priceWatchTimer = setInterval(function(){

        connection.query("SELECT ticker FROM price_watch_dnb_buys_and_sells", function(err, rows, fields){
            if(err) throw err;
            else {
                var tickersArr = removeRowDataPacket(rows);

                if(tickersArr.length > 0){

                    for (var i = 0; i < tickersArr.length; i++) {

                        fetchQuote(tickersArr[i].ticker).then(function(results){

                            connection.query("INSERT INTO price_points_dnb_watch (ticker, company_name, price) VALUES (?,?,?)", [results[0].ITEM_SECTOR, results[0].LONG_NAME, results[0].ASK], function(err, rows, fields){
                                if(err) throw err;
                                else {
                                    console.log("registered price point for stock overwatch in DNB folder: "+results[0].LONG_NAME)

                                    // clear the timer if it has been running long enough
                                    if(time.isAfter(moment())){
                                        clearInterval(priceWatchTimer)
                                    }

                                    return;
                                };
                            });

                        });
                    }
                } else {
                    console.log("there are no stock recommendations")
                }
                
            };
        });

    }, ms_between_checks)
}

// 5 minutes between, duration for 5 hours - debugga adeins, for yfir 30 min med 0.5 i hours...
// startPriceWatch(10, 0.5);

var func = function(){

    var date = moment().format("YYMMDD")
    , time = moment().format("HH:mm")
    
    var url = "https://www.dnb.no/portalfront/nedlast/no/markets/analyser-rapporter/norske/anbefalte-aksjer/AA"+date+".pdf"

    var file_location = "./public/data/AA"+date+".pdf"

    fs.exists(file_location, function(exists){
        if(exists){
            // the file exists
            console.log("IT EXISTS! AND EVERYTING SHOULD BE SOLD AND BOUGHT")

            // nota iteration func til ad finna ny quote
        } else {

            // check if DNB has uploaded the file
            checkUrlExists(url, function(response){
                // if the pdf document has been uploaded
                if(response.document_exists === true){

                    // download file into download DIR
                    download_file_curl(url, "/home/ubuntu/forritun/nodejs/e24-stocks/public/data/").then(function(code){
                        // the download was a success, i.e. the file is there

                        if(code === 200){   
                            console.log("starting to change pdf to txt")
                            // change the pdf to text file

                            pdf2Text(date, function(response){
                                if(response.error){
                                    throw new Error(response.messge)
                                } else {
                                    console.log("changed pdf to txt")
                                    // change the pdf to txt and parse stock recommandtion - the newest holdings portfolio
                                    getStockRecsFromTXT("/home/ubuntu/forritun/nodejs/e24-stocks/public/data/AA"+date+".txt", function(response){
                                        var stock_recommendations_arr = response.stock_recommendations;

                                        connection.query("SELECT company_name FROM dnb_ukeportfolje_holdings_overview WHERE active = '1'; SELECT company_name, ticker FROM e24_stock_info_complete;", function(err, rows, fields){
                                            if(err) throw err;
                                            else {
                                                var previous_holdings_arr = []
                                                , stocks = removeRowDataPacket(rows[0])
                                                , all_stocks_w_ticker = removeRowDataPacket(rows[1])

                                                console.log("stock recommendation: ")
                                                console.log(stock_recommendations_arr)

                                                for (var i = 0; i < stocks.length; i++) { 
                                                    previous_holdings_arr.push(stocks[i].company_name)
                                                }

                                                // get an arr of stock rec with the previous holdings removed
                                                var buy_arr_names = _.difference(stock_recommendations_arr, previous_holdings_arr)

                                                var sell_arr_names = _.difference(previous_holdings_arr, stock_recommendations_arr)

                                                console.log("previous holdings:")
                                                console.log(previous_holdings_arr)

                                                if(buy_arr_names.length > 0 || sell_arr_names.length > 0){
                                                    // diff gives us sell and buy recs
                                                    console.log("there is a difference between last week and now")

                                                    // get the tickers for the companies 
                                                    var buy_arr_ticker = getTicker(buy_arr_names, all_stocks_w_ticker)
                                                    , sell_arr_ticker = getTicker(sell_arr_names, all_stocks_w_ticker)

                                                    console.log(buy_arr_ticker)
                                                    console.log(sell_arr_ticker)

                                                    /*
                                                        Finna betri match algoritma fyrir fyrirtaekin til ad finna rettan ticker
                                                        svo forritid geti keypt rett fyrirtaeki
                                                    */

                                                    if(buy_arr_ticker.length > 0){
                                                        buyStocksArr(buy_arr_ticker, "dnb_ukeportfolje", 100000)
                                                        updateDNBPortfolio("buy", buy_arr_names)
                                                        insertForPriceWatch("buy", buy_arr_ticker)
                                                        startPriceWatch(30, 5);
                                                        console.log("buy the right stocks")
                                                    }

                                                    if(sell_arr_ticker.length > 0){
                                                        sellStockArr(sell_arr_ticker, "dnb_ukeportfolje")
                                                        insertForPriceWatch("sell", sell_arr_ticker)
                                                        updateDNBPortfolio("sell", sell_arr_names)
                                                        startPriceWatch(30, 5);
                                                        console.log("sell the right stocks")
                                                    }

                                                } else {
                                                    console.log("there are no new stock recommendations")
                                                }
                                            };
                                        });

                                    });
                                }

                            })
                        };
                    });
                } else {
                    console.log("the document has not been uploaded yet")
                }
            })
        }
    })
}

var getStockRecsFromTXT = function(text_file_loc, callback){

    var array = fs.readFileSync(text_file_loc).toString().split('\n');

    var check_lines_before = [];

    var stock_recommendations = [];

    for (var i = 0; i < array.length; i++) {

        // match the line in the pdf document that is before the company name
        if(array[i].match("(2017e|2018e)") !== null){
            // console.log("--")
            // console.log(array[i-3])
            var company = (array[i-1].trim()) // clean up the data
            
            // flest fyrirtaeki eru beint fyrir ofan 2017e|2018e linurnar en sum ekki
            if(company.length > 0 && company.indexOf("%") === -1){
                stock_recommendations.push(company)
            } else {
                // herna tharf ad vera extraction loopa sem finnur thessi fyrirtaeki sem ekki eru beint fyrir ofan
                for (var a = 0; a < 15; a++) {
                    if(((array[i-a].trim())).length > 3 && !array[i-a].match("2016|2017|DNB Markets") && array[i-a].indexOf("(") === -1){
                        stock_recommendations.push(array[i-a].trim())
                    }
                }
            }
        }
    }

    callback({ stock_recommendations: stock_recommendations})
    // callback({ stock_recommendations: array})
}

// app.get('/testing', function(req, res){

//     getStockRecsFromTXT("/home/ubuntu/forritun/nodejs/e24-stocks/public/data/AA171023.txt", function(response){
//         res.json(response)
//     });
// });

// each monday, fetch DNB portfolio at 12:45 - run for 30 minutes
var fetchDNBandBuy = crontab.scheduleJob("45 10 * * 1", function(){

    var run_again = true
    , i = 0;


    var timed_function = setInterval(function(){

        i++;

        func()


        // 30 min * 6 (i++ every 10 seconds)
        if(i === 180){
            run_again = false;
        }

        if(!run_again){
            clearInterval(timed_function)
        }

        var d = moment().format("HH:mm")
        console.log(d+": running func!")
    }, 10000)

})

var buyStocksArr = function(arr, portfolio_name, value){
    
    for (var i = arr.length - 1; i >= 0; i--) {
        
        fetchQuote(arr[i]).then(function(results){

            buyStock(results[0].ITEM_SECTOR, portfolio_name, value).then(function(results){
                if(results.stock_bought){
                    return;
                }
            })
        })
    }
}


/*
    17:00 each day except weekends, fetch all datapoints on OSE
*/ 
var OSEJob = crontab.scheduleJob("0 15 * * 1,2,3,4,5", function(){
    getPricePointsForAllOBX()
});

/*
    Strips away RowDataPacket when fetching data to SQL
*/

var removeRowDataPacket = function(rows){
    var str = JSON.stringify(rows)
    return JSON.parse(str)
}


/*
    Calculates returns for the portfolios
*/

var calculateReturn = function(portfolios, pricePoints){

    var total_return_obj = {};

    for (var i = 0; i < portfolios.length; i++) {
        var holdings = portfolios[i].holdings

        // console.log(holdings)

        var percentageChange
        , total_return_obj = {}
        , total_gain_loss = 0
        , total_value_before_return = 0
        , total_value_after_return = 0
        , total_return = 0;


        // iterate over all holdings in the portfolio
        for (var c = 0; c < holdings.length; c++) {

            for(var a=0; a < pricePoints.length; a++){

                if(typeof(pricePoints[a].ticker) === "undefined"){

                    if(pricePoints[a].classid === holdings[c].classid){


                        var percentageChange = ((pricePoints[a].price / holdings[c].price - 1)*100).toFixed(2)
                        total_return += percentageChange;
                    }
                } else {

                    if(pricePoints[a].ticker === holdings[c].ticker){

                        var percentageChange = ((pricePoints[a].price / holdings[c].price - 1)*100).toFixed(2)
                        total_return += percentageChange;
                    }
                }

                holdings[c].new_value = (holdings[c].value*(1+(percentageChange/100)))
                // add up the total portfolio value with percentage change - needed to calculate the total percentage retu
                holdings[c].gain_loss = parseInt((holdings[c].value*(percentageChange/100)).toFixed(2))
                // holdings[c].total_change_percentage = (holdings[c].new_value / holdings[c].value).toFixed(2)
                holdings[c].percentageChange = percentageChange;
            }

            // total portfolio value with returns
            total_value_after_return += holdings[c].new_value
            total_value_before_return += holdings[c].value
            total_gain_loss += holdings[c].gain_loss
        }

        portfolios[i].total_gain_loss = total_gain_loss
        portfolios[i].total_value_before_return = total_value_before_return
        portfolios[i].total_return_monet = total_value_after_return
        portfolios[i].total_return_perc = ((total_value_after_return / total_value_before_return - 1)*100).toFixed(2)
    }

    return portfolios
}

/*
    Push portfolio holdings into right portfolio - used to structurize portfolios the right way    
*/

var pushPortHoldings = function(row, temp_portfolio_holder){
    
    var obj = {
        bought_at_date: row.bought_at_date,
        holding_ratio: row.holding_ratio,
        holding_id: row.holding_id,
        long_name: row.long_name,
        classid: row.classid,
        ticker: row.ticker,
        price: row.price,
        no_of_units: row.no_of_units,
        value: row.value
    }

    temp_portfolio_holder.holdings.push(obj);
};

/*
    Structurize portfolios when getting many at a time [{ portfolio_name, holdings: [], ... etc }, {}]
*/

var structurizePortfolios = function(rows){

    var portfolios = [];

    var temp_portfolio_holder = {
        holdings:[],
        portfolio_name:""
    }

    var portfolios_added = [];

    // iterate over all portfolio holdings in the table
    for(var i =0; i<rows.length; i++){

        // get the name of the portfolio
        var portfolio_name = rows[i].portfolio_name;

        // if holdings is empty, push the first holding into the portfolio and give it the right name
        if(temp_portfolio_holder.holdings.length === 0){

            // push the holdings into the right portfolio
            pushPortHoldings(rows[i], temp_portfolio_holder)

            // keep track of which portfolios have been added so the program doesnt make new ones
            portfolios_added.push(rows[i].portfolio_name)

            temp_portfolio_holder.portfolio_name = rows[i].portfolio_name
        
            portfolios.push(temp_portfolio_holder)

        } else {

            // itereate over the portfolios in the portfolios to find the right portfolio or make a new one if it doesnt exist
            for(var a = 0; a < portfolios.length; a++){

                // if the portfolio exists in the portfolios
                if(portfolios[a].portfolio_name === rows[i].portfolio_name){
                    
                    // stops double addings of holdings
                    if(rows[i].added !== true){ 
                        rows[i].added = true
                        pushPortHoldings(rows[i], temp_portfolio_holder)
                        // console.log("ADDED NEW ROW!! : "+rows[i].ticker)
                    }

                // if the portfolio doesnt exist
                } else if (portfolios_added.indexOf(rows[i].portfolio_name) === -1) {

                    // make a new one
                    temp_portfolio_holder = {
                        holdings: [],
                        portfolio_name: rows[i].portfolio_name
                    }

                    // and push the holding
                    pushPortHoldings(rows[i], temp_portfolio_holder)
                    rows[i].added = true
                    portfolios_added.push(rows[i].portfolio_name)

                    portfolios.push(temp_portfolio_holder)
                }
            }
        }
    }
    return portfolios
}

// 1. Establish a minimum market capitalization (usually greater than $50 million).
// 2. Exclude utility and financial stocks.
// 3. Exclude foreign companies (American Depositary Receipts).
// 4. Determine company's earnings yield = EBIT / enterprise value.
// 5. Determine company's return on capital = EBIT / (net fixed assets + working capital).
// 6. Rank all companies above chosen market capitalization by highest earnings yield and highest return on capital (ranked as percentages).
// 7. Invest in 20–30 highest ranked companies, accumulating 2–3 positions per month over a 12-month period.
// 8. Re-balance portfolio once per year, selling losers one week before the year-mark and winners one week after the year mark.
// 9. Continue over a long-term (5–10+ year) period.


// MAGIC FORMULA - MANUALLY - bought 8 stocks on the 22 sept 17

// connection.query("SELECT ticker FROM e24_stock_info ORDER BY price_to_earnings_17 ASC, return_on_capital_17 DESC, return_on_capital_18 DESC LIMIT 8", function(err, rows, fields){
//     if(err) throw err;
//     else {
//         var stocks = removeRowDataPacket(rows)

//         fetchQuote(stocks[7].ticker).then(function(results){
//             console.log(results)
//             var no_of_units = (100000 / results[0].BID).toFixed(0)
//             buyStock(stocks[7].ticker, "magic formula investing", results[0].BID, no_of_units)
//         });


//         // console.log(stocks)

//         // res.json(stocks)
//     };
// });

/*
    buy a single stock
*/
var buyStock = function(ticker, portfolio_name, value, cb){

    var d = deferred()


    fetchQuote(ticker).then(function(results){

        var no_of_units = value / results[0].BID;

        var q = connection.query("INSERT INTO portfolios (u_hash, portfolio_name, ticker, price, no_of_units, sold, date_sold, value) VALUES ('68fe782e5651504aa6c017a8b40d7af5',?,?,?,?,?,null,?)", [portfolio_name, ticker, results[0].BID, no_of_units, '0', value], function(err, rows, fields){
            console.log(q.sql)
            if(err) throw err;
            else {
                console.log("stock bought")
                d.resolve({ stock_bought: true })
            };
        });
    })


    return d.promise;
}



var sellStockArr = function(ticker_arr, portfolio_name){

    for (var i = 0; i < ticker_arr.length; i++) {
        sellStock(ticker_arr[i], portfolio_name, function(response){
            if(response.stock_sold){
                return;
            }    
        })
    }
}

var sellStock = function(ticker, portfolio_name, callback){

    connection.query("UPDATE portfolios SET sold = '1' WHERE ticker = ? AND portfolio_name = ? AND sold = '0'", [ticker, portfolio_name], function(err, rows, fields){
        if(err) throw err;
        else {
            callback({ stock_sold: true, error: null })
        };
    });
}



app.get('/dnb', function(req, res){
    
    // var filename = '/home/ubuntu/forritun/nodejs/e24-stocks/public/data/DNB_ukeportf.pdf'
    var filename = '/home/ubuntu/forritun/nodejs/e24-stocks/public/data/AA170619.pdf'
    var txt = '/home/ubuntu/forritun/nodejs/e24-stocks/public/data/sample.txt'


    var array = fs.readFileSync(txt).toString().split('\n');

    var check_lines_before = [];

    var stock_recommendations = [];

    for (var i = 0; i < array.length; i++) {

        // match the line in the pdf document that is before the company name
        if(array[i].match("(2013|2014|2018e)") !== null){
            var company = (array[i-1].trim()) // clean up the data
            if(company.length > 0 && company.indexOf("%") === -1){
                stock_recommendations.push(company)
            }
        }
    }

    // buyDNBUkePortfolje(stock_recommendations)

    res.json(stock_recommendations)
}); 

app.post('/sell_holding', function(req, res){
    
    var holding_id = req.body.holding_id;

    var q = connection.query("UPDATE portfolios SET sold = '1', date_sold = CURRENT_TIMESTAMP WHERE id = ?", [holding_id], function(err, rows, fields){
        console.log(q.sql)
        if(err) throw err;
        else {
            res.json({ holding_sold: true})
        };
    });
});

var checkNewStocksDNBPortf = function(){

    connection.query("SELECT e24.company_name, ticker FROM dnb_ukeportfolje_holdings_overview dnb LEFT JOIN e24_stock_info_complete e24 ON dnb.company_name = e24.company_name", function(err, rows, fields){
        if(err) throw err;
        else {  
            // console.log(rows)
        };
    });

}()

/*
    update function if more info is needed regarding any kind of stock
*/

// connection.query("SELECT ticker FROM e24_stock_info_complete", function(err, rows, fields){
//     if(err) throw err;
//     else {
    
//         var tickers = removeRowDataPacket(rows)

//         func(tickers.shift()).then(function next(){
//             if(tickers.length){
//                 func(tickers.shift()).then(next)
//             } else {
//                 console.log("ALL DONE!")
//                 d.resolve(true)
//             }
//         })

//         function func(ticker){
//             var d = deferred()
//             fetchQuote(ticker.ticker).then(function(results){

//                 var q = connection.query("UPDATE e24_stock_info_complete SET type = ?, long_name = ? WHERE ticker = ?", [results[0].TYPE, results[0].LONG_NAME, ticker.ticker], function(err, rows, fields){
//                     console.log(q.sql)
//                     if(err) throw err;
//                     else {
//                         console.log("updated table for: "+results[0].LONG_NAME)
//                         d.resolve()
//                     };
//                 });

//             })
//             return d.promise
//         }        

//     };
// });

// setja upp cronjob sem skytur a 5 sekunda fresti fra 9:30 - 11:00 a manudegi
// downloada skjalinu
// breyta skjali ur pdf i texta
// parsa skjalid og saekja stock recs
// kaupa hlutabrefin sem eru ny i rec
// selja hin!

var buyDNBUkePortfolje = function(stock_recommendations){

    var query = "INSERT INTO dnb_ukeportfolje_holdings_overview (company_name, first_word_company) VALUES "

    for (var i = 0; i < stock_recommendations.length; i++) {
        if(i === stock_recommendations.length - 1){
            query += "('"+stock_recommendations[i]+"', '"+stock_recommendations[i].split(/ /g)[0]+"')"
        } else {
            query += "('"+stock_recommendations[i]+"', '"+stock_recommendations[i].split(/ /g)[0]+"'), "
        }
    }

    connection.query(query, function(err, rows, fields){
        if(err) throw err;
        else {
            console.log("companies in DNB portfolio saved")
        };
    });

}


app.get('/e24', function(req, res){
        
    connection.query("SELECT * FROM e24_stock_info ORDER BY price_to_earnings_17 ASC, return_on_capital_17 DESC, return_on_capital_18 DESC", function(err, rows, fields){
        if(err) throw err;
        else {
            var stocks = removeRowDataPacket(rows)

            res.render("e24_overview_data", { stocks: stocks })

            // res.json(stocks)
        };
    });
});

/*
    Betterment questions:

    1. Are you retired - yes / no
    2. Whats your primary reason for investing? 1. saving for retirement, 2. general investing, 3. saving for emergency fund, saving for a major purchase(do you have debt comment med 1 og 2 - borga skuldir fyrst)
    3. Are you currently investing - yes / no - how(myself, I have an advisor, I have an employer plan)
    4. What are your investable assets? - a number
    5. Would you like unlimited access to our team of CFP professionals? Yes / No
    6. Analyzing....
    7. Review of choices, list over pluses that you get with Betterment
    8. See price plans:
        a. digital(recommended): Investing with automation, 0.25% annual fee, no minimum balance
        b. premium: investing with automation, unlimited access to CFP professionals, 0.40% annual fee, $100.000 minimum balance
*/

app.get('/', function(req, res){
    
    res.render("outer/index")
});

app.get('/login', function(req, res){
    
    res.render("outer/login")
});

app.post('/login', function(req, res){
    
    connection.query("SELECT * FROM users WHERE email = ?", [req.body.email], function(err, rows, fields){
        if(err) throw err;
        else {

            console.log(req.session)

            //TODO needs a salt and hash - this does it for now, setting sessions
            if(rows.length > 0){
                req.session.email = req.body.email
                req.session.u_hash = rows[0].u_hash
                res.send({ login: true })
            } else {
                // render login with an error
                res.send({ login: false })
            }
        };
    });

});

app.get('/app', function(req, res){
    
    res.render("fullscreen_loading");

});

app.post('/get_nordnet_account_status', function(req, res){
    
    nordnet.getAccountStatus().then(function(results){
        req.session.account_monetary_status = parseInt(results)
        res.send({ err: null, done: true })
    })

});

var renderTemplate = function(res, template, context, session, cb){

    context.session = session;

    if(cb){
        res.render(template, context, function(err, html){
            cb(err, html)
        })
    } else {
        res.render(template, context)
    }
}

app.get('/app/nn_portfolios', function(req, res){
    
    connection.query("SELECT *, DATE_FORMAT(date, '%d/%m/%y') AS bought_at_date FROM nn_portfolios; SELECT p1.classid, p1.price, p1.date FROM nn_price_points p1 LEFT JOIN nn_price_points p2 ON (p1.classid = p2.classid AND p2.date > p1.date) WHERE p2.date IS NULL;", function(err, rows, fields){
        if(err) throw err;
        else {
            var portfolios = structurizePortfolios(removeRowDataPacket(rows[0]))
            , pricePoints = removeRowDataPacket(rows[1])

            portfolios = calculateReturn(portfolios, pricePoints)

            renderTemplate(res, "index", { portfolios:portolios }, req.session)
        };
    });
});

app.get('/app/overview', checkIfLoggedIn, function(req, res){

        renderTemplate(res, "app/subviews/overview", {}, req.session)
});

app.get('/app/portfolios', checkIfLoggedIn, function(req, res){

    // a overview tharf fyrir hvert portfolio:
        // 1. kapital
        // 2. nuverandi verdi
        // 3. avkastning
        // 4. Risiko - nota timaramma til ad gefa rad?
            // Høy
            // moderat
            // lav 
        // hash / nafn til ad finna svo portolfioid til ad kafa dypra i thad

        /*
            1. Eg tharf buy og hold strategiu - sett 50 thus inn a og fengid forrit sem allocatar i rett til ad balansera, 
            sett svo onnur 50 thus og gert thad sama
            2. Kaupa i odyrum funds til ad halda kostnadi sem laegstum
            3. adrir - setja upp timaramma, ef lengi fara meira i stocks, ef stutt fara meira i konservative med bonds
            4. Setja upp portfolio sidu - kikja  a Betterment siduna sem er mjog flott
        */


    connection.query("SELECT portfolio_name, SUM(value) AS capital_invested FROM nn_portfolios WHERE u_hash = ? GROUP BY portfolio_name;SELECT *, DATE_FORMAT(date, '%d-%m-%y') AS bought_at_date FROM nn_portfolios WHERE u_hash = ?;", [req.session.u_hash, req.session.u_hash], function(err, rows, fields){

        var capital_invested = removeRowDataPacket(rows[0])
        , portfolios = structurizePortfolios(rows[1])
        
        capital_invested.forEach(function(obj){

            portfolios.forEach(function(portfolio){
                if(portfolio.portfolio_name === obj.portfolio_name){
                    portfolio.capital_invested = obj.capital_invested;
                }
            })
        })

        calculateDailyReturnForPortfolios(portfolios).then(function(portfolios){

            portfolios.forEach(function(portfolio){
                calcDailyReturnPortfolio(portfolio)
                getDatesFromPort(portfolio)
                extractMonetaryReturnsArr(portfolio)
                caltulateLatestReturnPerc(portfolio)
                caltulateLatestReturnMon(portfolio)
                calculateCapitalPercentageTarget(portfolio)
                calculateCapitalPercentageReal(portfolio)
            })

            renderTemplate(res, "app/subviews/portfolios", { portfolios:portfolios }, req.session)
        })
    });
});

var calculateTotalYearlyFees = function(holdings){
    var sum = 0;
    for (var i = 0; i < holdings.length; i++) {
        sum += (holdings[i].total_yearly_fee*holdings[i].holding_ratio)
    }

    return sum/holdings.length
}

app.get('/app/portfolios/:portfolio_name', checkIfLoggedIn, function(req, res){
        
    connection.query("SELECT nn.classid, nn.identifier, holding_ratio, value, so.long_name, type, total_yearly_fee FROM nn_portfolios nn LEFT JOIN securities_overview so ON nn.identifier = so.identifier OR nn.classid = so.classid WHERE nn.portfolio_name = ?", [req.params.portfolio_name], function(err, rows, fields){
        if(err) throw err;
        else {
            var holdings = removeRowDataPacket(rows)

            portfolio = {
                holdings: holdings
            }

            portfolio.total_yearly_fee = calculateTotalYearlyFees(holdings)

            console.log(portfolio.total_yearly_fee)

            renderTemplate(res, "app/subviews/portfolio_details", {
                portfolio: portfolio
            }, req.session)
        };
    });

});

app.get('/app/my_overview', function(req, res){

    connection.query("SELECT p.id as holding_id, DATE_FORMAT(p.date, '%d/%m/%y') AS bought_at_date, p.portfolio_name, ticker, price, no_of_units,value FROM portfolio_names p_n LEFT JOIN portfolios p ON p_n.name = p.portfolio_name WHERE p.sold = '0';SELECT p1.ticker, p1.price, p1.date FROM price_points p1 LEFT JOIN price_points p2 ON (p1.ticker = p2.ticker AND p2.date > p1.date) WHERE p2.date IS NULL", function(error, rows, fields){
        if(error){
            throw error
        } else {

            var portfolios = structurizePortfolios(removeRowDataPacket(rows[0]))
            // why dont I need to remove RowDataPacket?
            , pricePoints = rows[1]

            portfolios = calculateReturn(portfolios, pricePoints)

            res.render("index", { portfolios: portfolios })
        };
    });
});

var getDataForPortfolio = function(portfolio){
    var d = deferred()
    , data_arr = [];

    for (var i = 0; i < portfolio.length; i++) {


        (function(i){

            var ticker = portfolio[i].ticker

            fetchQuote(ticker).then(function(results){
                
                if(results.length > 0){
                    console.log("pushing: "+ticker)
                    data_arr[i] = results
                    return;
                }
            })

            console.log(data_arr)

        }(i))
    }

    // adda long name i push holding

    setTimeout(function(){
        console.log("done")
        d.resolve(data_arr)
    }, 2000)


    return d.promise;
}

var calculateLastYearsReturn = function(portfolio, years, cb){
    var d = deferred()

    var holdings = portfolio.holdings;

    portfolio.one_year_return = 0;
    portfolio.five_year_return = 0;
    var p_return = 0;

    func(holdings.shift()).then(function next(){
        if(holdings.length){
            func(holdings.shift()).then(next)
        } else {
            d.resolve(p_return)
        }
    })

    function func(holding){
        var d2 = deferred()

        fetchQuote(holding.ticker).then(function(results){
            p_return += (holding.holding_ratio*results[0].CHANGE_1YEAR_PCT)
            d2.resolve()
        })
        return d2.promise;
    }

    return d.promise;
}

var deep_cp = function(obj){
    return JSON.parse(JSON.stringify(obj))
}

var checkIfObjIsAdded = function(string_to_check, arr, key){
    return arr.some(function(obj){
        return obj[key] === string_to_check
    })
}

var calculatePricePointsDaily = function(obj){

    var dayObj = {};

    for(var key in obj){

        for (var i = 0; i < obj[key].length; i++) {

            if(typeof(dayObj[obj[key][i].date]) === "undefined"){
                dayObj[obj[key][i].date] = 0;
            }
            dayObj[obj[key][i].date] += parseInt(obj[key][i].price*obj[key][i].no_of_units);
        }
    }
    return dayObj;
}

var prepForHighCharts = function(obj){

    var newObj = {
        dates: [],
        values: []
    }

    for(var key in obj){
        newObj["dates"].push(key)
        newObj["values"].push(obj[key])
    }
    return newObj;
}

var calculatePercentages = function(dailyValuesArr){

    var baseVal = dailyValuesArr[0]
    , percArr = [];

    for (var i = 0; i < dailyValuesArr.length; i++) {
        percArr.push(((dailyValuesArr[i]/baseVal - 1)*100))
    }
    return percArr;
}


app.get('/app/nn_portfolio_overview/:portfolio_name', function(req, res){
    
    connection.query("SELECT * FROM nn_portfolios WHERE portfolio_name = ?;", [req.params.portfolio_name], function(err, rows, fields){
        if(err) throw err;
        else {
            var portfolio = structurizePortfolios(removeRowDataPacket(rows))

            res.render('app/investing_overview', {
                portfolio: portfolio
            })

            // res.json(portfolio)
        };
    });
});

app.get('/portfolio_overview/:portfolio_name', function(req, res){

    // avoxtun :
        // change 1 year (CHANGE_1YEAR_PCT)
    // graf sem synir allt portfolioid
        // na i alla pricepoints og calculatea fyrir daginn - CHECK
    
    // beta ?
    // standard dev - staersta dropdown
    // portfolio drift
    // rebalance port

    connection.query("SELECT *, p.id as holding_id, DATE_FORMAT(p.date, '%d/%m/%y') AS bought_at_date FROM portfolios p WHERE portfolio_name = ?", [req.params.portfolio_name], function(err, rows, fields){
        if(err) throw err;
        else {
            var portfolios = structurizePortfolios(removeRowDataPacket(rows))
            // need to deep copy obj to use for calculation since it pops the holdings array
            , portfolio = portfolios[0]
            , portfolio_calc = deep_cp(portfolio);

            calculateLastYearsReturn(portfolio_calc, 1).then(function(p_return){
                
                portfolio.one_year_return = p_return;
                // console.log(portfolio)

                res.render("portfolio_overview", {
                    portfolio: portfolio,
                    portfolio_json: JSON.stringify(portfolio)
                })
            })
        };
    });    
});

var formatDateForMoment = function(date){
    var arr = date.split(/-/g)
    return "20"+arr[2]+"-"+arr[1]+"-"+arr[0]
}

var calculatedailyPercentageChange = function(pricePoints, holdings){

    var percentageArr = [];

    for (var i = 0; i < holdings.length; i++) {

        for (var a = 0; a < pricePoints.length; a++) {
            var date = pricePoints[a].date
            , price = pricePoints[a].price;

            var dateIsAfter = moment(formatDateForMoment(date)).isSameOrAfter(formatDateForMoment(holdings[i].bought_at_date))

            // need to check when the holding was bought, else it calculates returns before that date and that makes the result of the
            // whole portfolio wrong - the bought_at_date needs to be after the price point or the same..
            if(dateIsAfter){
                
                // classid is null from sql so no need to check for typeof === "undefined"
                if(pricePoints[a].classid && pricePoints[a].classid === holdings[i].classid){

                    var percentageChange = (((pricePoints[a].price / holdings[i].price) - 1)*100).toFixed(2);
                    var valueChange = parseFloat(((percentageChange/100)*holdings[i].value).toFixed(2))
                    percentageArr.push({ percentageChange: percentageChange, date: pricePoints[a].date, classid: holdings[i].classid, identifier: undefined, valueChange: valueChange })
                } else if(pricePoints[a].identifier && pricePoints[a].identifier === holdings[i].identifier) {
                    var percentageChange = (((pricePoints[a].price / holdings[i].price) - 1)*100).toFixed(2);
                    var valueChange = parseFloat(((percentageChange/100)*holdings[i].value).toFixed(2))
                    percentageArr.push({ percentageChange: percentageChange, date: pricePoints[a].date, classid: undefined, identifier: holdings[i].identifier, valueChange: valueChange })
                }
            }

        }

    }
    return percentageArr
}

var calculateDailyReturn = function(portfolio){
    var d = deferred()

    var holdings = portfolio.holdings;

    var query = "SELECT classid, identifier, price, DATE_FORMAT(date, '%d-%m-%y') AS date FROM nn_price_points WHERE "

    for (var i = 0; i < holdings.length; i++) {
        
        if(i === holdings.length - 1){
            query += (typeof(holdings[i].classid) !== "undefined") ? "classid = '"+holdings[i].classid+"'" : "identifier = '"+holdings[i].identifier+"' SORT BY DATE DESC" 
        } else {
            query += (typeof(holdings[i].classid) !== "undefined") ? "classid = '"+holdings[i].classid+"' OR " : "identifier = '"+holdings[i].identifier+"' OR " 
        }
    }

    connection.query(query, function(err, rows, fields){
        if(err) throw err;
        else {

            var pricePoints = removeRowDataPacket(rows)
            
            // [{ date: date, percentage: percentage, identifier: identifier / undefined, classid: classid / undefined }]
            portfolio.percentageChange = calculatedailyPercentageChange(pricePoints, holdings)
            
            d.resolve(portfolio)
        };
    });

    return d.promise;
}

var calculateDailyReturnForPortfolios = function(portfolios){
    var d = deferred()
    
    var dp_cp_portfolios = deep_cp(portfolios)

    var newPortfolioArr = [];


    calculateDailyReturn(dp_cp_portfolios.shift()).then(function next(results){
        
        newPortfolioArr.push(results)
        
        if(dp_cp_portfolios.length){
            calculateDailyReturn(dp_cp_portfolios.shift()).then(next)
        } else {
            console.log("calculated daily return for all portfolios")
            d.resolve(newPortfolioArr)
        }
    })
    return d.promise;
}


var calculateMonetaryReturnForWholePortfolio = function(portfolios){

    var final_obj = {}

    for (var i = 0; i < portfolios.length; i++) {

        portfolios[i].percentageChange.map(function(obj){
            if(typeof(final_obj[obj.date]) === "undefined"){
                final_obj[obj.date] = obj.valueChange
            } else {
                final_obj[obj.date] += obj.valueChange
            }
        })
    }

    return final_obj;

}

var calculatePercReturnForWholePortfolio = function(total_amount_invested, total_daily_return_mon){
    var returnsArr = _.values(total_daily_return_mon)

    var arr = returnsArr.map(function(value){
        // console.log(vale + " -- "+total_daily_return_mon)
        return parseFloat(((value/total_amount_invested)*100).toFixed(2))
    })

    return arr;
}

app.post('/fetch_data_for_graph', function(req, res){

    connection.query("SELECT *, DATE_FORMAT(date, '%d-%m-%y') AS bought_at_date FROM nn_portfolios WHERE u_hash = ?; SELECT SUM(value) AS total_amount_invested FROM nn_portfolios WHERE u_hash = ?", [req.session.u_hash, req.session.u_hash], function(err, rows, fields){
        if(err) throw err;
        else {
            var portfolios = structurizePortfolios(removeRowDataPacket(rows[0]))
            , total_amount_invested = removeRowDataPacket(rows[1])[0].total_amount_invested

            calculateDailyReturnForPortfolios(portfolios).then(function(results){

                var portfolios = results;

                var response = {
                    portfolios: portfolios
                }

                total_daily_return_mon = calculateMonetaryReturnForWholePortfolio(portfolios)
                response.total_daily_return_mon = total_daily_return_mon;

                response.total_daily_return_perc = calculatePercReturnForWholePortfolio(total_amount_invested, total_daily_return_mon)

                // set some variables for rendering of the view
                response.dates = _.keys(total_daily_return_mon)
                response.daily_return_arr = _.values(total_daily_return_mon)
                response.total_amount_invested = total_amount_invested;


                res.send(response)
            });
        };
    });
});

var calcDailyReturnPortfolio = function(portfolio){

    var dateChangeObj = {}

    portfolio.percentageChange.forEach(function(obj){
        if(typeof(dateChangeObj[obj.date]) === "undefined"){
            dateChangeObj[obj.date] = 0;
            dateChangeObj[obj.date] += obj.valueChange;
        } else {
            dateChangeObj[obj.date] += obj.valueChange
        }
    })

    portfolio.dateChangeObj = dateChangeObj;
}

var getDatesFromPort = function(portfolio){
    portfolio.dates = _.keys(portfolio.dateChangeObj)
}

var extractMonetaryReturnsArr = function(portfolio){
    portfolio.dailyMonetaryReturns = _.values(portfolio.dateChangeObj)
}

var caltulateLatestReturnPerc = function(portfolio){
    portfolio.return_perc = ((portfolio.dailyMonetaryReturns[portfolio.dailyMonetaryReturns.length - 1] / portfolio.capital_invested)*100).toFixed(2)
}

var caltulateLatestReturnMon = function(portfolio){
    portfolio.return_mon = portfolio.capital_invested + portfolio.dailyMonetaryReturns[portfolio.dailyMonetaryReturns.length - 1]
}

var calculateCapitalPercentageTarget = function(portfolio){

    var ratio = 0;

    for (var i = 0; i < portfolio.holdings.length; i++) {
        if(portfolio.holdings[i].long_name.indexOf("Aksje") > -1){
            ratio += portfolio.holdings[i].holding_ratio;
        }
    }
    portfolio.stock_holding_ratio = ratio;
}

var calculateCapitalPercentageReal = function(portfolio){
    console.log(portfolio)
    /*
    vantar inn lokaweight hverjar holdings fyrir sig...
     */
}

app.post('/fetch_portfolios_overview', function(req, res){
    

    connection.query("SELECT portfolio_name, SUM(value) AS capital_invested FROM nn_portfolios WHERE u_hash = ? GROUP BY portfolio_name;SELECT *, DATE_FORMAT(date, '%d-%m-%y') AS bought_at_date FROM nn_portfolios WHERE u_hash = ?;", [req.session.u_hash, req.session.u_hash], function(err, rows, fields){

        var capital_invested = removeRowDataPacket(rows[0])
        , portfolios = structurizePortfolios(rows[1])
        
        capital_invested.forEach(function(obj){

            portfolios.forEach(function(portfolio){
                if(portfolio.portfolio_name === obj.portfolio_name){
                    portfolio.capital_invested = obj.capital_invested;
                }
            })
        })

        calculateDailyReturnForPortfolios(portfolios).then(function(portfolios){

            portfolios.forEach(function(portfolio){
                calcDailyReturnPortfolio(portfolio)
                getDatesFromPort(portfolio)
                extractMonetaryReturnsArr(portfolio)
                caltulateLatestReturn(portfolio)
            })

            res.send(portfolios)
        })
    });
    // a overview tharf fyrir hvert portfolio:
        // 1. kapital x
        // 2. nuverandi verdi
        // 3. avkastning
        // 4. Risiko - nota timaramma til ad gefa rad?
            // Høy
            // moderat
            // lav 
        // hash / nafn til ad finna svo portolfioid til ad kafa dypra i thad

});

app.post('/fetch_pricepoints', function(req, res){
    
    var portfolio = JSON.parse(req.body.portfolio);

    var tickerString = "";

    for (var i = 0; i < portfolio.holdings.length; i++) {
        if(i === 0){
            tickerString += "pp.ticker = '"+portfolio.holdings[i].ticker+"'"
        } else {
            tickerString += " OR pp.ticker = '"+portfolio.holdings[i].ticker+"'"
        }
    }

    connection.query("SELECT pp.ticker, pp.price, p.no_of_units, DATE_FORMAT(pp.date, '%d-%m-%y') as date from price_points pp LEFT JOIN portfolios p ON pp.ticker = p.ticker WHERE pp.price IS NOT NULL AND ("+tickerString+") ORDER BY pp.ticker, pp.date", [portfolio.portfolio_name], function(err, rows, fields){
        if(err) throw err;
        else {
            var pricePoints = removeRowDataPacket(rows)

            var obj = {};

            for (var i = 0; i < pricePoints.length; i++) {
                
                if(typeof(obj[pricePoints[i].ticker]) === "undefined"){
                    obj[pricePoints[i].ticker] = [];
                    obj[pricePoints[i].ticker].push({ date: pricePoints[i].date, price: pricePoints[i].price, no_of_units: pricePoints[i].no_of_units })
                } else {
                    // checks if the object has been added
                    var exists = checkIfObjIsAdded(pricePoints[i].date, obj[pricePoints[i].ticker], "date")
                    // if not, it adds it into the array - removes duplicates, why they exist I dont know.
                    if(!exists){
                        obj[pricePoints[i].ticker].push({ date: pricePoints[i].date, price: pricePoints[i].price, no_of_units: pricePoints[i].no_of_units })
                    }
                }
            }

            var pricePointObj = calculatePricePointsDaily(obj)

            var pricePointObjPrepped = prepForHighCharts(pricePointObj)

            var daily_percentage_points = calculatePercentages(pricePointObjPrepped.values)

            pricePointObjPrepped.percentages = daily_percentage_points

            res.send(pricePointObjPrepped)
        };
    });
});



// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
