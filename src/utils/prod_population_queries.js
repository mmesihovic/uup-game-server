const fetch = require('node-fetch');

(function() {
    //Populate Assignments
    const assignmentsURL = "http://34.69.254.181/services/uup_game.php?action=createAssignment"
    try 
    {
        fetch("http://34.69.254.181/services/auth.php", { 
            method: "POST",
            headers: {
                "accept":"application/json"
            },
            body: JSON.stringify({
                "login": "vljubovic",
                "password": "incorrect"
            })
        }).then( response => response.json())
        .then( async data => { 
            let sid = data.sid;
            let assignmentParams = {
                method: "POST",
                credentials: 'include',
                headers:{
                    "accept":"application/json",
                    "Cookie":"PHPSESSID="+ sid,
                },
                body: {}
            }
            for(let i=1;i<=10;i++) {
                assignmentParams.body = JSON.stringify({
                    name: "L" + i,
                    displayName: "Lesson "+i,
                    points: 3,
                    challengePoints: 2,
                    active: i<=5
                });
                let resp = await fetch(assignmentsURL, assignmentParams);
                let data = await resp.json();
            }  
        });
    } catch (err) {
        console.log("error:", err.stack);
    };
})()


