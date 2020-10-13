import express from 'express';
import { connectionPool } from '../utils/connection-pool';
import format from 'pg-format';
import { challengeConfig } from '../utils/challenge-config';
const router = express.Router();

const validateAssignment = (data) => {
    if(!!data) {
        let keys = Object.keys(data);
        return keys.includes('name') && keys.includes('active') && (typeof data['name'] == 'string') && (typeof data['active'] == 'boolean')
                && keys.includes('points') && keys.includes('challenge_pts') && (typeof data['points'] == 'number') && (typeof data['challenge_pts'] == 'number');
    }
    return false;
}
//All
//Get all
router.get('/all', (req,res) => {
    connectionPool.query("SELECT * FROM assignments ORDER BY id ASC;")
        .then( results => {
            res.status(200).json(results.rows);
        })
        .catch(error => {
            console.log(error.stack);
            res.status(500).json({ message: "Internal database error." });
        });
});
//Admin
//Get all tasks for given assignment
router.get('/:id/tasks', (req,res) => {
    connectionPool.query("SELECT * from tasks where assignment_id=$1 ORDER BY id ASC;", [req.params.id])
    .then( results => {
        res.status(200).json(results.rows);
    })
    .catch( error => {
        console.log(error.stack);
        res.status(500).json({ message: "Internal database error."});
    });
});
//Admin
//Get assignment by ID
router.get('/:id', (req,res) => {
    connectionPool.query("SELECT * from assignments WHERE id=$1", [req.params.id] )
    .then( results => {
        res.status(200).json(results.rows);
    })
    .catch( error => {
        console.log(error.stack);
        res.status(500).json({ message: "Internal database error."});
    })
})
//Admin
//Create assignment
router.post('/create', (req,res) => {
    if(!validateAssignment(req.body)) {
        res.status(400).json({ message: "Invalid data format." });
        return;
    }
    let query = format("INSERT INTO assignments(name,active, points, challenge_pts) VALUES %L RETURNING id;", [[req.body.name, req.body.active, req.body.points, req.body.challenge_pts]]);
    connectionPool.query(query)
        .then( results => {
            res.status(200).json({ message: "Assignment successfully created", id: results.rows[0].id});
        })
        .catch( error => {
            console.log(error.stack);
            res.status(500).json({ message: "Internal database error."});
        })
});
//Admin
//Update one 
router.put('/:assignment_id', (req,res) => {
    if(!validateAssignment(req.body)) {
        res.status(400).json({ message: "Invalid data format." });
        return;
    }
    connectionPool.query("UPDATE assignments SET name=$1, active=$2, points=$3, challenge_pts=$4 WHERE id=$5;",
             [req.body.name, req.body.active, req.body.points, req.body.challenge_pts, req.params.assignment_id])
        .then( results => {
            res.status(200).json({ message: "Assignment successfully updated."});
        })
        .catch( error => {
            console.log(error.stack);
            res.status(500).json({ message: "Internal database error."});
        })
});

//Admin
//Delete one
/*
router.delete('/:assignment_id', (req,res) => {
    connectionPool.query("DELETE FROM assignments WHERE id=$1;", [ req.params.assignment_id ])
    .then( results => {
        res.status(200).json({ message: "Assignment sucessfully deleted." });
    })
    .catch(error => {
        console.log(error.stack);
        res.status(500).json({ message: "Internal database error" });
    }); 
});
*/

const separateTasksByCategory = (data) => {
    const result = {};
    for(const {id, task_name, category_id} of data) {
    if(!result[category_id]) result[category_id] = [];
        result[category_id].push({id, task_name});
    }
    return result;
}

const getTasks = async (assignment_id) => {
    let tasks = [];
    let doThings = async () => {
        let taskCategoriesData = await connectionPool.query("SELECT * from task_categories;");
        if(taskCategoriesData.rows.length == 0)
            throw "Task categories are not defined";
        let dbTasksData = await connectionPool.query("SELECT id, task_name, category_id from tasks WHERE assignment_id=$1", [assignment_id]);
        if(dbTasksData.rows.length == 0)
            throw "There are no tasks defined in given assignment";
        let tasksPerCategory = separateTasksByCategory(dbTasksData.rows);
        let __tasks = [];
        for(let i=0;i<taskCategoriesData.rows.length;i++) {
            let category = taskCategoriesData.rows[i].id;
            let _tasks = tasksPerCategory[category];
            let number_of_tasks = taskCategoriesData.rows[i].tasks_per_category;
            let indices = [];
            while(indices.length<number_of_tasks) {
                var index = Math.floor(Math.random() * (_tasks.length));
                if(indices.indexOf(index) === -1) indices.push(index);
            }
            for(let j=0;j<indices.length;j++) {
                __tasks.push( {
                    "task_id": _tasks[ indices[j] ].id,
                    "task_name": _tasks[ indices[j] ].task_name 
                });
            }
        }
        return __tasks;
    }
    tasks = await doThings().catch(e => {
        console.log(e);
        throw e;
    })
    return tasks;
    
}

