$(document).ready(function() {

    $('.portfolio-overview-row').on("click", function(e){
        var $row = $(this)
        var $portfDetails = $row.parent().next(".portfolio-details")
        , isHidden = $portfDetails.is(":hidden")
        , elem = $(e.target).prop('nodeName');


        if(isHidden){
            $row.find(".fa-chevron-right").addClass("rotate")
            $portfDetails.slideDown()
        } else if (!isHidden) {
            $row.find(".fa-chevron-right").removeClass("rotate")
            $portfDetails.slideUp()
        }
    });
});