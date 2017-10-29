$(document).ready(function() {

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

    var portfolio = $('#table-container').data('portfolio')

    var holdingsArr = [];

    for(var key in portfolio.holdings){
        if(portfolio.holdings.hasOwnProperty(key)) {

            var obj = {
                name: portfolio.holdings[key].ticker,
                y: portfolio.holdings[key].holding_ratio*100
            }

            holdingsArr.push(obj)
        }
    }

    $(function () { 
        
        var myChart = Highcharts.chart('cake-portfolio-container', {
            chart: {
                type: 'pie'
            },
            title: {
                text: ''
            },
            plotOptions: {
                pie: {
                    size:'50%',
                }
            },
            series: [{
                name: "%",
                data: holdingsArr
            }],
            credits: {
                enabled: false
            }
        });
    });

    var renderOverview = function(pricePoints){
        $('.current-balance').text((pricePoints.values[pricePoints.values.length - 1]).formatMoney(0,'','.')+ " NOK")
    }

    var fetchPricePointsAndDrawGraph = function(){

        $.post("/fetch_pricepoints", { portfolio: JSON.stringify(portfolio) }, function(results){        
    
            renderOverview(results)

            Highcharts.chart('linear-graph-portfolio', {

                title: {
                    text: 'Portfolio utvikling 2017'
                },

                yAxis: {
                    title: {
                        text: '%'
                    }
                },
                xAxis: {
                    categories: results.dates
                },
                legend: {
                    layout: 'vertical',
                    align: 'right',
                    verticalAlign: 'middle'
                },
                tooltip: {
                    valueDecimals: 2
                },
                plotOptions: {
                    series: {
                        label: {
                            connectorAllowed: false
                        }
                    }
                },
                credits: {
                    enabled: false
                },

                series: [{
                    data: results.percentages
                }],

                responsive: {
                    rules: [{
                        condition: {
                            maxWidth: 500
                        },
                        chartOptions: {
                            legend: {
                                layout: 'horizontal',
                                align: 'center',
                                verticalAlign: 'bottom'
                            }
                        }
                    }]
                }

            });
        })
    }()

    Highcharts.chart('column-last-12-months', {
    chart: {
        type: 'column'
    },
    title: {
        text: 'Last 12 months'
    },
    xAxis: {
        categories: [
            'Last 12 months'
        ]
    },
    yAxis: {
        min: 0,
        title: {
            text: 'Return (%)'
        }
    },
    tooltip: {
        headerFormat: '<span style="font-size:10px">{point.key}</span><table>',
        pointFormat: '<tr><td style="color:{series.color};padding:0">{series.name}: </td>' +
            '<td style="padding:0"><b>{point.y:.1f} %</b></td></tr>',
        footerFormat: '</table>',
        shared: true,
        useHTML: true
    },
    credits:{
        enabled: false
    },
    plotOptions: {
        column: {
            pointPadding: 0.2,
            borderWidth: 0
        }
    },
    series: [{
        name: 'Last 12 months',
        data: [portfolio.one_year_return]
    }]
});

} );