export const createAssignmentsTable = 
    'DROP TABLE IF EXISTS assignments CASCADE;' +
    'CREATE TABLE IF NOT EXISTS assignments (' +
        'id SERIAL PRIMARY KEY,' +
        'name VARCHAR NOT NULL,' +
        'active BOOLEAN NOT NULL DEFAULT false,' +
        'points REAL NOT NULL DEFAULT 3,' +
        'challenge_pts REAL NOT NULL DEFAULT 2' +
    ');';

export const createTokensTable = 
    'DROP TABLE IF EXISTS tokens CASCADE;' +
    'CREATE TABLE IF NOT EXISTS tokens (' +
        'id SERIAL PRIMARY KEY,' +
        'student VARCHAR NOT NULL,' +
        'amount INT NOT NULL DEFAULT 10' +
    ');';

export const createTaskCategoriesTable =
    'DROP TABLE IF EXISTS task_categories CASCADE;' +
    'CREATE TABLE IF NOT EXISTS task_categories (' +
        'id SERIAL PRIMARY KEY,' +
        'name VARCHAR NOT NULL,' +
        'points_percent REAL NOT NULL,' +
        'tokens SMALLINT NOT NULL,' +
        'tasks_per_category SMALLINT NOT NULL DEFAULT 5' +
    ');';

export const createTasksTable = 
    'DROP TABLE IF EXISTS tasks CASCADE;' +
    'CREATE TABLE IF NOT EXISTS tasks (' +
        'id SERIAL PRIMARY KEY,' +
        'task_name VARCHAR NOT NULL,' +
        'assignment_id SMALLINT NOT NULL,' +
        'category_id SMALLINT NOT NULL,' +
        'hint VARCHAR NOT NULL,' +
        'CONSTRAINT fk_category_id FOREIGN KEY(category_id) REFERENCES task_categories(id),' +
        'CONSTRAINT fk_assignment_id FOREIGN KEY(assignment_id) REFERENCES assignments(id)' +
    ');';
    
export const createAssignmentProgressTable = 
    'DROP TABLE IF EXISTS assignment_progress CASCADE;' +
    'CREATE TABLE IF NOT EXISTS assignment_progress (' +
        'id SERIAL PRIMARY KEY,' +
        'student VARCHAR NOT NULL,' +
        'assignment_id SMALLINT NOT NULL,' +
        'status VARCHAR NOT NULL,' +
        'virgin BOOLEAN NOT NULL DEFAULT true,' +
        'return_id SMALLINT NOT NULL DEFAULT -1,' +
        'CONSTRAINT fk_assignment_id FOREIGN KEY(assignment_id) REFERENCES assignments(id)' +
    ');';

export const createPowerupTypesTable = 
    'DROP TABLE IF EXISTS powerup_types CASCADE;' +
    'CREATE TABLE IF NOT EXISTS powerup_types (' +
        'id SERIAL PRIMARY KEY,' +
        'name VARCHAR NOT NULL,' +
        'price SMALLINT NOT NULL' +
    ');';

export const createPowerupsTable = 
    'DROP TABLE IF EXISTS powerups CASCADE;' +
    'CREATE TABLE IF NOT EXISTS powerups (' +
        'id SERIAL PRIMARY KEY,' +
        'student VARCHAR NOT NULL,' +
        'type_id SMALLINT NOT NULL,' +
        'used BOOLEAN NOT NULL DEFAULT false,' +
        'assignment_id SMALLINT,' +
        'task_id SMALLINT,' +
        'task_number SMALLINT,' +
        'CONSTRAINT fk_powerup_type FOREIGN KEY(type_id) REFERENCES powerup_types(id) ON DELETE SET NULL' +
    ');';

export const createCurrentTasksTable = 
    'DROP TABLE IF EXISTS current_tasks CASCADE;' +
    'CREATE TABLE IF NOT EXISTS current_tasks (' +
        'id SERIAL PRIMARY KEY,' +
        'student VARCHAR NOT NULL,' +
        'assignment_id INT NOT NULL,' +
        'task_id INT NOT NULL,' +
        'task_name VARCHAR NOT NULL,' +
        'CONSTRAINT fk_assignment_id FOREIGN KEY(assignment_id) REFERENCES assignments(id),' +
        'CONSTRAINT fk_task_id FOREIGN KEY(task_id) REFERENCES tasks(id)' +
    ');';

export const createStudentTasksTable = 
    'DROP TABLE IF EXISTS student_tasks CASCADE;' +
    'CREATE TABLE IF NOT EXISTS student_tasks (' +
        'id SERIAL PRIMARY KEY,' +
        'student VARCHAR NOT NULL,' +
        'assignment_id INT NOT NULL,' +
        'task_id INT NOT NULL,' +
        'task_number SMALLINT NOT NULL,' +
        'task_name VARCHAR NOT NULL,' +
        'points REAL,' +
        'percent REAL,' +
        'turned_in BOOLEAN NOT NULL DEFAULT false,' +
        'CONSTRAINT fk_assignment_id FOREIGN KEY(assignment_id) REFERENCES assignments(id),' +
        'CONSTRAINT fk_task_id FOREIGN KEY(task_id) REFERENCES tasks(id)' +
    ');';


        