import express from 'express';
import format from 'pg-format';
import { connectionPool } from '../utils/connection-pool';
const router = express.Router();

const completedWithTreshhold = async(student, assignment_id) => {

}

const calculateAdditionalTokens = async (student, assignment_id) => {
    var returnObject = {}
    const client = await connectionPool.connect();
    try {
        //Ako nije virgin assignment_progress za studenta poselami kuci
        let checkVirginityQuery = 'SELECT virgin from assignment_progress WHERE student=$1 AND assignment_id=$2';
        let res = await client.query(checkVirginityQuery, [student, assignment_id]);
        if(res.rows.length && res.rows[0].virgin == false)
            returnObject = {
                additionalTokens: 0,
                reason: "Student isn't finishing the assignment first time."
            }
        let totalTokens = 0 ;
        // Ako je zavrsio assignment i ima odredjeni broj bodova
        // Ako je zavrsio assignment bez koristenja powerup-a
        // Ako je zavrsio assignment sa maksimalnim brojem poena
        // Ako je ispunio oba 
    } catch(e) {
        throw e;
    } finally {
        client.release();
    }
    return 0;
}

const getNextTask = async (replacementType, student, assignment_id, taskData) => {
    let newTask = { id: -1, name: "Nothing happened so far" };
    let currentTaskQuery = `SELECT task_id FROM current_tasks
                                WHERE student=$1 AND assignment_id=$2;`
    let currentTaskQueryValues = [ student, assignment_id ];
    if(replacementType == 'turn-in') {
        let dbCall = async () => {
            const client = await connectionPool.connect();
            try {
                //Get current task ID 
                let res = await client.query(currentTaskQuery, currentTaskQueryValues);
                if(res.rows.length == 0 ) throw "Student " + student + " doesn't have active task in given assignment"; 

                let currentTask_id = res.rows[0].task_id;
                //Get current task number, so we can select tasks which are after this one
                let currentTaskNumberQuery = 'SELECT task_number FROM student_tasks WHERE student = $1 and assignment_id = $2 and task_id = $3;';
                let currentTaskNumberQueryValues = [ student, assignment_id, currentTask_id];
                
                res = await client.query(currentTaskNumberQuery, currentTaskNumberQueryValues);

                let currentTaskNumber = res.rows[0].task_number;
                //Getting all next tasks with task_number higher than current which aren't turned in
                let nextTaskQuery = `SELECT task_id, task_name
                                    FROM student_tasks
                                    WHERE student = $1 and assignment_id = $2 and task_number > $3 AND turned_in = false
                                    ORDER BY task_number ASC;`
                let nextTaskQueryValues = [ student, assignment_id, currentTaskNumber];

                res = await client.query(nextTaskQuery, nextTaskQueryValues);
                if(res.rows.length == 0 ) {
                    // If there are no results, assignment is done, next task_id is -1
                    newTask = { id: -1, name: "Assignment finished", previous_task: currentTask_id };
                } else {
                    // If there are results, take first next task (they are ordered) and return it
                    newTask = { id: res.rows[0].task_id, name: res.rows[0].task_name, previous_task: currentTask_id };
                }
                return newTask;
            } catch(e) {
                if(e == "Student " + student + " doesn't have active task in given assignment")
                    throw e;
                else throw "Getting next task process failed.";
            } finally {
                client.release()
            }
        }
        newTask = await dbCall().catch(e => {
            //Just forwarding the exception, forcing the users of this function to implement error messages in request.\
            console.log(e.stack);
            throw e;
        } );
    } 
    else if(replacementType == 'swap') {
        let dbCall = async () => {
            const client = await connectionPool.connect();
            try {
            let res = await client.query(currentTaskQuery, currentTaskQueryValues);
            let currentTask_id = res.rows[0].task_id;
            res = await client.query('SELECT category_id FROM tasks WHERE id=$1 AND assignment_id=$2;', [ currentTask_id, assignment_id ]);
            let category_id = res.rows[0].category_id;
            let replacementTasksQuery = 'SELECT id, task_name FROM tasks WHERE assignment_id=$1 AND category_id=$2 AND id<>$3;';
            res = await client.query(replacementTasksQuery, [ assignment_id, category_id, currentTask_id ]);
            let numberOfTasks = res.rows.length;
            let randomIndex = Math.floor(Math.random() * (numberOfTasks+1));
            return {
                id: res.rows[randomIndex].id,
                name: res.rows[randomIndex].task_name,
                previous_task: currentTask_id
            };   
            } catch(e) {
                console.log(e);
                throw "Getting next task process failed.";
            } finally {
                client.release();
            }      
        }
        newTask = await dbCall().catch(e => {
            //Just forwarding the exception, forcing the users of this function to implement error messages in request.\
            console.log(e.stack);
            throw e;
        } );
    }
    else if(replacementType == 'second-chance') {
        if(!!taskData) {
            let dbCall = async () => {
                const client = await connectionPool.connect();
                try {
                    let res = await client.query(currentTaskQuery, currentTaskQueryValues);
                    let currentTask_id = (res.rows.length) ? res.rows[0].task_id : -2; // -2 no current task meaning assignment is finished
                    let idQuery = 'SELECT task_id FROM student_tasks WHERE student=$1 AND assignment_id=$2 AND task_number=$3 AND task_name=$4;';
                    let idQueryValues = [ student, assignment_id, taskData.task_number, taskData.task_name ];
                    res = await client.query(idQuery, idQueryValues);
                    if(res.rows.length == 0)
                        throw "There are no tasks with given parameters.";
                    let oldTask_id = res.rows[0].task_id; 
                    return {
                        id: oldTask_id,
                        name: taskData.task_name,
                        previous_task: currentTask_id
                    }
                } catch (e) {
                    throw (e=="There are no tasks with given parameters.") ? e : "Getting next task process failed.";
                } finally {
                    client.release();
                }
            };
            newTask = await dbCall().catch(e => {
                 //Just forwarding the exception, forcing the users of this function to implement error messages in request.\
            console.log(e.stack);
            throw e;
            })
        }
    }
    return newTask;
}

