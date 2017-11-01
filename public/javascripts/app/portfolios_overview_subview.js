$(document).ready(function() {

    $('.portfolio-overview-row').on("click", function(e){
        var $row = $(this)
        var $portfDetails = $row.parent().next(".portfolio-details")
        , isHidden = $portfDetails.is(":hidden")
        , elem = $(e.target).prop('nodeName');


        if(isHidden){
            $row.find(".fa-chevron-right").addClass("rotate")
            $portfDetails.show('fast')
        } else if (!isHidden) {
            $row.find(".fa-chevron-right").removeClass("rotate")
            $portfDetails.hide('fast')
        }
    });

    var showPopover = function(){
        $doughnut = $(this)
        var bondPerc = $doughnut.data("bonds")
        , stockPerc = 100 - bondPerc;
        $doughnut.find(".stocks").text(stockPerc)
    }

    var hidePopover = function(){

    }

    var arr = [90,15,50,70]

    var $doughnut = $('.doughnut');

    $doughnut.each(function(i){
        $(this).attr("style", "animation-delay: -"+arr[i]+"s;").data("bonds", arr[i]).data("stocks", (100-arr[i]))
        .find(".stocks").text(100-arr[i])
        .siblings(".bonds").text(arr[i])
    })
    .on("mouseover", function(){
        showPopover.apply(this)
    })
    .on("mouseout", function(){
        hidePopover.apply(this)
    })


});