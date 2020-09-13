import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import indexRouter from './routes/index';
import powerupsRouter from './routes/powerups';
import tasksRouter from './routes/tasks';
import assignmentsRouter from './routes/assignments';

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

indexRouter.use('/powerups/', powerupsRouter);
indexRouter.use('/tasks/', tasksRouter);
indexRouter.use('/assignments/', assignmentsRouter);

app.use('/uup-game', indexRouter);

export default app;