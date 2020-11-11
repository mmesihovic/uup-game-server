import express from 'express';
import { connectionPool } from '../utils/connection-pool';
const router = express.Router();

router.get('/leaderboard', (req, res) => {
    let query = `SELECT student, sum(points) as points
                 FROM student_tasks
                 GROUP BY student
                 ORDER BY points DESC
                 LIMIT 50;`
    connectionPool.query(query)
    .then( results => {
        res.status(200).json(results.rows);
    })
    .catch( error => {
        console.log(error);
        res.status(500).json({ 
            message: "Internal database error.",
            error: error
        });
    });
});

function groupBy(data, property) {
    return data.reduce((acc, obj) => {
      const key = obj[property];
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(obj);
      return acc;
    }, {});
  }

const getStudentTasks = async (student) => {
    let studentDataQuery = `SELECT assignment_id, task_id, task_name, task_number, turned_in, points FROM student_tasks WHERE student=$1;`;
    let data = await connectionPool.query(studentDataQuery, [student]);
    if(data.rows.length == 0)
        throw "Student has not started the game yet!";
    let tasksData = [];
    let currentTaskQuery = `SELECT * from current_tasks WHERE student=$1;`;
    let _currentTasksData = await connectionPool.query(currentTaskQuery, [student]);
    let currentTasksData = _currentTasksData.rows;
    data.rows.forEach( (task) => {
        let index = currentTasksData.findIndex( (x) => { return x.assignment_id == task.assignment_id && x.task_id == task.task_id });
        tasksData.push({
            assignment_id: task.assignment_id,
            task_id: task.task_id,
            task_name: task.task_name,
            task_number: task.task_number,
            status: (index != -1) ? 'CURRENT TASK' : ( (task.turned_in ? 'TURNED IN' : 'NOT TURNED IN') ),
            points: task.points ? task.points : 0 
        });
    });
    
    let groupedData = groupBy(tasksData, 'assignment_id');
    console.log(groupedData);
    return groupedData;
}

router.get('/students/:student', (req, res) => {
    let student = req.params.student;
    var data;
    (async () => { data = await getStudentTasks(student); })()
    .then(() => {
        res.status(200).json(data);
    }).catch(error => { 
        console.log(error);
        res.status(500).json({ 
            message: "Fetching game statistics and data for student failed.",
            reason: error
        });
    });
});

router.get('/general', (req, res) => {
    let playersQuery = `SELECT COUNT(DISTINCT student) as players
                        FROM student_tasks;`;
    let tokensQuery = `SELECT SUM(amount) as tokensInGame
                       FROM tokens;`;
    let powerupsQuery = `SELECT type_id, used from powerups;`;
    let bestStudentsQuery = `SELECT student, SUM(points) as points
                                FROM student_tasks
                                WHERE turned_in = true 
                                GROUP BY student
                                ORDER BY points DESC
                                LIMIT 3;`;
    let returnObject = {};
    let dbCall = async () => {
        const client = await connectionPool.connect();
        try {
            let playersData = await client.query(playersQuery);
            let tokensData = await client.query(tokensQuery);
            let powerupsData = await client.query(powerupsQuery);
            let bestStudentsData = await client.query(bestStudentsQuery);
            let usedPowerups = 0;
            let unusedPowerups = 0;
            powerupsData.rows.forEach( (powerup) => {
                powerup.used ? usedPowerups++ : unusedPowerups++;
            });
            let bestStudents = [];
            bestStudentsData.rows.forEach( (row) => {
                bestStudents.push({
                    username: row.student,
                    points: row.points
                });
            })
            returnObject = {
                players: playersData.rows.length > 0 ? playersData.rows[0].players : -1,
                tokensInGame: tokensData.rows.length > 0 ? tokensData.rows[0].tokensingame : -1,
                powerUpsInGame: powerupsData.rows.length,
                usedPowerUps: usedPowerups,
                unusedPowerUps: unusedPowerups,
                bestStudents: bestStudents
            };
        }
        catch(e) {
            throw e;
        }
        finally {
            client.release();
        }
    }    
    (async () => { await dbCall(); })()
    .then( () => {
        res.status(200).json(returnObject);
    })
    .catch(e => {
        console.log(e);
        res.status(500).json({
            message: "Could not fetch general statistics.",
            reason: e
        });
    });
});              

router.get('/tasks/:task_id', (req, res) => {
    let task_id = req.params.task_id;
    connectionPool.query('SELECT student FROM current_tasks WHERE task_id=$1', [task_id])
    .then ( results => {
        res.status(200).json(results.rows);
    })
    .catch( error => {
        console.log(error);
        res.status(500).json({
            message: "Getting list of students for given task failed.",
            reason: error
        });
    });
});

export default router;
