import format from 'pg-format';

const assignments = [ ['Lesson 1'], ['Lesson 2'], ['Lesson 3'], ['Lesson 4'], ['Lesson 5'], ['Lesson 6'], ['Lesson 7'], ['Lesson 8'], ['Lesson 9'], ['Lesson 10']];
const taskCategories = [ ['Easy', 0.06667, 20, 5], ['Moderate', 0.06667, 20, 5], ['Hard', 0.06667, 20, 5] ];
const powerupTypesValues = [['Hint', 60], ['Second Chance', 100], ['Switch Task', 140]];
const powerupsValues = [ ['mmesihovic1', 1], ['mmesihovic1', 2], ['mmesihovic1', 3], ['rfejzic1', 1], ['tsijercic1', 1], ['tsijercic2', 2] ];
const tasks = (() => {
    let _tasks = [];
    let index = 0;
    for(let i=1; i<=10;i++) {
        for(let j=1;j<=3;j++) {
            for(let k=1;k<=20;k++) {
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