const replaceTasks = async (replacementType, student, assignment_id, percent, taskData) => {
    let done = false;
    let currentTaskQueryValues = [ student, assignment_id ];
    // First we need current task, if it doesn't exist RIP
    let currentTask_id, maxPointsPct, maxPoints, maxTokens, points, tokens, additionalTokens;
    let newTask = {};
    try {
        newTask = await getNextTask(replacementType, student, assignment_id, taskData);
        currentTask_id = newTask.previous_task;
        let idValue = newTask.previous_task == -2 ? newTask.id : currentTask_id;
        // Daj kategoriju za current_task
        let res = await connectionPool.query('SELECT category_id FROM tasks WHERE id=$1', [ idValue ]);
        if(res.rows.length == 0)
            throw "No category found for given task.";
        let category_id = res.rows[0].category_id;
        let assignmentData = await connectionPool.query('SELECT points FROM assignments WHERE id=$1', [assignment_id]);
        if(assignmentData.rows.length == 0)
            throw "No assignment with given ID.";

        let assignmentMaxPoints = assignmentData.rows[0].points;
        // Izracunaj poene i refreshaj updateStudentTasksQueryValues;
        let taskCategories = await connectionPool.query('SELECT * from task_categories');

        for(let i=0;i<taskCategories.rows.length;i++) {
            if(taskCategories.rows[i].id == category_id) {
                maxPointsPct = taskCategories.rows[i].points_percent;
                maxPoints = (Math.round(maxPointsPct * assignmentMaxPoints*100)/100).toFixed(2);
                maxTokens = taskCategories.rows[i].tokens;
                break;
            }
        }

    } catch(e) {        
        console.log(e);
        throw e;
    }
    let updateStudentTasksQuery;
    let updateStudentTasksQueryValues;
    let updateCurrentTasksQuery = `UPDATE current_tasks
                                   SET task_id = $1, task_name= $2
                                   WHERE student=$3 and assignment_id = $4`;
    let updateCurrentTasksQueryValues = [ newTask.id, newTask.name, student, assignment_id ];   

    if(replacementType == 'turn-in') {
        if(newTask.id == -1) {
            updateCurrentTasksQuery = `DELETE FROM current_tasks
                                       WHERE student = $1 and assignment_id = $2`;
            updateCurrentTasksQueryValues = currentTaskQueryValues;
            // Provjeri da li prvi put zavrsava assignment, ako da, i ima ispunjeno nesto za tokene, dodaj mu tokene.
            //additionalTokens = checkChallenges();
            done = true;
        }     
        // Izracunamo poene
        points = percent * maxPoints;
        updateStudentTasksQuery = `UPDATE student_tasks
                                   SET points = $1, turned_in = TRUE, percent =$2
                                   WHERE task_id = $3 AND student = $4 AND assignment_id = $5`;
        updateStudentTasksQueryValues = [ points, percent, currentTask_id, student, assignment_id ];
    }
    else if(replacementType == 'swap') {
        updateStudentTasksQuery = `UPDATE student_tasks
                                   SET task_id = $1, task_name = $2, points = NULL, turned_in = FALSE, percent=NULL
                                   WHERE task_id = $3 AND student = $4 AND assignment_id = $5;`;
        updateStudentTasksQueryValues = [ newTask.id, newTask.name, currentTask_id, student, assignment_id ]; 
    }
    
    let updateProgressQuery = `UPDATE assignment_progress SET status='Completed', virgin=false, return_id=-1 WHERE student=$1 AND assignment_id=$2;`;

    let checkChainCallingQuery = 'SELECT return_id FROM assignment_progress WHERE student=$1 AND assignment_id=$2;';

    let dbCall = async () => {
        const client = await connectionPool.connect();
        try {
            await client.query('BEGIN');    
            
            //Update current_task table
            if(newTask.previous_task == -2) {
                //if getNextTask returns currentTask_id as -2, it means that assignment was complete and there isn't any rows in current_tasks for that assignment
                //and most definitely it will return -2 only when second-chance powerup is used
                let insertCurrentTaskQueryValues = [ student, assignment_id, newTask.id, newTask.name ];
                let insertCurrentTaskQuery = format(`INSERT INTO current_tasks(student,assignment_id, task_id, task_name) VALUES (%L)`, insertCurrentTaskQueryValues);
                await client.query(insertCurrentTaskQuery);
            } else {
                await client.query(updateCurrentTasksQuery, updateCurrentTasksQueryValues);    
            }

            if(replacementType == 'second-chance') {
                let res = await client.query(checkChainCallingQuery, [student, assignment_id]);
                let check = res.rows.length && res.rows[0].return_id == -1;
                if(check) {
                    //If returning id is -1 it means that this is not a chain call, and we update the row with currentTask_id (so we can use it later)
                    let updateQuery = `UPDATE assignment_progress SET return_id = $1, status = 'In progress' WHERE student=$2 AND assignment_id=$3;`;
                    await client.query(updateQuery, [currentTask_id, student, assignment_id]);
                }
                //If check is false, then this is chain calling and we don't care about middle tasks
                // (user is warned on front-end that he needs to turn in task to save progress before using powerup again)
            }
            else {
                //Update student_tasks table
                await client.query(updateStudentTasksQuery, updateStudentTasksQueryValues);
                //If turn-in, calculate tokens an
                if(replacementType == 'turn-in') {
                    // Izracunaj tokene (normalne i dodatne) i updateStudentTokens tabelu;
                    tokens = Math.ceil(percent * maxTokens);
                    additionalTokens = 0;
                    // Check for additional tokens only if newTask_id == -1 (assignment completed)
                    if(done)
                        additionalTokens = await calculateAdditionalTokens(student, assignment_id);
                    //Update tokens table
                    let studentTokensCheckQuery = 'SELECT amount FROM tokens WHERE student=$1;';
                    let res = await client.query(studentTokensCheckQuery, [student]);
                    let query, values;
                    if(res.rows.length == 0) {
                        query = 'INSERT INTO tokens(student,amount) VALUES %L';
                        let total = tokens + additionalTokens;
                        values = [ [student, total ] ];
                        await client.query(format(query,values));
                    } else {
                        query = 'UPDATE tokens SET amount = amount + $1 WHERE student=$2';
                        let total = tokens + additionalTokens;
                        values = [ total , student];
                        await client.query(query,values);
                    }
                }
            }

            //If assignment is completed update the assignment_progress for student
            if(done) 
                await client.query(updateProgressQuery, [ student, assignment_id ]);
            
            //Switch files on filesystem           
            if(replacementType == 'turn-in') {
                // IZ TABELE ASSIGNMENT_PROGRESS uzeti return_id i uporedit sa newTask id, ako se matchaju, onda iz taskHistory, ako ne onda iz uup-game
                // ovdje onda treba dodati i ako se matchaju, da ga vrati na -1 u slucaju da on ponovo kasnije hoce powerup na istom assginmentu.
                let locationQuery = 'SELECT return_id FROM assignment_progress WHERE student=$1 AND assignment_id=$2';
                let res = await client.query(locationQuery, [student, assignment_id]);
                let return_id = (res.rows.length) ? res.rows[0].return_id : -4;
                if( newTask.id == return_id) {
                    //if we are returning to task with return_id then we set return_id to -1 so student can use the powerup again
                    await client.query('UPDATE assignment_progress SET return_id=-1 WHERE student=$1 AND assignment_id=$2', [student,assignment_id]);
                    console.log("pulling from task:history");
                    // iz task historya
                } else {
                    console.log("pulling from uup-game");
                    // iz uup-game
                }
            }
            else if(replacementType == 'swap') {
                // Ovdje uvijek ide iz uup-game
                console.log("Swap : from uup-game");
            }
            else if(replacementType == 'second-chance') {
                // Ovdje uvijek ide iz taskHistory 
                console.log("Second chance: from taskHistory");
            }

            await client.query('COMMIT');
        } catch (e) {
            //If any of the queries fail, db is rolled back.
            await client.query('ROLLBACK');
            console.log(e.stack);
            throw "Internal database error.";
        } finally {
            client.release();
        }

    }
    await dbCall().catch(e => {
        //Just forwarding the exception, forcing the users of this function to implement error messages in request.
        console.log(e.stack);
        throw e;
    });
    return done;
} 

