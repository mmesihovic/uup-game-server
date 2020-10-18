import { connectionPool } from './connection-pool';

(async function() {
    const client = await connectionPool.connect();
    //Create
    await client.query('CREATE INDEX student_tasks_index ON student_tasks(student, assignment_id);');
    await client.query('CREATE INDEX assignment_progress_index ON assignment_progress(student, assignment_id);');
    await client.query('CREATE INDEX current_tasks_index ON current_tasks(student, assignment_id);');
    await client.query('CREATE INDEX powerups_index ON powerups(student);');
    
    client.release();
})().catch(err => console.log(err.stack));


