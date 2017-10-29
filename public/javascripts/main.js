$(document).ready(function() {

    var url = window.location.href.split(/\//g);

    $('.side-nav').find("li").removeClass("active")
    $('li.'+url[4]+'-link').addClass("active")

});