//Get students current task for given assignment ID
router.get('/:student/current/:assignment_id', (req,res) => {
    let student = req.params.student;
    let assignment_id = req.params.assignment_id;
    let query = `SELECT task_id, task_name FROM current_tasks WHERE student=$1 and assignment_id=$2;`
    connectionPool.query(query, [ student, assignment_id ])
    .then( (results) => {
        if(results.rows.length == 0)
            res.status(400).json({ message: "Student" + student + " does not have active tasks in given assignment." });
        else
            res.status(200).json(results.rows[0]);
    })
    .catch( e=> { res.status(500).json({ message: "Internal server error."}) }); 
});

const validateTurnInBody = (data) => {
    if(!!data) {
        let keys = Object.keys(data);
        return keys.includes('passed_tests') && keys.includes('total_tests') && (typeof data['passed_tests'] == 'number') && (typeof data['total_tests'] == 'number');
    }
    return false;
}

//Turn in task and yield next task in given assignment to users workspace
router.post('/turn_in/:student/:assignment_id', (req, res) => {
    if(!validateTurnInBody(req.body)) {
        res.status(400).json({
            message: "Invalid parameters."
        });
        return;
    }
    let percent = req.body['passed_tests'] / req.body['total_tests'];
    let student = req.params.student;
    let assignment_id = req.params.assignment_id;
    var assignmentDone;
    (async () => { assignmentDone = await replaceTasks('turn-in', student, assignment_id, percent, {}); })()
    .then(() => {
        res.status(200).json({
            message: "Current task for student " + student + " in given assignment has been been turned in successfully.",
            assignmentCompleted: assignmentDone
        });
    }).catch(error => { 
        res.status(500).json({ 
            message: "Task turning in process for student " + student + " failed.",
            reason: error
        });
    });
});

