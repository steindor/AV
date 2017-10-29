$(document).ready(function(){
    $loginForm = $('#login-form')

    $loginForm.on("submit", function(){
        var data = $(this).serializeArray();
        
        var email = data[0].value
        , password = data[1].value;

        $.post("/login", { email: email, password: password }, function(results){

            if(results.login){
                window.location.replace('/app')
            } else {
                alert("Wrong username or password")
            }
            return false;
        })
    })
})