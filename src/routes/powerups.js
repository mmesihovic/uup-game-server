import express from 'express';
import { connectionPool } from '../utils/connection-pool';
import format from 'pg-format';

const router = express.Router();
// Admin
// Adds specific powerup to a student, by default powerup is unusued
router.post('/add/:student/:powerupType', (req, res) => {
    let student = req.params.student;
    let powerupType = req.params.powerupType;
    let query = format(`INSERT INTO powerups(student,type_id) VALUES %L`, [ [student, powerupType] ]) ;
    connectionPool.query(query)
    .then( () => {
        res.status(200).json({
            message: "Powerup added to student " + student + "."
        });
    })
    .catch( error => {
        res.status(500).json({
            message: "Adding powerup to student failed.",
            reason: error
        });
    })
  });
// Admin
// Adds a specific powerup to list of students provided
router.post('/massAdd/:powerupType', (req, res) => {
    let bodyKeys = Object.keys(req.body);
    if(!bodyKeys.includes('students') || !Array.isArray(req.body['students'])) {
        res.status(400).json({
            message: "Invalid data format."
        });
        return;
    }
    let students = req.body['students'];
    let values = [];
    for(const _student of students) {
        values.push([_student, req.params.powerupType]);
    }
    let query = format('INSERT INTO powerups(student, type_id) VALUES %L', values);
    connectionPool.query(query)
    .then( results => {
        res.status(200).json({
            message: "Powerups successfully added to all students provided in a list."
        });
    })
    .catch( error => {
        console.log(error);
        res.status(500).json({
            message: "Adding powerup to students failed.",
            reason: error
        });
    });
});
//Student
//Get Tokens table
router.get('/tokens/:student', (req, res) => {
    let student = req.params.student;
    (async () => {
        let resp = await connectionPool.query("SELECT amount FROM tokens WHERE student=$1;", [student]);
        if(resp.rows.length == 0) {
            res.status(400).json({
                message: "Student does not have any tokens aquired.",
            });
            return;
        }
        res.status(200).json({
            message: "Tokens for student " + student + " successfully retrieved.",
            data: { amount: resp.rows[0].amount }
        });
    })()
    .catch( error => {
        res.status(500).json({
            message: "Getting tokens for student " + student + " failed.",
            reason: error
        });
    });
});
//Admin
router.get('/tokens/', (req,res) => {
    connectionPool.query("SELECT * from tokens;")
    .then( (results) => {
        res.status(200).json(results.rows);
    })
    .catch( (error) => {
        res.status(500).json({
            message: "Tokens data retrieval failed.",
            reason: error
        });
    });
});
//Student
// Buy
router.post('/buy/:student/:powerupType', (req, res) => {
    let student = req.params.student;
    let powerup_type = req.params.powerupType;
    let price, amount;
    let tokensQuery = `SELECT amount from tokens WHERE student=$1`;
    (async () => {
        const client = await connectionPool.connect();
        try {
            await client.query("BEGIN");
            let resp = await connectionPool.query("SELECT * FROM powerup_types;");
            for(let i=0;i<resp.rows.length;i++) {
                if(resp.rows[i].id == powerup_type) {
                    price = resp.rows[i].price;
                    break;
                }
            }
            if(!price) throw "Invalid powerup type.";
            //Check if student has enough tokens
            resp = await client.query(tokensQuery, [student]);
            if(resp.rows.length == 0)
                throw "Student " + student + " has no tokens.";
            amount = resp.rows[0].amount;
            if(price>amount)
                throw "Insufficent amount of tokens at disposal."; 
            //Update tokens table
            let updateTokensQuery = 'UPDATE tokens SET amount = $1 WHERE student=$2';
            await client.query(updateTokensQuery, [amount-price, student]);
            //Add a powerup
            let insertPowerupQuery = format(`INSERT INTO powerups(student,type_id) VALUES %L`, [ [student, powerup_type] ]);
            await client.query(insertPowerupQuery);
            await client.query("COMMIT");
        } catch(e) {
            await client.query("ROLLBACK");
            console.log(e);
            throw e;
        } finally {
            client.release();
        }
    })()
    .then( () => {
        res.status(200).json({
            message: "Powerup added to student " + student,
            powerupType: powerup_type,
            price: price,
            tokens: amount-price
        });
    })
    .catch(error => {
        console.log(error);
        res.status(500).json({
            message: "Transaction failed.",
            reason: error
        })
    });
});
//All
router.get('/types', (req, res) => {
    connectionPool.query("SELECT * from powerup_types;")
    .then( results => {
        res.status(200).json(results.rows);
    })
    .catch( error => {
        res.status(500).json({
            message: "Powerup Types data retrieval failed.",
            reason: error
        });
    });
})

export default router;