//Swap current task for a new one in given assignment
router.post('/swap/:student/:assignment_id', (req,res) => {
    let student = req.params.student;
    let assignment_id = req.params.assignment_id;
    (async () => { 
        const client = await connectionPool.connect();
        try {
            //Get current task
            client.query("BEGIN");
            let currentTaskQuery = `SELECT task_id FROM current_tasks
                                    WHERE student=$1 AND assignment_id=$2;`
            let currentTaskQueryValues = [ student, assignment_id ];
            let results = await client.query(currentTaskQuery, currentTaskQueryValues);
            if(results.rows.length == 0)
                throw "Student has no current tasks in given assignment.";
            let currentTask_id = results.rows[0].task_id;
            let check = await validatePowerupUse(student, 'Switch Task', assignment_id, currentTask_id, {});
            if(!check)
                throw "Powerup validation failed. Student either doesn't have powerup of this type or has already used it on this task so it cannot be used again.";
            //Get powerupType_ID for Switch Task
            let powerupType_id;
            results = await client.query(`SELECT * from powerup_types WHERE name='Switch Task';`);
            if(results.rows.length == 0)
                throw "Powerup 'Switch Task' not found.";
            powerupType_id = results.rows[0].id;
            //Need current task_number
            results = await client.query('SELECT task_number FROM student_tasks WHERE student=$1 AND task_id=$2 AND assignment_id=$3;', [student, currentTask_id, assignment_id]);
            if(results.rows.length == 0)
                throw "Cannot get task number";
            let task_number = results.rows[0].task_number;
            //Use powerup  
            let query = `UPDATE powerups SET used = TRUE, task_number = $1, assignment_id = $2 
                    WHERE id = (SELECT id FROM powerups WHERE student = $3 AND type_id=$4 AND used=FALSE LIMIT 1)`;
            let values = [ task_number, assignment_id, student, powerupType_id]; 
            await client.query(query, values); 
            await replaceTasks('swap',student,assignment_id, 0, {}); 
            await client.query("COMMIT");
        } catch(e) {
            client.query("ROLLBACK;");
            console.log(e);
            throw e;
        } finally {
            client.release();
        }
    })()
    .then(() => {
        res.status(200).json({ 
            message: "Current task for student " + student + " in given assignment has been swapped successfully.",
            assignmentCompleted: false
        });
    }).catch(error => { 
        res.status(500).json({ 
            message: "Task swapping process for student " + student + " failed.", 
            reason: error
        });
    });
});

