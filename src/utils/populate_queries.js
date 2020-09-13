
import format from 'pg-format';

const assignments = [ ['Lesson 1'], ['Lesson 2'], ['Lesson 3'], ['Lesson 4'], ['Lesson 5'], ['Lesson 6'], ['Lesson 7'], ['Lesson 8'], ['Lesson 9'], ['Lesson 10']];
const taskCategories = [ ['Easy', 0.06667, 20, 5], ['Moderate', 0.06667, 20, 5], ['Hard', 0.06667, 20, 5] ];
const powerupTypesValues = [['Hint', 60], ['Second Chance', 100], ['Switch Task', 140]];
const powerupsValues = [ ['mmesihovic1', 1], ['mmesihovic1', 2], ['mmesihovic1', 3], ['rfejzic1', 1], ['tsijercic1', 1], ['tsijercic2', 2] ];
/*const studentTasksValues = [
    ['mmesihovic1', 1, 1, 1, 'Task 1'], ['mmesihovic1', 1, 2, 2, 'Task 2'], ['mmesihovic1', 1, 3, 3, 'Task 3'],
    ['mmesihovic1', 1, 4, 4, 'Task 4'], ['mmesihovic1', 1, 5, 5, 'Task 5'], ['mmesihovic1', 1, 6, 6, 'Task 6'],
    ['mmesihovic1', 1, 7, 7, 'Task 7'], ['mmesihovic1', 1, 8, 8, 'Task 8'], ['mmesihovic1', 1, 9, 9, 'Task 9'],
    ['mmesihovic1', 1, 10, 10, 'Task 10'], ['mmesihovic1', 1, 11, 11, 'Task 11'], ['mmesihovic1', 1, 12, 12, 'Task 12'],
    ['mmesihovic1', 1, 13, 13, 'Task 13'], ['mmesihovic1', 1, 14, 14, 'Task 14'], ['mmesihovic1', 1, 15, 15, 'Task 15'] ];*/
const tasks = (() => {
    let _tasks = [];
    let index = 0;
    for(let i=1; i<=4;i++) {
        for(let j=1;j<=3;j++) {
            for(let k=1;k<=10;k++) {
                _tasks[index] = [ 'Task ' + (index+1), i, j, 'Hint ' + (index+1) ];
                index++;
            }
        }
    }
    return _tasks;
})();

export const populateAssignmentsTable = format('INSERT INTO assignments(name) VALUES %L', assignments);
export const populateTaskCategoriesTable = format('INSERT INTO task_categories(name, points_percent, tokens, tasks_per_category) VALUES %L', taskCategories);
export const populateTasksTable = format('INSERT INTO tasks(task_name, assignment_id, category_id, hint) VALUES %L', tasks);
export const populatePowerupTypesTable = format('INSERT INTO powerup_types(name, price) VALUES %L', powerupTypesValues);
export const populatePowerupsTable = format('INSERT INTO powerups(student, type_id) VALUES %L', powerupsValues);
//export const populateCurrentTasksTable = `INSERT INTO current_tasks(student, assignment_id, task_id, task_name) VALUES ('mmesihovic1', 1, 1, 'Task 1');`;
//export const populateStudentTasksTable = format('INSERT INTO student_tasks(student, assignment_id, task_id, task_number, task_name) VALUES %L', studentTasksValues);


