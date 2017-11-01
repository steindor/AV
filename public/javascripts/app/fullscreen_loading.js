$(document).ready(function(){

    $.post("/get_nordnet_account_status", function(results){
        if(!results.err){
            window.location.replace("/app/overview")
        }
    })

})