const assignmentUnlocked = async (student, assignment_id) => {
    if(assignment_id <= 0) throw "Invalid assignment_id";
    let previousAssignmentQuery = 'SELECT id FROM assignments WHERE id<$1 ORDER BY id DESC;';
    let res = await connectionPool.query(previousAssignmentQuery, [assignment_id]);
    if(res.rows.length == 0)
        return true; //First assignment;
    let previousAssignment_id = res.rows[0].id;
    let checkQuery = 'SELECT id FROM student_tasks WHERE student=$1 AND assignment_id=$2 AND turned_in=true AND percent=1';
    res = await connectionPool.query(checkQuery, [student, previousAssignment_id]);
    if(res.rows.length < challengeConfig.tasksRequired)
        return false;
    return true;
}

const switchFiles = async (student, assignment_id, oldTask_id, newTask_id, redo) => {
    let url = 'http://localhost/services/game_shifter.php';
    let result = await fetch(url, {
        method : "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            key: __gameServerKey,
            username: student,
            assignment_id: assignment_id,
            oldTask_id: oldTask_id,
            newTask_id: newTask_id,
            redo: redo
        })                    
    });
    let data = await result.json(); 
    return data.success;
}

//Student
//Start assignment
router.post('/:assignment_id/:student/start', (req,res) => {
    let student = req.params.student;
    let assignment_id = req.params.assignment_id;
    (async () => {
        //Checking if student can even start the assignment 
        let checkActiveStatus = await connectionPool.query("SELECT active FROM assignments WHERE id=$1", [assignment_id]);
        if(checkActiveStatus.rows.length == 0)
            throw "Assignment with given ID does not exist.";
        if(checkActiveStatus.rows[0].active == false)
            throw "Assignment with given ID is not active yet.";
        let unlocked = await assignmentUnlocked(student, assignment_id);
        if(!unlocked)
            throw "Student " + student + " does not fulfill requirements for starting next assignment.";
        //Get tasks for student's assignment from DB
        let tasks = await getTasks(assignment_id);
        if(tasks.length == 0)
            throw "Task selection failed.";
        const client = await connectionPool.connect();
        try {
            await client.query('BEGIN');
            // Checking if student started the assignment already
            let assignmentStartedQuery = 'SELECT * from assignment_progress WHERE student=$1 AND assignment_id= $2;';
            let res = await client.query(assignmentStartedQuery, [ student, assignment_id ]);
            // If there are no results we may start the assignment;
            if(res.rows.length != 0 )
                throw "Student " + student + " has already started this assignment.";
            // Starting the assignment for student
            let insertProgressQueryValues = [[ student, assignment_id, 'In Progress' ]];
            let insertProgressQuery = format('INSERT INTO assignment_progress(student, assignment_id, status) VALUES %L', insertProgressQueryValues);
            await client.query(insertProgressQuery); 

            //Insert values into student_tasks
            let insertTasksQueryValues = [];
            for(let i=0;i<tasks.length;i++) {
                insertTasksQueryValues[i] = [ student, assignment_id, tasks[i].task_id, (i+1), tasks[i].task_name ];
            }
            let insertTasksQuery = format(`INSERT INTO student_tasks(student, assignment_id, task_id, task_number, task_name) VALUES %L`, insertTasksQueryValues);
            await client.query(insertTasksQuery);
            //Insert first task as current_task for assignment
            let insertCurrentTaskQueryValues = [ student, assignment_id, tasks[0].task_id, tasks[0].task_name, 1];
            let insertCurrentTaskQuery = format(`INSERT INTO current_tasks(student,assignment_id, task_id, task_name, task_number) VALUES (%L)`, insertCurrentTaskQueryValues);
            
            await client.query(insertCurrentTaskQuery);

            let successfullFileSwitch = await switchFiles(student, assignment_id, -1, tasks[0].task_id, false);
            if(!successfullFileSwitch)
                throw "Switching files on file system failed.";
            await client.query('COMMIT'); 
            let taskData = {
                task_number: 1,
                task_name: tasks[0].task_name
            }
            return taskData;
        } catch(e) {
            console.log(e);
            //If any of the queries fail, db is rolled back.
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    })()
    .then( (taskData) => {
        res.status(200).json({
            message: "Assignment successfully started.",
            taskData: taskData
        })
    })
    .catch(error => {
        console.group(error);
        res.status(500).json({
            message: "Starting assignment for student " + student + " failed.",
            reason: error
        })
    });

});

export default router;