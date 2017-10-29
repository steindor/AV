$(document).ready(function(){

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

    var removeLoadingElement = function(){
        $('.loading-element').remove()
    }

    var fetchDataforGraph = function(){

        $.post('/fetch_data_for_graph', function(results){
            removeLoadingElement();
            drawGraph(results);
            drawOverviewTable(results)
        })
    }()

    var drawOverviewTable = function(results){

        var $tableNumbers = $('.inner-overview-table').find('.overview-table-numbers');
        $tableNumbers.each(function(index){
            var $elem = $(this);

            if(index === 0){
                $elem.find(".cog-loader").remove();
                $elem.find(".number-container").text(results.total_amount_invested.formatMoney(0,"","."))
            } else if(index === 1){
                var value_now = results.total_amount_invested +results.daily_return_arr[results.daily_return_arr.length-1]
                $elem.find(".cog-loader").remove();
                $elem.find(".number-container").text(value_now.formatMoney(0,"","."))
            } else if(index === 2){
                $elem.find(".cog-loader").remove();
                $elem.find(".number-container").text(results.total_daily_return_perc[results.total_daily_return_perc.length - 1])
            }
        })
    }

    var drawGraph = function(results){

        var ctx = document.getElementById("chart-canvas").getContext('2d');
        var myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: results.dates,
                datasets: [{
                    label: '(%)',
                    data: results.total_daily_return_perc,
                    backgroundColor: [
                        // 'rgba(255, 99, 132, 0.2)',
                        'rgba(54, 162, 235, 0.05)',
                        // 'rgba(255, 206, 86, 0.05)',
                        // 'rgba(75, 192, 192, 0.2)',
                        // 'rgba(153, 102, 255, 0.2)',
                        // 'rgba(255, 159, 64, 0.2)'
                    ],
                    borderColor: [
                        // 'rgba(255,99,132,1)',
                        'rgba(54, 162, 235, 1)',
                        // 'rgba(255, 206, 86, 1)',
                        // 'rgba(75, 192, 192, 1)',
                        // 'rgba(153, 102, 255, 1)',
                        // 'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                legends: {
                    display: false,
                    labels: {
                        display: false
                    }
                },
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero:true,
                            callback: function(label, index, labels) {
                                return label+' %';
                            }
                        },
                        ticks: {
                            min: 0,
                            stepSize: 0.5
                        }
                    }],
                    xAxes: [{
                        gridLines: {
                            color: "rgba(0, 0, 0, 0)"
                        }
                    }]
                }
            }
        });
    }
})