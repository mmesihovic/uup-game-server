import express from 'express';
import { connectionPool } from '../utils/connection-pool';
const router = express.Router();

router.get('/:student', (req, res) => {
    //Get all assignment progress
    let assignmentProgressQuery = 'SELECT assignment_id, status FROM assignment_progress WHERE student=$1;';
    //Get all powerups
    let powerupsStatusQuery = 'SELECT type_id, used, assignment_id, task_number FROM powerups WHERE student=$1;';
    //Get tokens
    let tokensQuery = 'SELECT amount FROM tokens WHERE student=$1;';
    //Get student tasks info
    let studentTasksQuery = 'SELECT assignment_id, task_number, task_name, points FROM student_tasks WHERE student=$1;';
    //Get current tasks 
    let currentTasksQuery = 'SELECT assignment_id, task_number, task_name FROM current_tasks WHERE student=$1;';
    var assignmentProgressData;
    var powerupsStatusData;
    var tokensData;
    var studentsTasksData;
    var currentTasksData;
    (async () => {
        const client = await connectionPool.connect();
        try {

        } catch(e) {
            console.log(e);
            throw e;
        } finally {
            client.release();
        }
    })()
    .then( () => {
        let data = {};
        res.status(200).json(data);
    })
    .catch( error => {
        res.status(500).json({
            message: "Game information for student " + student + "failed.",
            reason: error
        });
    });
})

//Dodaj task_number u current_tasks


export default router;