const validatePowerupUse = async (student, powerupType, assignment_id, currentTask_id, data, currentTask_number) => {
    const client = await connectionPool.connect();
    try {        
        let typeIdQuery = "SELECT id FROM powerup_types WHERE name=$1";
        let results = await client.query(typeIdQuery, [powerupType]);
        //First check if student has specific powerup available
        if(results.rows.length == 0)
            return false;
        let powerupType_id = results.rows[0].id;
        let hasPowerupQuery = 'SELECT id FROM powerups WHERE student = $1 AND type_id= $2 AND used=false;'
        results = await client.query(hasPowerupQuery, [student, powerupType_id] );
       
        if(results.rows.length == 0)
            return false;

        let usedPowerup = 'SELECT id FROM powerups WHERE student = $1 AND task_number=$5 AND task_id=$2 AND type_id=$3 AND assignment_id=$4 AND used=true;';   
        //Check if student has used this specific powerup on task before
        if(powerupType == 'Hint') {
            results = await client.query(usedPowerup, [student, currentTask_id, powerupType_id, assignment_id, currentTask_number]);
            if(results.rows.length != 0)
                return false;
        }
        else if(powerupType == 'Second Chance') {
            if(!!data) {
                let returnTaskQuery = 'SELECT task_id FROM student_tasks WHERE student = $1 AND assignment_id = $2 AND task_number = $3 AND task_name = $4;';
                results = await client.query(returnTaskQuery, [student, assignment_id, data.task_number, data.task_name]);
                if(results.rows.length == 0)
                    return false;
                let returnTask_id = results.rows[0].task_id;
                //Da li je iskoristio powerup
                results = await client.query(usedPowerup, [student, returnTask_id, powerupType_id, assignment_id, currentTask_number]);
                if(results.rows.length != 0)
                    return false;
            }
        }
        else if(powerupType == 'Switch Task') {
            let taskNumberQuery = 'SELECT task_number FROM student_tasks WHERE student=$1 AND assignment_id=$2 AND task_id=$3;'
            results = await client.query(taskNumberQuery, [student, assignment_id, currentTask_id]);        
            if(results.rows.length == 0)
                return false;
            let taskNumber = results.rows[0].task_number; 
            let usedQuery = 'SELECT id FROM powerups WHERE student = $1 AND used=true AND assignment_id=$2 AND task_number=$3 AND type_id=$4';
            results = await client.query(usedQuery, [student, assignment_id, taskNumber, powerupType_id]);
            if(results.rows.length != 0)
                return false;
        }
    } catch (e) {
        throw e;
    } finally {
        client.release(); 
    }
    return true;
}

