import express from 'express';
import { connectionPool } from '../utils/connection-pool';
import { challengeConfig } from '../utils/challenge-config';
const router = express.Router();

router.get('/challenge/config', (req, res) => {
    res.status(200).json(challengeConfig);
})

router.get('/:student', (req, res) => {
    //Get all assignment progress
    let assignmentProgressQuery = 'SELECT assignment_id, status FROM assignment_progress WHERE student=$1;';
    //Get all powerups
    let powerupsStatusQuery = 'SELECT type_id, used, assignment_id, task_number FROM powerups WHERE student=$1;';
    //Get tokens
    let tokensQuery = 'SELECT amount FROM tokens WHERE student=$1;';
    //Get student tasks info
    let studentTasksQuery = 'SELECT assignment_id, COALESCE(SUM(points),0) as points, COUNT(percent=1) FROM student_tasks WHERE student=$1 GROUP BY assignment_id ORDER BY assignment_id ASC;';
    //Get amount of fully completed tasks
    let completedTasksQuery = 'SELECT assignment_id, COALESCE(COUNT(*),0) FROM '
    //Get current tasks 
    let currentTasksQuery = 'SELECT assignment_id, task_number, task_name FROM current_tasks WHERE student=$1;';
    let assignmentProgressData;
    let powerupsStatusData;
    let tokensData;
    let studentTasksData;
    let currentTasksData;
    let dataObject;
    (async () => {
        const client = await connectionPool.connect();
        try {
            assignmentProgressData = await client.query(assignmentProgressQuery, [req.params.student]);
            powerupsStatusData = await client.query(powerupsStatusQuery, [req.params.student]);
            tokensData = await client.query(tokensQuery, [req.params.student]);
            currentTasksData = await client.query(currentTasksQuery, [req.params.student]);
            studentTasksData = await client.query(studentTasksQuery, [req.params.student]);
            let tokensAmount = (tokensData.rows.length == 0) ? 0 : tokensData.rows[0].amount;
            dataObject = {
                student: req.params.student,
                tokens: tokensAmount,
                powerups: powerupsStatusData.rows,
                assignmentProgress: assignmentProgressData.rows,
                currentTasks: currentTasksData.rows,
                assignmentPoints: studentTasksData.rows
            }
        } catch(e) {
            console.log(e);
            throw e;
        } finally {
            client.release();
        }
        return dataObject;
    })()
    .then( (_data) => {
        res.status(200).json(_data);
    })
    .catch( error => {
        res.status(500).json({
            message: "Game information retrieval for student " + req.params.student + " failed.",
            reason: error
        });
    });
})



export default router;