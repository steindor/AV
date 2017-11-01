var Nightmare = require('nightmare');
var nightmare = Nightmare({ show: false })
var deferred = require('deferred')
var Xvfb = require('xvfb')
var config = require('../config.js')
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

var getAccountStatus = function(){

    var d = deferred()

    xvfb.start(function(err, xvfbProcess) {
    // code that uses the virtual frame buffer here 
        
        nightmare
            .on('console', (log, msg) => {
                console.log(msg)
            })
            .goto("https://www.nordnet.no/mux/login/start.html?cmpi=start-loggain&state=signin")
            .wait(1000)
            .click(".loginMethods a[class*='button']")
            .type("input[id='password']", config.nordnet.password)
            .type("input[id='username']", config.nordnet.user)
            .wait(1000)
            .click(".sign-in-legacy__submit-options__btn [type='submit']")
            .wait(3000)
            .evaluate(function(){
                return document.querySelector("div[data-portfolio*='18229971']").innerHTML
            })
            .then(function(results) {

                var $ = cheerio.load(results)

                $('.value').each(function(results){
                    d.resolve(results)
                })

                xvfb.stop(function(err) {
                    console.log("stopped")
                });
            })
            .catch(function(error){
                console.log(error)
            })



    });
    return d.promise;
}

module.exports = {
    getAccountStatus: getAccountStatus
}