const getTaskHint = async (student, assignment_id) => {
    var hint;
    let currentTaskQuery = `SELECT task_id FROM current_tasks
                                WHERE student=$1 AND assignment_id=$2;`
    let currentTaskQueryValues = [ student, assignment_id ];
    let dbCall = async () => {
        const client = await connectionPool.connect();
        try {
            let res = await client.query(currentTaskQuery, currentTaskQueryValues);
            if(res.rows.length == 0)
                throw "No current task for student " + student + " in given assignment.";
            let currentTask_id = res.rows[0].task_id;
            res = await client.query("SELECT task_number FROM student_tasks WHERE student=$1 AND assignment_id=$2 AND task_id = $3;", [student, assignment_id, currentTask_id]);
            if(res.rows.length == 0)
                throw "Task number not found";
            let currentTask_number = res.rows[0].task_number;
            //Get powerupType_ID for HINT
            let powerupType_id;
            res = await client.query(`SELECT * from powerup_types WHERE name=$1;`, ['Hint']);
            if(res.rows.length == 0)
                throw "Powerup 'Hint' not found";
            powerupType_id = res.rows[0].id;
            //Validate if student can use the powerup (if he has powerup and hasn't used it on this task yet)
            let check = await validatePowerupUse(student, 'Hint', assignment_id, currentTask_id, {}, currentTask_number);
            if(!check)
                throw "Powerup validation failed. Student either doesn't have powerup of this type or has already used it on this task so it cannot be used again.";
            let query = `UPDATE powerups SET used = TRUE, task_number = $1, task_id = $2, assignment_id = $3 
                WHERE id = (SELECT id FROM powerups WHERE student = $4 AND type_id=$5 AND used=false LIMIT 1)`;
            let values = [ currentTask_number, currentTask_id, assignment_id, student, powerupType_id];
            //Update powerup to be used
            await client.query(query,values);
            //Return hint
            let hintQuery = 'SELECT hint FROM tasks WHERE id=$1;';
            res = await client.query(hintQuery, [currentTask_id]);
            hint = res.rows[0].hint;
        } catch(e) {
            throw e;
        } finally {
            client.release();
        }
    }
    await dbCall()
    .catch(e=> {
        console.log(e.stack);
        throw e;
    });
    return hint;
}

//Yield a hint for current task student is working on
router.post('/hint/:student/:assignment_id', (req,res) => {
    let student = req.params.student;
    let assignment_id = req.params.assignment_id;
    let hint;
    //Iskoristi powerup
    (async () => { hint = await getTaskHint(student, assignment_id); })()
    .then(() => {
        res.status(200).json({
            message: "Hint for current task successfully retrieved.",
            hint: hint
        });
    }).catch(error => { 
        console.log(error.stack);
        res.status(500).json({ 
            message: "Hint retrieval process failed.",
            reason: error
        });
    });
});

//Get all turned in tasks (names) for student and given assignment which aren't fully completed and student hasn't used powerup with type_id on them
//and he can return on them.
router.get('/turned_in/:student/:assignment_id/:type_id', (req, res) => {
    let student = req.params.student;
    let assignment_id = req.params.assignment_id;
    let type_id = req.params.type_id;
    let query = `SELECT task_number, task_name
                FROM student_tasks
                WHERE student=$1 and assignment_id=$2 AND turned_in=true AND percent<1
                AND task_number NOT IN (SELECT task_number FROM powerups WHERE student=$1 AND assignment_id=$2 AND type_id=$3 AND used=TRUE);`
    connectionPool.query(query, [student, assignment_id, type_id])
    .then( results => {
        res.status(200).json(results.rows);
    })
    .catch( error => {
        console.log(error.stack);
        res.status(500).json({ 
            message: "Internal database error.",
            error: error
        });
    })
});

const validateSecondChanceBody = (data) => {
    if(!!data) {
        let keys = Object.keys(data);
        return keys.includes('task_number') && keys.includes('task_name') && (typeof data['task_number'] == 'number') && (typeof data['task_name'] == 'string');
    }
    return false;
}

