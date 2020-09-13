import express from 'express';
import { connectionPool } from '../utils/connection-pool';
import format from 'pg-format';

const router = express.Router();

// Adds specific powerup to a student, by default powerup is unusued
router.post('/:student/:powerupType', (req, res) => {
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

  // Mass add svima

//Get Tokens table
router.get('/tokens/:student', (req, res) => {
    let student = req.params.student;
    let amount;
    (async () => {
        let resp = await connectionPool.query("SELECT amount FROM tokens WHERE student=$1;", [student]);
        if(resp.rows.length == 0) {
            res.status(400).json({
                message: "Student does not have any tokens aquired.",
            });
            return;
        }
        res.status(200).json({
            amount: resp.rows[0].amount
        });
    })()
    .catch( error => {
        res.status(500).json({
            message: "Getting tokens for student " + student + " failed.",
            reason: error
        });
    });
});

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
        })
    })
    .catch(error => {
        console.log(error);
        res.status(500).json({
            message: "Transaction failed.",
            reason: error
        })
    });
}) ;


export default router;