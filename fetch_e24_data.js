
var Nightmare = require('nightmare');
var nightmare = Nightmare({ show: true })
var cheerio = require('cheerio')


var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'gunnitheman',
  database : 'dn_portfolio',
  multipleStatements: true
});

var isFloat = function(n){
  return parseFloat(n) === n
}

var removeNaN = function(val){
    if(isNaN(val)){
      return null
    } else {
      return "'"+val+"'"
    }
}

console.log("fetching data...")


var ifDataMissing = function(obj){
    var dataMissing = false;

    // criterias - remove missing data
    dataMissing = (obj.ticker === undefined ? true : false)
    dataMissing = (isNaN(obj.price_to_sales_17) === true ? true : false)
    dataMissing = (isNaN(obj.price_to_sales_18) === true ? true : false)
    dataMissing = (isNaN(obj.price_to_earnings_17) === true ? true : false)
    dataMissing = (isNaN(obj.price_to_earnings_18) === true ? true : false)
    dataMissing = (isNaN(obj.return_on_capital_17) === true ? true : false)
    dataMissing = (isNaN(obj.return_on_capital_18) === true ? true : false)

    return dataMissing
}


  nightmare
    .goto("https://bors.e24.no/#!/list/norway/estimates")
    .wait('.table-condensed')
    .evaluate(function () {
      return document.querySelector('.table-condensed').innerHTML
    })
    .end()
    .then(function (result) {
      var $ = cheerio.load("<table>"+result+"</table>")

      var stocksArray = [];

      var obj;

      $('tr').each(function(){

        // get the ticker url - some are undefined since they are missing
        var ticker_url = $(this).find('a').attr("href");

        // remove the ticker from the url (from the last /)
        var ticker = (ticker_url !== undefined) ? ticker_url.match(/([^\/]*)\/*$/)[1] : undefined


          obj = {
            company_name: $(this).children().first().text(),
            ticker: ticker,
            price_to_sales_17: parseFloat($(this).children().eq(1).text().replace(",",".")),
            price_to_sales_18: parseFloat($(this).children().eq(2).text().replace(",",".")),
            price_to_earnings_17: parseFloat($(this).children().eq(3).text().replace(",",".")),
            price_to_earnings_18: parseFloat($(this).children().eq(4).text().replace(",",".")),
            return_on_capital_17: parseFloat($(this).children().eq(5).text().replace(",",".")),
            return_on_capital_18: parseFloat($(this).children().eq(6).text().replace(",",".")),
            target_18: parseFloat($(this).children().eq(7).text().replace(",",".")),
          };

          // if there is no data missing then push the object - if not, leave it out - cleaning the data
          if(!ifDataMissing(obj)){
              stocksArray.push(obj)
          }
      })

      var stocksArrayFormatted = "";


      for (var i = 0; i < stocksArray.length; i++) {
        if(i === stocksArray.length - 1){
           stocksArrayFormatted += "('"+stocksArray[i].company_name+"', '"+stocksArray[i].ticker+"', "+removeNaN(stocksArray[i].price_to_sales_17)+", "+removeNaN(stocksArray[i].price_to_sales_18)+", "+removeNaN(stocksArray[i].price_to_earnings_17)+", "+removeNaN(stocksArray[i].price_to_sales_18)+", "+removeNaN(stocksArray[i].return_on_capital_17)+", "+removeNaN(stocksArray[i].return_on_capital_18)+", "+removeNaN(stocksArray[i].target_18)+")"
        } else {
           stocksArrayFormatted += "('"+stocksArray[i].company_name+"', '"+stocksArray[i].ticker+"', "+removeNaN(stocksArray[i].price_to_sales_17)+", "+removeNaN(stocksArray[i].price_to_sales_18)+", "+removeNaN(stocksArray[i].price_to_earnings_17)+", "+removeNaN(stocksArray[i].price_to_sales_18)+", "+removeNaN(stocksArray[i].return_on_capital_17)+", "+removeNaN(stocksArray[i].return_on_capital_18)+", "+removeNaN(stocksArray[i].target_18)+"), "          
        }
      }

      connection.query("INSERT INTO e24_stock_info (company_name, ticker, price_to_sales_17, price_to_sales_18, price_to_earnings_17, price_to_earnings_18, return_on_capital_17, return_on_capital_18, target_18) VALUES "+stocksArrayFormatted, function(err, rows, fields){
        if(err){
          throw err
        } else {
            console.log("data saved")
        }
      })
    })
    .catch(function (error) {
      console.error('Search failed:', error);
    });    