router.put('/second_chance/:student/:assignment_id', (req, res) => {
    if(!validateSecondChanceBody(req.body)) {
        res.status(400).json({
            message: "Invalid parameters."
        });
        return;
    }
    let student = req.params.student;
    let assignment_id = req.params.assignment_id;
    let taskData = {
        task_number : req.body.task_number,
        task_name : req.body.task_name
    }
    //Iskoristi powerup
    (async () => { 
        const client = await connectionPool.connect();
        try { 
            await client.query("BEGIN");
            //Get this task_id
            let returnTaskQuery = 'SELECT task_id FROM student_tasks WHERE student = $1 AND assignment_id = $2 AND task_number = $3 AND task_name = $4;';
            let results = await client.query(returnTaskQuery, [student, assignment_id, taskData.task_number, taskData.task_name]);
            if(results.rows.length == 0)
                throw "Task with given number and name hasn't been assigned to student in given assignment.";
            let newTask_id = results.rows[0].task_id;
            //Get powerupType_ID for Second Chance
            let powerupType_id;
            results = await client.query(`SELECT * from powerup_types WHERE name='Second Chance';`)
            if(results.rows.length == 0)
                throw "Powerup 'Second Chance' not found.";
            powerupType_id = results.rows[0].id;
            //Validate if powerup can be used
            let check = await validatePowerupUse(student, 'Second Chance', assignment_id, -1, taskData);
            if(!check)
                throw "Powerup validation failed. Student either doesn't have powerup of this type or has already used it on this task so it cannot be used again.";  
            let query = `UPDATE powerups SET used = TRUE, task_number = $1, task_id = $2, assignment_id = $3 
                    WHERE id = (SELECT id FROM powerups WHERE student = $4 AND type_id=$5 AND used=FALSE LIMIT 1)`;
            let values = [ taskData.task_number, newTask_id, assignment_id, student, powerupType_id]; 
            //Use powerup  
            await client.query(query, values); 
            await replaceTasks('second-chance', student, assignment_id, 0, taskData);  
            await client.query("COMMIT");
        } catch(e) {
            await client.query("ROLLBACK");
            console.log(e);
            throw e;
        } finally {
            client.release();
        }
        })()
     .then(() => {
        res.status(200).json({ 
            message: "Student successfully used powerup second-chance and has been returned to wanted task.",
            assignmentCompleted: false
        });
     })
     .catch(error => { 
         res.status(500).json({ 
             message: "Second-chance powerup consumption failed.", 
             reason: error
         });
     });
});

const validateTasksBody = (data) => {
    if(!!data) {
        let keys = Object.keys(data);
        return keys.includes('task_name') && keys.includes('assignment_id') && keys.includes('category_id') && keys.includes('hint')
            && (typeof data['task_name'] == 'string') && (typeof data['assignment_id'] == 'number' && (typeof data['category_id'] == 'number')
            && (typeof data['hint'] == 'string'));
    }
    return false;
}

//Get task by ID
router.get('/:id', (req, res) => {
    connectionPool.query("SELECT * from tasks WHERE id=$1", [req.params.id])
    .then( (results) => {
        res.status(200).json(results.rows);
    })
    .catch( (error) => {
        res.status(500).json( {
            message: "Cannot get task with given id",
            reason: error
        });
    });
});
//Create task
router.post('/create', (req, res) => {
    if(!validateTasksBody(req.body)) {
        res.status(400).json({
            message: "Invalid data format."
        });
        return;
    }
    let query = format("INSERT INTO tasks(task_name,assignment_id,category_id,hint) VALUES %L RETURNING id;",
                [ [req.body.task_name, req.body.assignment_id, req.body.category_id, req.body.hint] ] );
    connectionPool.query(query)
    .then( results => {
        res.status(200).json({
            message: "Task successfully created.",
            id: results.rows[0].id
        });
    })
    .catch( error => {
        console.log(error.stack);
        res.status(500).json({
            message: "Task creation failed.",
            reason: error
        });
    })
});
//Delete task
router.delete('/:id', (req, res) => {
    connectionPool.query("DELETE FROM tasks WHERE id=$1", [ req.params.id ])
    .then( results => {
        res.status(200).json({
            message: "Task successfully deleted."
        });
    })
    .catch(error => {
        console.log(error.stack);
        res.status(500).json({ 
            message: "Task deletion failed",
            reason: error,
        });
    }); 
});
//Update task
router.put("/update/:id", (req, res) => {
    if(!validateTasksBody(req.body)) {
        res.status(400).json({
            message: "Invalid data format."
        });
        return;
    }
    connectionPool.query("UPDATE tasks SET task_name=$1, assignment_id=$2, category_id=$3, hint=$4 WHERE id=$5;", 
                [req.body.task_name, req.body.assignment_id, req.body.category_id, req.body.hint, req.params.id])
        .then( results => {
            res.status(200).json({
                message: "Task updated successfully.",
                task: results.rows[0]
            });
        })
        .catch( error => {
            console.log(error);
            res.status(500).json({
                message: "Task update failed.",
                reason: error
            });
        });
});
//Get all task categories
router.get('/categories/all', (req, res) => {
    connectionPool.query("SELECT * from task_categories;")
    .then( results => {
        res.status(200).json(results.rows);
    })
    .catch( error => {
        console.log(error.stack);
        res.status(500).json( {
            message: "Internal database error."
        });
    });
})

router.put("/categories/update/:id", (req, res) => {

});

export default router;

