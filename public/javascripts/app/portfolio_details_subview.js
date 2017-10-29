$(document).ready(function(){

    var drawGraph = function(results){

        var ctx = document.getElementById("projection-line-graph").getContext('2d');
        var myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [2020, 2025, 2030, 2035],
                datasets: [{
                    label: '(%)',
                    fill: false,
                    data: [100, 125, 155, 210, 250],
                    backgroundColor: [
                        // 'rgba(255, 99, 132, 0.2)',
                        // 'rgba(54, 162, 235, 0.05)',
                        // 'rgba(255, 206, 86, 0.05)',
                        // 'rgba(75, 192, 192, 0.2)',
                        // 'rgba(153, 102, 255, 0.2)',
                        // 'rgba(255, 159, 64, 0.2)'
                    ],
                    borderColor: [
                        // 'rgba(255,99,132,1)',
                        // 'rgba(54, 162, 235, 1)',
                        // 'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        // 'rgba(153, 102, 255, 1)',
                        // 'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }, {
                    label: '(%)',
                    fill: false,
                    data: [100, 117, 135, 165, 195],
                    backgroundColor: [
                        // 'rgba(255, 99, 132, 0.2)',
                        'rgba(54, 162, 235, 0.2)',
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
                }, {
                    label: '(%)',
                    fill: "-2",
                    data: [100, 110, 115, 118, 121],
                    backgroundColor: [
                        // 'rgba(255, 99, 132, 0.2)',
                        'rgba(54, 162, 235, 0.2)',
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
                            stepSize: 50
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
    }()
})