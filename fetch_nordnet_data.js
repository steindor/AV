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

var NN = {
    user: "steoell@gmail.com",
    password: "6HFBt>Vm"
}


/*
    Fonds have classids
    Stocks and other securities have identifiers
*/

// aggressive variation of RAY DALIO
var RAY_DALIO_NN = {
    name: "RAY_DALIO_NN",
    starting_value: 1000000,
    holdings: [{
        name: "KLP AksjeNorge Indeks II",
        classid: "F000002489",
        identifier: undefined,
        holding_ratio: 0.25,
        type: "fond",
    }, {
        name: "KLP Aksje Fremvoksende Markeder Indeks II",
        classid: "F00000MKDH",
        identifier: undefined,
        holding_ratio: 0.25,
        type: "fond",
    }, {
        name:"KLP Kredittobligasjon",
        classid: "F000002T8Y",
        identifier: undefined,
        holding_ratio: 0.2,
        type: "fond",
    }, {
        name: "KLP Obligasjon 5 år",
        classid: "CL00013797",
        identifier: undefined,
        holding_ratio: 0.15,
        type: "fond",
    }, {
        name: "LONG GULL ND",
        classid: undefined,
        identifier: 2064206,
        market_id: 15,
        holding_ratio: 0.075,
        type: "",
    }, {
        name: "Handelsbanken Råvarefond",
        classid: "0P0000PV9R",
        identifier: undefined,
        holding_ratio: 0.075,
    }]
}

// 90 stocks vs 10 bonds
var AGGRESSIV_PORT = {
    name: "AGGRESSIV_PORT",
    starting_value: 1000000,
    holdings: [{
        name: "KLP AksjeNorge Indeks II",
        classid: "F000002489",
        identifier: undefined,
        holding_ratio: 0.35,
        type: "fond"
    }, {
        name: "KLP Aksje Fremvoksende Markeder Indeks II",
        classid: "F00000MKDH",
        identifier: undefined,
        holding_ratio: 0.3,
        type: "fond"
    }, {
        name: "KLP AksjeGlobal Indeks V",
        classid: "F00000XWSL",
        identifier: undefined,
        holding_ratio: 0.20,
        type: "fond"
    },{
        name:"KLP Kredittobligasjon",
        classid: "F000002T8Y",
        identifier: undefined,
        holding_ratio: 0.05,
        type: "fond"
    }, {
        name: "KLP Obligasjon 5 år",
        classid: "CL00013797",
        identifier: undefined,
        holding_ratio: 0.05,
        type: "fond"
    }]
}

// 90 bonds vs 10 stocks
var DEFENSIVE_PORT = {
    name: "DEFENSIVE_PORT",
    starting_value: 1000000,
    holdings: [{
        name: "KLP AksjeNorge Indeks II",
        classid: "F000002489",
        holding_ratio: 0.05,
        type: "fond"
    }, {
        name: "KLP Aksje Fremvoksende Markeder Indeks II",
        classid: "F00000MKDH",
        holding_ratio: 0.05,
        type: "fond"
    },{
        name:"KLP Kredittobligasjon",
        classid: "F000002T8Y",
        holding_ratio: 0.45,
        type: "fond"
    }, {
        name: "KLP Obligasjon 5 år",
        classid: "CL00013797",
        holding_ratio: 0.45,
        type: "fond"
    }]
}

var deep_cp = function(obj){
    return JSON.parse(JSON.stringify(obj))
}

