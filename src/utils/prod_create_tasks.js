const fetch = require('node-fetch');

(function() {
    //Populate Assignments
    const tasksURL = "http://34.69.254.181/services/uup_game.php?action=createTask&assignmentId="
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
            let taskParams = {
                method: "POST",
                credentials: 'include',
                headers:{
                    "accept":"application/json",
                    "Cookie":"PHPSESSID="+ sid,
                },
                body: {}
            }
            let index = 0;
            for(let i=1; i<=10;i++) {
                for(let j=1;j<=3;j++) {
                    for(let k=1;k<=10;k++) {
                        let url = tasksURL + i.toString();
                        taskParams.body = JSON.stringify({
                            name: 'T'+ (index+1).toString(),
                            displayName: 'Task ' + (index+1).toString(),
                            category: j,
                            hint: 'Hint ' + (index+1).toString()
                        });
                        index++;
                        let resp = await fetch(url, taskParams);
                        let data = await resp.text();
                    }
                }
            }
        });
    } catch (err) {
        console.log("error:", err.stack);
    };
})()


