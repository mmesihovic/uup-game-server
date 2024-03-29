import express from 'express';
import { connectionPool } from '../utils/connection-pool';
import { challengeConfig } from '../utils/challenge-config';
const router = express.Router();

//All
router.get('/challenge/config', (req, res) => {
    res.status(200).json(challengeConfig);
})

router.get('/reset-uup-game/:student', (req,res) => {
    let student= req.params.student;
    (async () => {
        await connectionPool.query("DELETE FROM student_tasks WHERE student=$1;", [student]);
        await connectionPool.query("DELETE FROM current_tasks WHERE student=$1;", [student]);
        await connectionPool.query("DELETE FROM assignment_progress WHERE student=$1;", [student]);
        await connectionPool.query(`DELETE FROM powerups WHERE student=$1;`, [student]);
        await connectionPool.query(`DELETE FROM tokens WHERE student=$1;`, [student]);
    })()
    .then( () => {
        res.status(200).json({
            message: "UUP GAME has been successfully reset for student +"+student+".",
            data: {}
        })
    })
    .catch(error => {
        console.log(error);
        res.status(500).json({
            message: "Resetting UUP GAME for student " + student + " failed.",
            reason: error
        })
    });
});

//All
router.get('/:student', (req, res) => {
    //Get all assignment progress
    let assignmentProgressQuery = 'SELECT assignment_id, status FROM assignment_progress WHERE student=$1;';
    //Get all powerups
    let powerupsStatusQuery = 'SELECT type_id, used, assignment_id, task_number FROM powerups WHERE student=$1;';
    //Get tokens
    let tokensQuery = 'SELECT amount FROM tokens WHERE student=$1;';
    //Get student tasks info
    let studentTasksQuery = 'SELECT assignment_id, COALESCE(SUM(points),0) as points FROM student_tasks WHERE student=$1 GROUP BY assignment_id ORDER BY assignment_id ASC;';
    //Get amount of fully completed tasks
    let completedTasksQuery = 'SELECT assignment_id, COALESCE(COUNT(*),0) as completed FROM student_tasks WHERE student=$1 AND percent=1 GROUP by assignment_id ORDER BY assignment_id ASC;'
    let turnedinTasksQuery = 'SELECT assignment_id, COALESCE(COUNT(*),0) as turned_in FROM student_tasks WHERE student=$1 AND turned_in=TRUE GROUP by assignment_id ORDER BY assignment_id ASC;'
    //Get current tasks 
    let currentTasksQuery = 'SELECT assignment_id, task_number, task_name FROM current_tasks WHERE student=$1;';
    let assignmentProgressData;
    let powerupsStatusData;
    let tokensData;
    let studentTasksData;
    let currentTasksData;
    let completedTasksData;
    let turnedinTasksData;
    let dataObject;
    (async () => {
        const client = await connectionPool.connect();
        try {
            assignmentProgressData = await client.query(assignmentProgressQuery, [req.params.student]);
            powerupsStatusData = await client.query(powerupsStatusQuery, [req.params.student]);
            tokensData = await client.query(tokensQuery, [req.params.student]);
            currentTasksData = await client.query(currentTasksQuery, [req.params.student]);
            studentTasksData = await client.query(studentTasksQuery, [req.params.student]);
            completedTasksData = await client.query(completedTasksQuery, [req.params.student]);
            turnedinTasksData = await client.query(turnedinTasksQuery, [req.params.student]);
            let tokensAmount = (tokensData.rows.length == 0) ? 0 : tokensData.rows[0].amount;
            dataObject = {
                student: req.params.student,
                tokens: tokensAmount,
                powerups: powerupsStatusData.rows,
                assignmentProgress: assignmentProgressData.rows,
                currentTasks: currentTasksData.rows,
                assignmentPoints: studentTasksData.rows,
                completedTasks: completedTasksData.rows,
                turnedInTasks: turnedinTasksData.rows
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