var getSecurityData = function(security, portfolio){
    var d = deferred();

    // if the security doesnt have classid, it has an identifier and vice versa
    var url = (security.classid === undefined) ? "https://www.nordnet.no/mux/web/marknaden/aktiehemsidan/index.html?identifier="+security.identifier+"&marketid="+security.market_id : "https://secust.msse.se/se/nordnetny/funds/overview.aspx?cid="+security.classid
    

    nightmare
    .on('console', (log, msg) => {
        console.log(msg)
    })
    .goto(url)
    .wait(5000)
    .evaluate(function(){
        var arr = [];
        // push all the table into array
        document.querySelectorAll("tr.first td").forEach(function(elem){
            arr.push(elem.innerText)
        })
        return arr;
    })
    .then(function(results){

        if(security.classid === undefined){
                console.log("it doesnt have a classid!!")
                var price = parseFloat(results[3].replace(",","."))
                // arr.push(elem.innerText)

                console.log(price)

        } else {
            console.log("it has a classid!")
            // if the security has classid
            var arr_new = [];

            results.forEach(function(elem){            
                if(elem.indexOf("NOK") > - 1){
                    arr_new.push(elem);
                }
            })

            var price = parseFloat(arr_new[arr_new.length-2].split(" ")[0])

        }

        var value_of_holding = (portfolio.starting_value*security.holding_ratio)
        , no_of_units = value_of_holding/price

        var q = connection.query("INSERT INTO nn_portfolios (portfolio_name, classid, identifier, long_name, holding_ratio, price, no_of_units, value) VALUES (?,?,?,?,?,?,?,?)", [portfolio.name, security.classid, security.identifier, security.name, security.holding_ratio, price, no_of_units, value_of_holding], function(err, rows, fields){
            console.log(q.sql)
            if(err) throw err;
            else {
                console.log("row saved into portfolio!")
                d.resolve("done!")
            };
        });

    })


    return d.promise;
}

var getPriceofSecurity = function(classid){

    var d = deferred();

    nightmare
    .on('console', (log, msg) => {
        console.log(msg)
    })
    .goto("https://secust.msse.se/se/nordnetny/funds/overview.aspx?cid="+classid)
    .wait(5000)
    .evaluate(function(){
        var arr = [];
        document.querySelectorAll("tr.first td").forEach(function(elem){
            if(elem.innerText.indexOf("NOK") > - 1){
                arr.push(elem.innerText)
            }
        })
        return arr;
    })
    .then(function(results){
        

        var price = parseFloat(results[results.length-2].split(" ")[0])

        var security = {
            price: price,
            classid: classid
        }

        d.resolve(security)

    })


    return d.promise;
}

var savePortfolio = function(portfolio){

    var dp_cp = deep_cp(portfolio)

    getSecurityData(dp_cp.holdings.shift(), portfolio).then(function next(){

        if(dp_cp.holdings.length){
            getSecurityData(dp_cp.holdings.shift(), portfolio).then(next)
        } else {
            console.log("ALL DONE!")
        }
    })
} 

var savePricePoint = function(row){
    var d = deferred();
    getPricePoint(row.classid).then(function(results){

        connection.query("INSERT INTO nn_price_points (classid, price) VALUES (?,?)", [results.classid, results.price], function(err, rows, fields){
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
    connection.query("SELECT DISTINCT(classid) FROM nn_portfolios", function(err, rows, fields){
        if(err) throw err;
        else {

            var rows = removeRowDataPacket(rows)

            console.log(rows)

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
}

var getPricePoint = function(classid){
    var d = deferred()

    getPriceofSecurity(classid).then(function(results){
        console.log("get price of security done")
        d.resolve(results)
    })

    return d.promise;
}

module.exports = {
    savePortfolio: savePortfolio,
    getPricePoints: getPricePoints
}

// savePortfolio(AGGRESSIV_PORT)

// TODO: gera nyja toflu i DB fyrir nordnet pricepoints - vantar stora yfirlitstoflu med nofnum a securities og classids.....
    // a. setja saman 3 portfolio
        // 1 aggresivt autovest x
        // 2. defensift autovest x
        // 3. ray dalio med kaupanlegum securities - vantar enntha commodities og gull :/
   




// Buying via nordnet function - on ice till I have funds

// nightmare
//     .on('console', (log, msg) => {
//         console.log(msg)
//     })
//     .goto("https://www.nordnet.no/mux/login/start.html?cmpi=start-loggain&state=signin")
//     .wait(2000)
//     .click(".loginMethods a[class*='button']")
//     .wait(2000)
//     .type("input[id='password']", NN.password)
//     .type("input[id='username']", NN.user)
//     .wait(1000)
//     .click(".sign-in-legacy__submit-options__btn [type='submit']")
//     .wait(5000)
//     nightmare.viewport(1024, 768)
//     .wait(1000)
//     .screenshot("./public/data/screenshots/pic_nn.png")
//     .wait(3000)
//     // .evaluate(function(){
//     //     return document.querySelector("a[class*='button']").innerHTML
//     // })
//     .then(function(result) {

//         // console.log(result)

//         // saveCCInfo(obj_arr, "cc_info_ohj")
//         console.log("done!")

//     })
//     .catch(function(error){
//         console.log(error)
//     })
