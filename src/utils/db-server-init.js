import { connectionPool } from './connection-pool';
import { 
    createAssignmentsTable, 
    createPowerupTypesTable,
    createPowerupsTable,
    createStudentTasksTable,
    createCurrentTasksTable, 
    createTokensTable,
    createTaskCategoriesTable,
    createTasksTable,
    createAssignmentProgressTable} from './init_queries';
import {
    populateAssignmentsTable,
    populatePowerupTypesTable,
    populateTaskCategoriesTable,
} from './populate_queries'


(async function() {
    const client = await connectionPool.connect();
    //Create
    await client.query(createAssignmentsTable);
    await client.query(createTokensTable);
    await client.query(createTaskCategoriesTable);
    await client.query(createTasksTable);
    await client.query(createAssignmentProgressTable);
    await client.query(createPowerupTypesTable);
    await client.query(createPowerupsTable);
    await client.query(createCurrentTasksTable);
    await client.query(createStudentTasksTable); 
    //Populate
    //await client.query(populateAssignmentsTable);
    await client.query(populateTaskCategoriesTable);
    await client.query(populatePowerupTypesTable);
    
    client.release();
})().catch(err => console.log(err.stack));


